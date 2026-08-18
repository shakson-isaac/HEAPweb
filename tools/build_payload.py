#!/usr/bin/env python3
"""Pack HEAP website exports into small, shardable, gzipped payloads.

Reads the tidy JSON that HEAP's `heap_export_website()` writes to
`<figures>/website/<figure_id>.json` and emits a browser-ready payload tree:

    <out>/manifest.json          index the frontend fetches first
    <out>/manifest.tsv           relpath / sha256 / bytes  (sync_gcs.py reads this)
    <out>/s/<section>.json.gz            tier S: one columnar blob per section
    <out>/k/<section>/_keys.json.gz      tier K: key -> shard filename
    <out>/k/<section>/<key>.json.gz      tier K: one columnar blob per key

Two encodings do the heavy lifting:
  * columnar  {"col":[v, ...]} instead of [{"col":v}, ...]  -- drops the repeated
    key names, which on a 1.2M-row table is most of the bytes.
  * sharding  one object per key, so a page fetches only the protein it renders.

Runs on O2, where figures/website/ lives. It cannot run in CI -- the source data
is not in the repo.
"""
import argparse
import gzip
import hashlib
import io
import json
import math
import os
import re
import sys
from collections import OrderedDict, defaultdict

DEFAULT_SOURCE = "/n/groups/patel/IGLOO/UKB/HEAP/figures/website"
SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize(key):
    """Filesystem/URL-safe shard filename. The real key stays in _keys.json."""
    s = SAFE.sub("-", str(key)).strip("-")
    return s or "_blank"


def clean(v):
    """JSON-legal scalar. NaN/Inf are valid Python json but *invalid* JSON --
    a browser's JSON.parse() rejects them, so they must become null."""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


# R's exporters sometimes emit a numeric or logical column as character, so a
# column can arrive as ["0.0934", "1.2537"] or ["True", "False"]. Left alone
# those sort lexically ("10" < "9") and Plotly reads them as categories, so a
# whole-column type is recovered here -- once, at pack time.
_BOOL = {"TRUE": True, "FALSE": False, "True": True, "False": False}


def _retype(values):
    """Recover a column's type, but only when EVERY non-null value agrees.

    Leading zeros ("007") and leading '+' are left as strings: they are
    identifiers whose text form carries meaning, not quantities."""
    seen = [v for v in values if v is not None and v != ""]
    if not seen or not all(isinstance(v, str) for v in seen):
        return values

    if all(v in _BOOL for v in seen):
        return [None if v is None or v == "" else _BOOL[v] for v in values]

    for v in seen:
        t = v[1:] if v[:1] == "-" else v
        if t[:1] == "+" or (len(t) > 1 and t[0] == "0" and t[1].isdigit()):
            return values
        try:
            float(v)
        except ValueError:
            return values
    out = []
    for v in values:
        if v is None or v == "":
            out.append(None)
        else:
            f = float(v)
            out.append(int(f) if f.is_integer() and abs(f) < 2**53 else f)
    return out


def to_columnar(records, cols, drop=None):
    drop = drop or set()
    return OrderedDict(
        (c, _retype([clean(r.get(c)) for r in records]))
        for c in cols
        if c not in drop
    )


def dumps(obj):
    # allow_nan=False makes a stray NaN a loud error instead of invalid JSON
    return json.dumps(obj, separators=(",", ":"), allow_nan=False).encode("utf-8")


def gzip_bytes(raw):
    """Deterministic gzip: mtime=0 so identical data hashes identically across
    runs. Without this every rebuild would look changed and re-upload the world."""
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9, mtime=0) as f:
        f.write(raw)
    return buf.getvalue()


class Writer:
    def __init__(self, out, gz=True):
        self.out, self.gz = out, gz
        self.entries = []

    def write(self, relpath, obj):
        raw = dumps(obj)
        if self.gz:
            relpath += ".gz"
            body = gzip_bytes(raw)
        else:
            body = raw
        path = os.path.join(self.out, relpath)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(body)
        self.entries.append(
            {
                "path": relpath,
                "sha256": hashlib.sha256(body).hexdigest(),
                "bytes": len(body),
                "raw_bytes": len(raw),
            }
        )
        return len(body)


