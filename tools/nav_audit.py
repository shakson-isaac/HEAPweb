#!/usr/bin/env python3
"""Walk the site the way a visitor does -- by clicking -- and measure what is
reachable, from where, and in how many clicks.

Answers questions a source grep cannot:
  * Which pages can a first-time visitor actually REACH by clicking from the
    homepage? A route that exists in the router but is linked from nowhere is
    invisible, no matter how good it is.
  * How deep is each page? Depth is clicks from the front door.
  * Which pages are dead ends -- reachable, but offering no way onward except
    Back?

Usage:
  python3 tools/nav_audit.py --base https://<preview>.web.app
  python3 tools/nav_audit.py --base ... --goal /results/mediation --goal /downloads
"""
import argparse, collections, glob, json, os, re, sys

EXE = sorted(glob.glob(
    os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome")))

# Every route the router defines. Anything here that the crawl does not reach
# is orphaned -- built, deployed, and invisible.
DEFINED = [
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

LINKS_JS = r"""
() => Array.from(document.querySelectorAll('a[href]'))
  .map(a => ({
     href: a.getAttribute('href'),
     text: (a.innerText || a.getAttribute('aria-label') || '').trim()
             .replace(/\s+/g, ' ').slice(0, 60),
     // a link buried in a footer is not the same affordance as one in the header
     where: a.closest('header, nav, [role=navigation]') ? 'nav'
          : a.closest('footer') ? 'footer' : 'body',
  }))
  .filter(l => l.href && !l.href.startsWith('http') && !l.href.startsWith('mailto:')
               && !l.href.startsWith('#'))
"""


def norm(href, cur):
    if href.startswith("/"):
        p = href
    else:
        p = os.path.normpath(os.path.join(os.path.dirname(cur + "/"), href))
    p = p.split("?")[0].split("#")[0].rstrip("/")
    return p or "/"


def crawl(base, settle=3500, max_pages=40):
    from playwright.sync_api import sync_playwright
    if not EXE:
        sys.exit("no chromium under ~/.cache/ms-playwright")
    depth = {"/": 0}
    parent = {"/": None}
    outgoing = {}
    q = collections.deque(["/"])
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE[-1], args=["--no-sandbox"])
        page = b.new_page(viewport={"width": 1440, "height": 900})
        while q and len(depth) < max_pages:
            cur = q.popleft()
            try:
                page.goto(base.rstrip("/") + cur, wait_until="networkidle",
                          timeout=60000)
                page.wait_for_timeout(settle)
                links = page.evaluate(LINKS_JS)
            except Exception as e:
                outgoing[cur] = []
                continue
            seen = {}
            for l in links:
                t = norm(l["href"], cur)
                if t not in seen:
                    seen[t] = l
                if t not in depth:
                    depth[t] = depth[cur] + 1
                    parent[t] = cur
                    q.append(t)
            outgoing[cur] = [{"to": t, **v} for t, v in seen.items() if t != cur]
        b.close()
    return depth, parent, outgoing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--json")
    a = ap.parse_args()

    depth, parent, outgoing = crawl(a.base)

    print(f"{'route':38s} {'clicks':>6}  reached via")
    print("-" * 76)
    for r in sorted(depth, key=lambda x: (depth[x], x)):
        via = parent.get(r) or "-- front door --"
        print(f"{r:38s} {depth[r]:>6}  {via}")

    orphans = [r for r in DEFINED if (r.rstrip("/") or "/") not in depth]
    print("\n" + "=" * 76)
    if orphans:
        print(f"ORPHANED -- defined in the router, reachable by clicking from nowhere ({len(orphans)}):")
        for r in orphans:
            print(f"  {r}")
    else:
        print("no orphans: every defined route is reachable by clicking")

    dead = [r for r, outs in outgoing.items()
            if len([o for o in outs if o["to"] != "/"]) == 0]
    if dead:
        print(f"\nDEAD ENDS -- nothing to click onward except home/Back ({len(dead)}):")
        for r in dead:
            print(f"  {r}")

    navlinks = outgoing.get("/", [])
    print(f"\nFRONT DOOR offers {len(navlinks)} link(s):")
    for l in sorted(navlinks, key=lambda x: x["where"]):
        print(f"  [{l['where']:6s}] {l['to']:34s} \"{l['text']}\"")

    if a.json:
        json.dump({"depth": depth, "parent": parent, "outgoing": outgoing},
                  open(a.json, "w"), indent=2)
        print(f"\nwrote {a.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
