#!/usr/bin/env python3
"""Smoke-test what the public actually gets: the API endpoints and the downloads.

Everything here hits the PUBLISHED bucket over plain HTTPS with no credentials,
which is the only way to test what a visitor experiences -- `gcloud storage ls`
succeeds on objects the public cannot read, so it proves nothing about access.

Four checks:

  api       every example path in the API docs returns 200
  drift     the outputs the API docs claim still match live data. Documented
            numbers go stale silently; a reader copying the snippet and getting
            different numbers than the page shows has no way to tell which is
            right.
  downloads the catalogs parse, and a sample of the files they advertise return
            200 with a readable size
  staleness which locally built sections are not yet published -- the cause of
            "unknown section" errors on the live site
    render    (--site) every route actually DRAWS, in a real browser

RENDER IS THE CHECK THAT WOULD HAVE CAUGHT THE 2026-08-29 BREAKAGE. The other
four all passed while /results/causal/triads was a blank page: the payload was
correct, every section resolved, nothing was stale. What broke was the SITE's
ability to render what it had fetched -- the MR arm-scope change dropped the
pEP..pDE columns the triad DAG read, and an unguarded access threw on every
render. "The data is right and reachable" and "the page works" are different
claims, and only the second is what a visitor experiences.

Exit code is non-zero if anything fails, so it can gate a deploy.

  python3 tools/check_public.py            # test the live bucket
  python3 tools/check_public.py --base http://localhost:3008   # a local preview
    python3 tools/check_public.py --site https://<preview>.web.app   # + render
"""
import argparse, gzip, io, json, os, re, sys, urllib.error, urllib.request

PUBLIC_BUCKET = "https://storage.googleapis.com/heap-data"
DEFAULT_BASE = f"{PUBLIC_BUCKET}/web/v1"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_DOCS = os.path.join(HERE, "heap", "frontend", "src", "pages", "subpages", "ApiDocs.js")
LOCAL_MANIFEST = os.path.join(HERE, "build", "web", "v1", "manifest.json.gz")

# Outputs the API docs promise. Kept here rather than scraped, because the point
# is to notice when the page and the data disagree.
DOC_CLAIMS = {
    "nProteins": "2686",
    "key_column": "Protein",
    # Updated 2026-08-29 for the pQTL arm-scope rebuild. A motif is now
    # assembled WITHIN one platform, so tier1 = "either arm" and the old
    # tier1_triads survive as the ukb_triads column (B 1353, C 4499, E 12892).
    # These are transcribed from the summariser's own output:
    #   HEAP/docs/manuscript_stats/module5/mr_motif_counts.tsv
    # Deliberately hardcoded, not read from that file: this is a tripwire
    # against the live data moving without anyone deciding it should.
    # Invariant that must hold: tier1 == ukb + decode - tier1plus.
    "motif_cols": ["motif", "ukb_triads", "decode_triads",
                   "tier1_triads", "tier1_proteins",
                   "tier1plus_triads", "tier1plus_proteins",
                   "nominal_triads", "nominal_proteins"],
    "motifs": {"A": (6, 3, 84, 25), "B": (1368, 326, 2232, 404),
               "C": (4591, 460, 4829, 444), "D": (30, 4, 722, 41),
               "E": (14273, 490, 17999, 550)},
}

fails, warns = [], []

def fail(m): fails.append(m); print(f"  FAIL  {m}")
def warn(m): warns.append(m); print(f"  WARN  {m}")
def ok(m):   print(f"  ok    {m}")

def fetch(url, timeout=60):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        raw = r.read()
        enc = (r.headers.get("Content-Encoding") or "").lower()
    if enc == "gzip" or raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return raw

def fetch_json(url, timeout=60):
    return json.loads(fetch(url, timeout))

def head(url, timeout=45):
    req = urllib.request.Request(url, method="HEAD")
    req.add_header("Accept-Encoding", "gzip")     # what a browser sends
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.headers

