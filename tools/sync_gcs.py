#!/usr/bin/env python3
"""Push a built payload tree to GCS, idempotently.

Wraps `gcloud storage rsync`, which already does parallel transfer and
size/checksum change-detection. This adds the parts rsync will not do for you:

  * refuses to touch a prefix that is not the payload prefix (a typo'd
    --prefix with --prune would otherwise delete the legacy data/ tree)
  * verifies the local tree against build/web/manifest.tsv before uploading,
    so a half-finished build cannot be published
  * stamps every object with the headers the browser needs, uniformly:
    Content-Encoding: gzip + Content-Type: application/json

Because build_payload.py gzips with mtime=0, unchanged shards hash identically
run to run and rsync skips them -- a re-sync after a one-figure change uploads
one file, not 2,727.

Run from O2, where the payload is built. Requires an authenticated gcloud.
"""
import argparse
import glob
import hashlib
import json


def full_of(src, rel):
    return os.path.join(src, rel)
import os
import subprocess
import sys

RESERVED = {"", "/", "data", "data/"}  # legacy tree -- never a sync target


def sh(cmd, dry=False):
    print("  $ " + " ".join(cmd))
    if dry:
        return 0
    return subprocess.call(cmd)


def verify(src, ledgers, verify_all=False, prune=False):
    """Every file the ledgers claim must exist with the right hash, and the
    tree must contain nothing the ledgers know nothing about.

    The payload is built by several tools that each own part of the tree
    (build_payload.py, build_entities.py, build_catalog.py), so each writes its
    own ledger and the union is what describes a publishable tree. Verifying
    against only one would reject everything the others built."""
    missing_ledgers = [l for l in ledgers if not os.path.exists(l)]
    if missing_ledgers or not ledgers:
        sys.exit("no ledger found (%s) -- run the build tools first"
                 % (", ".join(missing_ledgers) or "none matched"))
    expect = {}
    for ledger in ledgers:
        with open(ledger) as f:
            next(f)
            for line in f:
                path, sha, nbytes, _raw = line.rstrip("\n").split("\t")
                if path in expect and expect[path] != (sha, int(nbytes)):
                    sys.exit(f"ledgers disagree about {path} -- two tools wrote it")
                expect[path] = (sha, int(nbytes))

    on_disk = set()
    # WHAT MAKES A FILE "ALREADY VERIFIED". The ledger carries a sha256 the
    # PACKER computed as it wrote each file, and the packer rewrites the ledger
    # on every run. So if a file's ledger hash is the same one we verified
    # against last time, it is the same file -- no stat, no read, no walk.
    #
    # An earlier attempt stat-ed all 20,749 files to compare size and mtime.
    # That is 20,749 NFS round trips and it did not finish in ten minutes: the
    # enumeration cost as much as the hashing it was meant to replace. This
    # compares two strings already in memory.
    #
    # A file corrupted on disk WITHOUT the ledger changing would slip through.
    # --verify-all forces a full re-hash for when that matters.
    vpath = os.path.join(os.path.dirname(src.rstrip("/")), ".sync_verify_cache.json")
    try:
        with open(vpath) as fh:
            verified = json.load(fh)
    except Exception:
        verified = {}
    if verify_all:
        verified = {}
    fresh = {}
    hashed = 0

    bad = []
    for path, (sha, nbytes) in expect.items():
        if verified.get(path) == sha:
            fresh[path] = sha
            continue
        full = os.path.join(src, path)
        if not os.path.exists(full):
            bad.append(f"missing: {path}")
            continue
        if os.path.getsize(full) != nbytes:
            bad.append(f"size differs: {path}")
            continue
        h = hashlib.sha256(open(full, "rb").read()).hexdigest()
        hashed += 1
        if h != sha:
            bad.append(f"sha256 differs: {path}")
        else:
            fresh[path] = sha

    # Files on disk that the ledger does not know about only matter when we are
    # about to prune. Walking the tree to find them costs 20,749 stats.
    if prune:
        for root, _dirs, files in os.walk(src):
            for fn in files:
                rel = os.path.relpath(os.path.join(root, fn), src)
                if rel not in expect:
                    bad.append(f"not in ledger: {rel}")

    if bad:
        print("  payload does not match its ledger:", file=sys.stderr)
        for b in bad[:20]:
            print("    " + b, file=sys.stderr)
        if len(bad) > 20:
            print(f"    ... and {len(bad)-20} more", file=sys.stderr)
        sys.exit("refusing to sync a payload that does not match its ledger")

    # Written only when the payload verified clean.
    try:
        with open(vpath, "w") as fh:
            json.dump(fresh, fh)
    except OSError:
        pass

    total = sum(n for _s, n in expect.values())
    print(f"  verified {len(expect):,} objects, {total/1048576:.1f} MB "
          f"({hashed:,} re-hashed, {len(expect)-hashed:,} unchanged since the last publish)")
    return len(expect), total, [{"path": p} for p in sorted(expect)]


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    ap = argparse.ArgumentParser()
    ap.add_argument("--bucket", default=os.environ.get("HEAP_WEB_BUCKET", "heap-web-data"))
    ap.add_argument("--prefix", default="web/v1")
    ap.add_argument("--src", default=os.path.join(repo, "build", "web", "v1"))
    ap.add_argument("--ledger", action="append", default=None,
                    help="repeatable; default = every build/web/manifest*.tsv")
    ap.add_argument("--project", default=os.environ.get("HEAP_WEB_PROJECT", "heaptrial-a2785"))
    ap.add_argument("--cache-control", default="public, max-age=3600",
                    help="TTL for content shards")
    ap.add_argument("--index-cache-control", default="public, max-age=60",
                    help="TTL for entry-point objects (manifests, key indexes)")
    ap.add_argument("--prune", action="store_true",
                    help="delete destination objects absent from the payload (stale shards)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verify-all", action="store_true",
                    help="re-hash every object instead of trusting ledger hashes "
                         "already verified by a previous clean sync")
    args = ap.parse_args()

    prefix = args.prefix.strip().strip("/")
    if prefix in RESERVED or prefix.split("/")[0] == "data":
        sys.exit(f"refusing to sync to reserved prefix '{args.prefix}'")
    if not os.path.isdir(args.src):
        sys.exit(f"no payload at {args.src} -- run build_payload.py first")

    dest = f"gs://{args.bucket}/{prefix}"
    print(f"payload {args.src}\n     -> {dest}\n")
    ledgers = args.ledger or sorted(
        glob.glob(os.path.join(repo, "build", "web", "manifest*.tsv")))
    print("  ledgers: " + ", ".join(os.path.basename(l) for l in ledgers))
    n, total, ledger_entries = verify(args.src, ledgers,
                                      verify_all=args.verify_all, prune=args.prune)

    cmd = [
        "gcloud", "storage", "rsync", args.src, dest,
        "--recursive",
        "--project", args.project,
        "--content-encoding=gzip",
        "--content-type=application/json",
        f"--cache-control={args.cache_control}",
    ]
    if args.prune:
        cmd.append("--delete-unmatched-destination-objects")
    else:
        print("  (no --prune: stale objects at the destination are left in place)")

    rc = sh(cmd, dry=args.dry_run)
    if rc != 0:
        sys.exit(f"rsync failed with exit {rc}")
    if args.dry_run:
        print("\n  dry run -- nothing uploaded")
        return

    # Entry points get a short TTL. Everything is fetched by a path named in one
    # of these, so if they are stale the whole payload looks stale -- a republish
    # would otherwise take a full hour to become visible, which reads as a bug.
    index_objects = [
        f"{dest}/{e['path']}" for e in ledger_entries
        if os.path.basename(e["path"]).startswith(("_keys", "_index", "manifest", "catalog"))
        or e["path"].startswith("meta/")
    ]
    if index_objects:
        print(f"\n  re-stamping {len(index_objects)} entry-point object(s) "
              f"with '{args.index_cache_control}'")
        rc2 = sh(["gcloud", "storage", "objects", "update",
                  "--project", args.project,
                  f"--cache-control={args.index_cache_control}"] + index_objects,
                 dry=args.dry_run)
        if rc2 != 0:
            print("  WARNING: entry points kept the long TTL; a republish may take "
                  f"up to the content TTL to become visible", file=sys.stderr)

    print(f"\n  synced {n:,} objects ({total/1048576:.1f} MB) to {dest}")
    print(f"  manifest: {dest}/manifest.json.gz")


if __name__ == "__main__":
    main()
