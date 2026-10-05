#!/usr/bin/env python3
"""Map every user-visible string on the site to the file and line that holds it.

Writes heap/frontend/WHERE_TO_EDIT_TEXT.md. The point is to be able to read a
sentence on the site, find it here, and open the right line -- without knowing
any React.

The generator went missing at some point and the checked-in map went stale; this
is a rewrite (2026-10-05). It is deliberately a line scanner rather than a JSX
parser: a parser that understands the component tree would still have to guess
which props render, and a wrong guess silently drops a passage. Scanning lines
over-collects instead, which is the safe direction -- an extra row costs the
reader a second, a missing row costs them the edit.

Usage:
    python3 tools/map_copy.py            # rewrite the map
    python3 tools/map_copy.py --check    # exit 1 if the map is out of date
"""
import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'heap', 'frontend', 'src')
OUT = os.path.join(ROOT, 'heap', 'frontend', 'WHERE_TO_EDIT_TEXT.md')

# Props whose value is rendered as prose. `label` and `title` also appear on
# plot traces and buttons, which is fine -- those are words on the screen too.
TEXT_PROPS = (
    'title', 'subtitle', 'lead', 'label', 'blurb', 'what', 'placeholder',
    'helperText', 'gloss', 'summary', 'note', 'detail', 'reading', 'tests',
    'addsPlain', 'used', 'where', 'q', 'name', 'word',
)
PROP_RE = re.compile(
    r"""\b(%s)\s*[=:]\s*(?:\{\s*)?(['"])(.+?)\2""" % '|'.join(TEXT_PROPS),
    re.S,
)
# A bare quoted string sitting in an array or object -- table cells, FAQ answers.
BARE_RE = re.compile(r"""(?<![\w$.])(['"])([A-Z][^'"\\]{24,})\1""")
# JSX text: whatever sits between > and < with no braces or tags in it.
JSX_RE = re.compile(r">([^<>{}]*[A-Za-z]{3}[^<>{}]*)<")

SKIP_LINE = re.compile(r"^\s*(//|/\*|\*)")
# Paths, ids, classnames, code -- things that look like prose but are not.
NOT_PROSE = re.compile(
    r"^(https?:|gs://|/|\.|#|[a-z_]+\.(js|json|gz|tsv|py|R)$)"
    r"|^[a-z0-9_]+$"
    r"|^[A-Za-z0-9_\-/.]+$"
)


def visible_strings(path):
    """Yield (lineno, text) for everything that renders, in file order."""
    with open(path, encoding='utf-8') as fh:
        lines = fh.readlines()

    seen = set()
    out = []

    def add(lineno, text):
        text = ' '.join(text.split())
        if len(text) < 12 or NOT_PROSE.match(text):
            return
        if not re.search(r'[A-Za-z]{3}', text):
            return
        key = (lineno, text)
        if key in seen:
            return
        seen.add(key)
        out.append(key)

    in_template = False
    for i, raw in enumerate(lines, 1):
        # Skip fenced code samples: `{`...`}` blocks hold R and Python, not copy.
        ticks = raw.count('`')
        if in_template:
            if ticks % 2:
                in_template = False
            continue
        if ticks % 2:
            in_template = True
            continue
        if SKIP_LINE.match(raw):
            continue
        for m in PROP_RE.finditer(raw):
            add(i, m.group(3))
        for m in BARE_RE.finditer(raw):
            add(i, m.group(2))
        for m in JSX_RE.finditer(raw):
            add(i, m.group(1))
    return out


def route_for(rel):
    """Best-effort route label for a source file, for grouping."""
    base = os.path.basename(rel)
    doc = {
        'AboutHeap.js': '/documentation/about',
        'QuickStart.js': '/documentation/quickstart',
        'EvidenceTiers.js': '/documentation/evidence-tiers',
        'Specifications.js': '/documentation/models',
        'DataDictionary.js': '/documentation/dictionary',
        'ApiDocs.js': '/documentation/api',
        'DetailedMethods.js': '/documentation/methods',
        'Cite.js': '/documentation/cite',
        'Credits.js': '/documentation/credits',
        'FAQs.js': '/documentation/faqs',
        'Documentation.js': '/documentation',
        'Home.js': '/',
        'Downloads.js': '/downloads',
    }
    if base in doc:
        return doc[base]
    if '/pages/subpages/' in rel:
        return '/results/* — %s' % base[:-3].lower()
    if '/components/' in rel:
        return 'component — %s' % base[:-3]
    return rel


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true',
                    help='exit 1 if WHERE_TO_EDIT_TEXT.md is out of date')
    args = ap.parse_args()

    files = []
    for dirpath, _, names in os.walk(SRC):
        for nm in sorted(names):
            if nm.endswith('.js') and not nm.endswith('.test.js'):
                files.append(os.path.join(dirpath, nm))

    groups = {}
    for path in sorted(files):
        rows = visible_strings(path)
        if not rows:
            continue
        rel = os.path.relpath(path, os.path.join(ROOT, 'heap', 'frontend'))
        groups.setdefault(route_for(rel), []).append((rel, rows))

    doc_routes = sorted(k for k in groups if k.startswith('/documentation'))
    page_routes = sorted(k for k in groups if k in ('/', '/downloads')
                         or k.startswith('/results'))
    other = sorted(k for k in groups if k not in doc_routes and k not in page_routes)

    total = sum(len(r) for g in groups.values() for _, r in g)
    body = [
        '# Where to edit the website\'s text',
        '',
        'Generated by `tools/map_copy.py`. Rerun it after editing copy or moving code.',
        '',
        '**How to use this.** Find the sentence you want to change, open that file at',
        'that line, and edit the words. Nothing here needs a build step while the dev',
        'server is running; `CI=true npm run build` before committing.',
        '',
        '**Three things to know.**',
        '',
        '1. Text is often split across lines, and a line here points at where the',
        '   passage *starts*. Read the whole JSX element before editing.',
        '2. `{...}` inserts a computed value -- a count, a name, a link. Keep those',
        '   and change the words around them.',
        '3. Code samples (R, Python, shell) are skipped on purpose. Their output is',
        '   verified against the live bucket, so edit those in the source directly.',
        '',
        '**Not listed:** strings under 12 characters, bare identifiers, and anything',
        'that looks like a path or an id. Grep for the exact words to find one:',
        '`grep -rn "the words you see" --include=*.js src/`',
        '',
        f'{total} strings across {len(files)} files.',
        '',
    ]

    def emit(heading, routes):
        body.append('---')
        body.append('')
        body.append(f'# {heading}')
        body.append('')
        for route in routes:
            body.append(f'## `{route}`')
            body.append('')
            for rel, rows in groups[route]:
                body.append(f'`{rel}`')
                body.append('')
                for lineno, text in rows:
                    if len(text) > 300:
                        text = text[:297] + '...'
                    body.append(f'- **{lineno}** — {text}')
                body.append('')

    if doc_routes:
        emit('Documentation', doc_routes)
    if page_routes:
        emit('Results and landing pages', page_routes)
    if other:
        emit('Components', other)

    text = '\n'.join(body).rstrip() + '\n'

    if args.check:
        current = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if current != text:
            print('WHERE_TO_EDIT_TEXT.md is out of date; run tools/map_copy.py')
            return 1
        print('WHERE_TO_EDIT_TEXT.md is current')
        return 0

    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write(text)
    print(f'wrote {os.path.relpath(OUT, ROOT)} — {total} strings across {len(files)} files')
    return 0


if __name__ == '__main__':
    sys.exit(main())