def check_api(base):
    print("\n[api] documented endpoints")
    if not os.path.exists(API_DOCS):
        fail(f"cannot find {API_DOCS}"); return
    examples = re.findall(r"example:\s*'([^']+)'", open(API_DOCS).read())
    if not examples:
        fail("no `example:` paths found in ApiDocs.js"); return
    for p in examples:
        try:
            n = len(fetch(f"{base}/{p}"))
            ok(f"{p}  ({n:,} B)")
        except Exception as e:
            fail(f"{p}  -> {e}")

def check_drift(base):
    print("\n[drift] do the documented outputs still match live data?")
    try:
        motifs = fetch_json(f"{base}/s/mr_motif_counts.json.gz")
    except Exception as e:
        fail(f"mr_motif_counts unreadable: {e}"); return
    if list(motifs) != DOC_CLAIMS["motif_cols"]:
        fail(f"motif columns changed: docs {DOC_CLAIMS['motif_cols']} vs live {list(motifs)}")
    else:
        ok("motif column names")
    for i, m in enumerate(motifs.get("motif", [])):
        live = (motifs["tier1_triads"][i], motifs["tier1_proteins"][i],
                motifs["nominal_triads"][i], motifs["nominal_proteins"][i])
        doc = DOC_CLAIMS["motifs"].get(m[0])
        if doc is None:
            warn(f"motif {m!r} is live but not in the docs")
        elif tuple(live) != doc:
            fail(f"motif {m[0]}: docs show {doc}, live is {tuple(live)}")
        else:
            ok(f"motif {m[0]} counts")

    # The arm-scope invariant. A motif is assembled within ONE platform, so a
    # triad is UKB, deCODE, or both, and nothing else -- tier1 must be the
    # union. If someone pools the two arms' edges and evaluates motifs on the
    # union, extra triads appear that belong to neither arm and this breaks.
    # That is trap 2 of the rebuild brief, made mechanical.
    if all(c in motifs for c in ("ukb_triads", "decode_triads", "tier1plus_triads")):
        for i, m in enumerate(motifs.get("motif", [])):
            u, d = motifs["ukb_triads"][i], motifs["decode_triads"][i]
            t, b = motifs["tier1_triads"][i], motifs["tier1plus_triads"][i]
            if u + d - b != t:
                fail(f"motif {m[0]}: arm scope broken -- "
                     f"ukb {u} + decode {d} - both {b} != tier1 {t}")
            else:
                ok(f"motif {m[0]} arm scope ({u}+{d}-{b}={t})")
    try:
        h = fetch_json(f"{base}/meta/headline.json.gz")
        live = str(h["macros"]["nProteins"]["value"])
        (ok if live == DOC_CLAIMS["nProteins"] else fail)(
            f"nProteins docs={DOC_CLAIMS['nProteins']} live={live}")
        k = fetch_json(f"{base}/k/assoc_base/_keys.json.gz")
        (ok if k["key_column"] == DOC_CLAIMS["key_column"] else fail)(
            f"key_column docs={DOC_CLAIMS['key_column']!r} live={k['key_column']!r}")
    except Exception as e:
        fail(f"headline/keys unreadable: {e}")

