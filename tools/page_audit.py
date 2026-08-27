#!/usr/bin/env python3
"""Render every route in a real browser and measure what a visitor actually sees.

Static analysis cannot measure prose on this site. React interleaves copy with
{...} expressions, so a loose regex counts code as text (34k words) and a strict
one drops real copy (4k words). Neither number is usable. This renders the page
and reads the DOM, which is the only way to get the true figure.

Reports, per route:
  words        visible text a reader is confronted with
  blocks       distinct prose blocks (paragraphs, alerts, help text)
  longest      the single longest prose block, in words
  controls     interactive elements (selects, buttons, tabs, inputs)
  plots        rendered Plotly canvases. NOTE: hand-drawn SVG panels do not
               register here, so a words-per-plot ratio penalises pages built
               on custom SVG (intervention's network, enrichment's body map,
               the triad DAG). Rank those on raw word count; check `svgs`
               before quoting a ratio.
  errors       console errors and failed requests

Usage:
  python3 tools/page_audit.py --base https://<preview>.web.app
  python3 tools/page_audit.py --base ... --route /results/mediation --dump
"""
import argparse, glob, json, os, re, sys

EXE_CANDIDATES = sorted(glob.glob(
    os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome")))

ROUTES = [
    "/", "/downloads",
    "/results/main", "/results/summary", "/results/associations",
    "/results/architecture", "/results/interactions", "/results/mediation",
    "/results/intervention", "/results/enrichment", "/results/causal",
    "/results/pes", "/results/gwas",
    "/documentation/about", "/documentation/quickstart",
    "/documentation/evidence-tiers", "/documentation/specifications",
    "/documentation/dictionary", "/documentation/api", "/documentation/methods",
    "/documentation/changelog", "/documentation/cite", "/documentation/credits",
    "/documentation/faqs",
]

# Text that is a control label or a datum, not prose to be read.
NOT_PROSE = re.compile(r'^[\d\s.,%+−-]*$')

JS_EXTRACT = r"""
() => {
  const seen = new Set();
  const blocks = [];
  // A prose block is an element whose own text is a sentence and which does not
  // contain another such element -- that keeps a paragraph from being counted
  // again through each of its ancestors.
  const sel = 'p, li, .MuiAlert-message, .MuiTypography-root, dd, figcaption, blockquote';
  document.querySelectorAll(sel).forEach(el => {
    if (el.querySelector(sel)) return;             // not a leaf
    const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
    if (t.length < 40) return;                     // labels, not prose
    if (seen.has(t)) return;
    seen.add(t);
    blocks.push(t);
  });
  return {
    blocks,
    controls: document.querySelectorAll(
      'select, button, [role=tab], [role=button], input, .MuiSelect-root').length,
    plots: document.querySelectorAll('.js-plotly-plot').length,
    svgs: document.querySelectorAll('svg').length,
    allText: (document.body.innerText || '').trim().replace(/\s+/g, ' '),
  };
}
"""


def audit(base, routes, dump=False, settle=4500):
    from playwright.sync_api import sync_playwright
    if not EXE_CANDIDATES:
        sys.exit("no chromium found under ~/.cache/ms-playwright")
    out = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE_CANDIDATES[-1],
                              args=["--no-sandbox"])
        for route in routes:
            page = b.new_page(viewport={"width": 1440, "height": 900})
            errs = []
            page.on("console", lambda m: m.type == "error" and errs.append(m.text[:160]))
            page.on("requestfailed",
                    lambda r: errs.append(f"FAILED {r.url.split('/')[-1]}"))
            try:
                page.goto(base.rstrip("/") + route, wait_until="networkidle",
                          timeout=60000)
            except Exception as e:
                out.append({"route": route, "error": str(e)[:120]})
                page.close()
                continue
            page.wait_for_timeout(settle)          # let lazy sections resolve
            try:
                d = page.evaluate(JS_EXTRACT)
            except Exception as e:
                out.append({"route": route, "error": f"extract: {str(e)[:100]}"})
                page.close()
                continue
            prose = [t for t in d["blocks"] if not NOT_PROSE.match(t)]
            words = sum(len(t.split()) for t in prose)
            rec = {
                "route": route,
                "words": words,
                "blocks": len(prose),
                "longest": max((len(t.split()) for t in prose), default=0),
                "controls": d["controls"],
                "plots": d["plots"],
                "svgs": d["svgs"],
                "total_words": len(d["allText"].split()),
                "errors": sorted(set(errs))[:5],
            }
            if dump:
                rec["prose"] = sorted(prose, key=lambda t: -len(t.split()))
            out.append(rec)
            page.close()
        b.close()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--route", action="append",
                    help="audit only these routes (repeatable)")
    ap.add_argument("--dump", action="store_true",
                    help="print every prose block, longest first")
    ap.add_argument("--json", help="write the full result to this path")
    a = ap.parse_args()

    routes = a.route or ROUTES
    res = audit(a.base, routes, dump=a.dump)

    print(f"{'route':38s} {'words':>6} {'blk':>4} {'long':>5} {'ctl':>4} "
          f"{'plot':>5}  errors")
    print("-" * 84)
    for r in res:
        if "error" in r:
            print(f"{r['route']:38s} {'--':>6}  {r['error']}")
            continue
        e = f"{len(r['errors'])}" if r["errors"] else ""
        print(f"{r['route']:38s} {r['words']:>6} {r['blocks']:>4} "
              f"{r['longest']:>5} {r['controls']:>4} {r['plots']:>5}  {e}")
    live = [r for r in res if "error" not in r]
    if live:
        print("-" * 84)
        print(f"{'TOTAL':38s} {sum(r['words'] for r in live):>6} "
              f"{sum(r['blocks'] for r in live):>4}")
    if a.dump:
        for r in live:
            if not r.get("prose"):
                continue
            print(f"\n=== {r['route']} — {r['words']} words in {r['blocks']} blocks ===")
            for t in r["prose"]:
                print(f"  [{len(t.split()):>3}w] {t}")
    if a.json:
        with open(a.json, "w") as fh:
            json.dump(res, fh, indent=2)
        print(f"\nwrote {a.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
