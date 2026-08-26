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

Exit code is non-zero if anything fails, so it can gate a deploy.

  python3 tools/check_public.py            # test the live bucket
  python3 tools/check_public.py --base http://localhost:3008   # a local preview
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
    "motif_cols": ["motif", "tier1_triads", "tier1_proteins",
                   "nominal_triads", "nominal_proteins"],
    "motifs": {"A": (6, 3, 84, 25), "B": (1353, 325, 2232, 404),
               "C": (4499, 450, 4829, 444), "D": (30, 4, 722, 41),
               "E": (12892, 469, 17999, 550)},
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

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--sample", type=int, default=0,
                    help="extra download files to HEAD beyond one per folder")
    a = ap.parse_args()
    print(f"Checking {a.base}")
    check_api(a.base)
    check_drift(a.base)
    check_downloads(a.base, a.sample)
    check_staleness(a.base)
    print(f"\n{'-'*60}\n{len(fails)} failure(s), {len(warns)} warning(s)")
    if fails:
        print("FAILED:"); [print(f"  - {m}") for m in fails]
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