def check_downloads(base, sample):
    print("\n[downloads] catalogs and the files they advertise")
    try:
        cat = fetch_json(f"{base}/catalog.json.gz")
        miss = cat.get("n_missing", 0)
        (ok if not miss else fail)(
            f"catalog: {cat.get('n_available')}/{cat.get('n_datasets')} datasets available, {miss} missing")
    except Exception as e:
        fail(f"catalog.json.gz unreadable: {e}")
    try:
        sc = fetch_json(f"{base}/supp_catalog.json.gz")
    except Exception as e:
        fail(f"supp_catalog.json.gz unreadable: {e}"); return

    # The supplementary archive sits under its own prefix, NOT under web/v1.
    # Mirror the app (pages/Downloads.js): strip /web/vN when the base has it,
    # otherwise fall back to the published bucket, because the ~866MB archive is
    # never built locally and a preview base has nothing to strip.
    root = (re.sub(r"/web/v\d+/?$", "", base)
            if re.search(r"/web/v\d+/?$", base) else PUBLIC_BUCKET)
    if root != re.sub(r"/web/v\d+/?$", "", base):
        ok(f"download root falls back to {root} (base is a local preview)")
    files = [(f, e) for f, entries in sc["folders"].items() for e in entries]
    total = sum(e.get("gz_bytes", 0) for _, e in files)
    ok(f"supp_catalog: {len(files)} files, {total/1e6:.0f} MB gz, prefix {sc['prefix']!r}")
    # One file per folder, not every Nth: the folders are wildly uneven (
    # pes_weights alone is most of the 399), so a flat stride tests the same
    # folder six times and never touches the others.
    per_folder, seen = [], set()
    for fld, e in files:
        if fld not in seen:
            seen.add(fld); per_folder.append((fld, e))
    for fld, e in per_folder[:max(sample, len(per_folder))]:
        url = f"{root}/{sc['prefix']}/{e['path']}.gz"
        try:
            status, hdrs = head(url)
            n = hdrs.get("Content-Length")
            (ok if status == 200 else fail)(
                f"[{fld}] {e['path'][:58]}  {status}  {n or 'no size'} B")
        except Exception as ex:
            fail(f"[{fld}] {e['path'][:58]}  -> {ex}")

def check_staleness(base):
    # Always compare against the PUBLISHED bucket. Comparing a local build to a
    # local preview server is comparing it to itself, which always says "all
    # published" -- the most misleading possible answer to this question.
    print("\n[staleness] built locally but not published")
    if not base.startswith(PUBLIC_BUCKET):
        print(f"  note  base is {base}; checking against {DEFAULT_BASE} instead")
        base = DEFAULT_BASE
    if not os.path.exists(LOCAL_MANIFEST):
        warn("no local build/web/v1/manifest.json.gz to compare against"); return
    def ids(m):
        return {s["section_id"] for p in m["pages"] for s in p["sections"]}
    try:
        pub = ids(fetch_json(f"{base}/manifest.json.gz"))
    except Exception as e:
        fail(f"published manifest unreadable: {e}"); return
    loc = ids(json.load(gzip.open(LOCAL_MANIFEST)))
    only_local, only_pub = sorted(loc - pub), sorted(pub - loc)
    if only_local:
        warn(f"{len(only_local)} section(s) built but NOT published -> the live "
             f"site shows \"unknown section\" for these: {', '.join(only_local)}")
    else:
        ok("every locally built section is published")
    if only_pub:
        warn(f"{len(only_pub)} published section(s) no longer built locally: "
             f"{', '.join(only_pub)}")

def check_pages(base):
    """Every registered section resolves -- i.e. no page renders an error card.

    This is the automated half of "does the site work". The frontend fetches a
    section by id, looks it up in the published manifest and requests the path
    it finds there; a section that is registered but absent from the manifest,
    or present with a path that 404s, becomes a "Could not load this section"
    card on whichever page renders it.

    Checking it from the registry rather than by opening pages means a section
    nobody has clicked yet is covered too.
    """
    import csv as _csv
    cfg = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web_sections.tsv")
    if not os.path.exists(cfg):
        warn("no web_sections.tsv; skipping page check")
        return
    man = fetch_json(f"{base}/manifest.json.gz")
    if not man:
        fail("manifest unreadable; cannot check pages")
        return
    published = {}
    for pg in man.get("pages", []):
        for sec in pg.get("sections", []):
            published[sec["section_id"]] = sec

    by_page = {}
    with open(cfg) as fh:
        for row in _csv.DictReader(fh, delimiter="\t"):
            if (row.get("status") or "on").strip() != "on":
                continue
            by_page.setdefault(row["page"], []).append(row["section_id"])

    for page in sorted(by_page):
        missing, broken = [], []
        for sid in by_page[page]:
            sec = published.get(sid)
            if not sec:
                missing.append(sid)
                continue
            # tier K advertises a key index; tier S a single path
            path = sec.get("path") or sec.get("keys_path")
            if not path:
                broken.append(f"{sid} (no path in manifest)")
                continue
            # head() returns (status, headers) -- comparing the tuple to 200 is
            # never true, which made every section look broken.
            try:
                status = head(f"{base}/{path}")[0]
            except Exception as exc:
                broken.append(f"{sid} -> {path} ({type(exc).__name__})")
                continue
            if status != 200:
                broken.append(f"{sid} -> {path}")
        n = len(by_page[page])
        if missing or broken:
            for m in missing:
                fail(f"page '{page}': section '{m}' registered but not in the manifest")
            for b in broken:
                fail(f"page '{page}': {b} does not resolve")
        else:
            ok(f"page '{page}': all {n} section(s) resolve")



