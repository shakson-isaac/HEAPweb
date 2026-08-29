#!/usr/bin/env python3
"""Walk the site the way a visitor does -- by clicking -- and measure what is
reachable, from where, and in how many clicks.

CRAWLS TWO KINDS OF AFFORDANCE. Real <a href> anchors, and click-driven menu
items -- MUI `MenuItem onClick={() => navigate(...)}` renders no anchor at all,
so an anchor-only crawl reports those destinations as unreachable when they are
two clicks away. The first version of this tool did exactly that and produced a
false "14 of 24 routes are orphaned" headline. Anything that navigates counts.

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

# Menu triggers: anything that opens a popup. Opening each one and reading its
# items is the only way to see destinations that exist solely as click handlers.
TRIGGERS_JS = r"""
() => {
  // The header's dropdown triggers are bare <div>s with an onClick handler --
  // no <a>, no role, no aria-haspopup, nothing a crawler can key on. The only
  // signal left in the DOM is that they are styled clickable. That absence is
  // itself an accessibility finding, reported separately.
  const hdr = document.querySelector('header') || document.body;
  const seen = new Set();
  return Array.from(hdr.querySelectorAll('div, span, button'))
    .filter(e => getComputedStyle(e).cursor === 'pointer')
    .filter(e => !e.closest('a'))
    .map(e => (e.innerText || '').trim().split('\n')[0].replace(/[\u25bc\u25be\s]+$/, ''))
    .filter(t => {
       if (!t || t.length > 32 || seen.has(t)) return false;
       seen.add(t); return true;
    });
}
"""

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



_MENU_CACHE = None


def menu_destinations(page, base, cur):
    """Open every popup trigger and record where its items actually navigate.

    These have no href, so the only honest way to learn a destination is to
    click the item and read the resulting URL. That is slow -- each item costs
    a navigation and a trip back -- so it is done ONCE and reused: the header
    is global, identical on every page. Doing it per page timed out the crawl.
    """
    global _MENU_CACHE
    if _MENU_CACHE is not None:
        return list(_MENU_CACHE)
    out = []
    try:
        triggers = page.evaluate(TRIGGERS_JS)
    except Exception:
        return out
    for label in triggers:
        try:
            page.click(f"text={label}", timeout=4000)
            page.wait_for_timeout(500)
            items = page.eval_on_selector_all(
                "[role=menuitem]", "els => els.map(e => e.innerText.trim())")
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
        except Exception:
            continue
        for it in items:
            if not it:
                continue
            try:
                page.click(f"text={label}", timeout=3000)
                page.wait_for_timeout(400)
                page.click(f"[role=menuitem]:has-text({it!r})", timeout=3000)
                page.wait_for_timeout(900)
                dest = page.url.replace(base.rstrip("/"), "").split("?")[0] or "/"
                out.append({"href": dest, "text": it, "where": "menu"})
                page.goto(base.rstrip("/") + cur, wait_until="networkidle",
                          timeout=45000)
                page.wait_for_timeout(1200)
            except Exception:
                continue
    _MENU_CACHE = out
    return list(out)


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
                links += menu_destinations(page, base, cur)
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