def read_config(path):
    rows = []
    with open(path) as f:
        header = f.readline().rstrip("\n").split("\t")
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            rows.append(dict(zip(header, line.split("\t"))))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(os.path.dirname(__file__), "web_sections.tsv"))
    ap.add_argument("--source", default=os.environ.get("HEAP_WEBSITE_DIR", DEFAULT_SOURCE))
    ap.add_argument("--out", default=None, help="default: <repo>/build/web/v1")
    ap.add_argument("--only", action="append", help="section_id or page to build (repeatable)")
    ap.add_argument("--no-gzip", action="store_true")
    args = ap.parse_args()

    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = args.out or os.path.join(repo, "build", "web", "v1")
    os.makedirs(out, exist_ok=True)

    cfg = read_config(args.config)
    w = Writer(out, gz=not args.no_gzip)

    pages = OrderedDict()
    skipped, missing = [], []
    src_total = 0

    for row in cfg:
        sid, page = row["section_id"], row["page"]
        if row.get("status", "on") != "on":
            skipped.append((sid, "status=" + row.get("status", "")))
            continue
        if args.only and sid not in args.only and page not in args.only:
            continue

        src = os.path.join(args.source, row["source_figure"] + ".json")
        if not os.path.exists(src):
            missing.append((sid, row["source_figure"]))
            continue

        src_bytes = os.path.getsize(src)
        src_total += src_bytes
        with open(src) as f:
            records = json.load(f)
        if not isinstance(records, list) or not records:
            missing.append((sid, row["source_figure"] + " (empty)"))
            continue

        # union of keys, first-seen order -- R can emit ragged records
        cols = list(OrderedDict((c, None) for r in records for c in r.keys()))
        key_col = (row.get("key_column") or "").strip()
        tier = row.get("tier", "S").strip().upper()

        entry = {
            "section_id": sid,
            "title": row.get("title", sid),
            "chart_hint": row.get("chart_hint", ""),
            "source_figure": row["source_figure"],
            "tier": tier,
            "columns": cols,
            "n_rows": len(records),
        }

        if tier == "K" and key_col:
            if key_col not in cols:
                print(f"  !! {sid}: key_column '{key_col}' not in {cols}", file=sys.stderr)
                missing.append((sid, "bad key_column"))
                continue
            groups = defaultdict(list)
            for r in records:
                groups[r.get(key_col)].append(r)

            keys, used, total = OrderedDict(), {}, 0
            for k in sorted(groups, key=lambda x: (x is None, str(x))):
                fname = sanitize(k)
                if fname in used and used[fname] != k:  # collision after sanitizing
                    fname = f"{fname}-{hashlib.sha1(str(k).encode()).hexdigest()[:6]}"
                used[fname] = k
                keys[str(k)] = fname
                total += w.write(
                    f"k/{sid}/{fname}.json",
                    to_columnar(groups[k], cols, drop={key_col}),
                )
            w.write(f"k/{sid}/_keys.json", {"key_column": key_col, "keys": keys})
            entry.update(key_column=key_col, n_keys=len(keys),
                         base=f"k/{sid}/", keys_path=f"k/{sid}/_keys.json")
            print(f"  [K] {sid:28s} {src_bytes/1048576:8.1f} MB -> "
                  f"{len(keys):5d} shards, {total/1048576:6.2f} MB "
                  f"({total/len(keys)/1024:.1f} KB each)")
        else:
            n = w.write(f"s/{sid}.json", to_columnar(records, cols))
            entry["path"] = f"s/{sid}.json"
            print(f"  [S] {sid:28s} {src_bytes/1048576:8.1f} MB -> {n/1024:8.1f} KB")

        pages.setdefault(page, []).append(entry)

    if w.gz:  # record the .gz suffix the client must request
        for secs in pages.values():
            for e in secs:
                for f in ("path", "keys_path"):
                    if f in e:
                        e[f] += ".gz"

    manifest = {"version": "v1", "gzipped": w.gz,
                "pages": [{"page": p, "sections": s} for p, s in pages.items()]}
    w.write("manifest.json", manifest)

    # Ledger of what was built. Lives OUTSIDE the synced tree: it is the record
    # committed to git, not an asset the browser fetches.
    ledger = os.path.join(os.path.dirname(out.rstrip("/")), "manifest.tsv")
    with open(ledger, "w") as f:
        f.write("path\tsha256\tbytes\traw_bytes\n")
        for e in sorted(w.entries, key=lambda x: x["path"]):
            f.write(f"{e['path']}\t{e['sha256']}\t{e['bytes']}\t{e['raw_bytes']}\n")

    out_total = sum(e["bytes"] for e in w.entries)
    print(f"\n  objects   {len(w.entries):,}")
    print(f"  source    {src_total/1048576:,.1f} MB")
    print(f"  payload   {out_total/1048576:,.1f} MB"
          + (f"   ({src_total/out_total:.0f}x smaller)" if out_total else ""))
    print(f"  out       {out}")
    if skipped:
        print("  skipped (status off): " + ", ".join(s for s, _ in skipped))
    if missing:
        print("  NOT EXPORTED BY HEAP -- rerun build_figures.R for these:")
        for sid, fig in missing:
            print(f"    {sid:28s} <- {fig}")


if __name__ == "__main__":
    main()