# Routes a visitor can reach. Listed here rather than derived from the router, so
# that a route silently dropped from Results.js fails this check instead of
# quietly disappearing from it.
SITE_ROUTES = [
    "/", "/downloads",
    "/results/main", "/results/summary", "/results/associations",
    "/results/architecture", "/results/mediation", "/results/intervention",
    "/results/enrichment", "/results/enrichment-guide",  # alias, must keep resolving
    "/results/enrichment/tissue", "/results/enrichment/programs",
    "/results/causal", "/results/causal/entities", "/results/causal/triads",
    "/results/causal/effects", "/results/causal/coloc",
    "/results/pes", "/results/pes-guide", "/results/pes-guide/tracks",
    "/results/pes-guide/compare", "/results/pes-guide/disease",
    "/results/gwas",
    "/documentation/about", "/documentation/quickstart", "/documentation/methods",
    "/documentation/cite", "/documentation/api",
]

# Below this a route has drawn its chrome and nothing else, which is what a
# thrown render looks like from outside. The 404 page is ~46 words, so the floor
# sits under it and "did we fall through to the 404" is checked separately.
MIN_WORDS = 30


def check_render(site):
    """Load every route in a real browser and require that it actually draws.

    This is the check the others cannot do: a page can fetch correct data and
    still throw while rendering it. Only uncaught exceptions count as errors --
    console errors are ignored because analytics is blocked in headless and
    would otherwise fail every route.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        warn("render: playwright not installed, skipped")
        return
    import glob as _glob
    exe = sorted(_glob.glob(os.path.expanduser(
        "~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome")))
    if not exe:
        warn("render: no chromium under ~/.cache/ms-playwright, skipped")
        return

    print(f"\n[render] every route draws  ({site})")
    with sync_playwright() as p:
        # executable_path is explicit: the installed browser version does not
        # match what the playwright package expects and the default launch fails.
        b = p.chromium.launch(executable_path=exe[-1], args=["--no-sandbox"])
        for route in SITE_ROUTES:
            pg = b.new_page(viewport={"width": 1440, "height": 1000})
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
            try:
                pg.goto(site.rstrip("/") + route, wait_until="networkidle", timeout=70000)
                pg.wait_for_timeout(6000)
                text = pg.inner_text("body")
            except Exception as e:
                fail(f"render {route}: {str(e)[:90]}")
                pg.close()
                continue
            n = len(text.split())
            if errs:
                fail(f"render {route}: threw -- {errs[0]}")
            elif "That page does not exist" in text:
                fail(f"render {route}: fell through to the 404")
            elif n < MIN_WORDS:
                fail(f"render {route}: {n} words -- chrome only, nothing drew")
            else:
                ok(f"render {route}: {n} words")
            pg.close()
        b.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--site", default=None,
                    help="site URL; adds a browser pass asserting every route draws")
    ap.add_argument("--sample", type=int, default=0,
                    help="extra download files to HEAD beyond one per folder")
    a = ap.parse_args()
    print(f"Checking {a.base}")
    check_api(a.base)
    check_drift(a.base)
    check_downloads(a.base, a.sample)
    check_staleness(a.base)
    check_pages(a.base)
    if a.site:
        check_render(a.site)
    print(f"\n{'-'*60}\n{len(fails)} failure(s), {len(warns)} warning(s)")
    if fails:
        print("FAILED:"); [print(f"  - {m}") for m in fails]
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
