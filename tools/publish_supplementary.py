#!/usr/bin/env python3
"""Publish the supplementary data archive as individually downloadable files.

The archive ships as one 825 MB zip. A researcher who wants the smoking PES
weights should not download 825 MB to get 20 KB, so this explodes it into
per-file objects under a public prefix, keeping the whole zip and the tables
workbook alongside for anyone who does want everything.

Files are gzipped and labelled Content-Encoding: gzip, so a browser download
still writes the plain .tsv while the transfer is compressed -- the mediation
tables are ~96 MB of text each and compress roughly 5-10x.

Emits a catalog (folder -> files, sizes, columns) for the Downloads page.
"""
import argparse, csv, gzip, hashlib, io, json, os, shutil, subprocess, sys, zipfile

SRC_ZIP = "/n/groups/patel/shakson_ukb/HEAP_manuscript/HEAP_Supplementary_Data.zip"
SRC_XLSX = "/n/groups/patel/shakson_ukb/HEAP_manuscript/HEAP_Supplementary_Tables.xlsx"
STAGE = "/n/scratch/users/s/shi872/heapweb_supp"
BUCKET = "heap-web-data"
PREFIX = "supp/v1"
PROJECT = "heaptrial-a2785"


def human(n):
    return f"{n/1048576:.1f} MB" if n >= 1048576 else f"{n/1024:.0f} KB"


def stage(args):
    os.makedirs(STAGE, exist_ok=True)
    z = zipfile.ZipFile(SRC_ZIP)
    infos = [i for i in z.infolist() if not i.is_dir()]
    catalog, done = {}, 0
    for i in infos:
        rel = i.filename
        dst = os.path.join(STAGE, rel + ".gz")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not (os.path.exists(dst) and args.resume):
            with z.open(i) as fh, gzip.GzipFile(dst, "wb", compresslevel=6, mtime=0) as out:
                shutil.copyfileobj(fh, out, 1 << 20)
        folder = rel.split("/")[0] if "/" in rel else "(root)"
        entry = {"path": rel, "bytes": i.file_size, "gz_bytes": os.path.getsize(dst)}
        # column header for tabular files -- what a researcher needs before downloading 96 MB
        if rel.endswith((".tsv", ".csv")):
            with gzip.open(dst, "rt", errors="replace") as fh:
                head = fh.readline().rstrip("\n")
            entry["columns"] = head.split("\t" if rel.endswith(".tsv") else ",")
        catalog.setdefault(folder, []).append(entry)
        done += 1
        if done % 50 == 0:
            print(f"    staged {done}/{len(infos)}", flush=True)
    print(f"  staged {done} files")
    return catalog


def upload(args):
    cmd = ["gcloud", "storage", "rsync", STAGE, f"gs://{BUCKET}/{PREFIX}",
           "--recursive", "--project", PROJECT,
           "--content-encoding=gzip", "--cache-control=public, max-age=3600"]
    if args.prune:
        cmd.append("--delete-unmatched-destination-objects")
    print("  $ " + " ".join(cmd), flush=True)
    return subprocess.call(cmd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--resume", action="store_true", help="skip files already staged")
    ap.add_argument("--prune", action="store_true")
    ap.add_argument("--stage-only", action="store_true")
    args = ap.parse_args()

    print(f"staging {SRC_ZIP} -> {STAGE}")
    catalog = stage(args)

    tot = sum(e["bytes"] for v in catalog.values() for e in v)
    gz = sum(e["gz_bytes"] for v in catalog.values() for e in v)
    print(f"\n  {sum(len(v) for v in catalog.values())} files  "
          f"{human(tot)} raw -> {human(gz)} gzipped")
    for f, v in sorted(catalog.items()):
        print(f"    {f:34s} {len(v):4d} files  {human(sum(e['bytes'] for e in v))}")

    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "build", "web", "v1", "supp_catalog.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    body = json.dumps({"prefix": PREFIX, "folders": catalog},
                      separators=(",", ":")).encode()
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9, mtime=0) as f:
        f.write(body)
    blob = buf.getvalue()
    out += ".gz"
    with open(out, "wb") as fh:
        fh.write(blob)

    # sync_gcs.py verifies the payload tree against the UNION of build/web/manifest*.tsv
    # and refuses anything it cannot account for, so this file needs its own ledger.
    ledger = os.path.join(os.path.dirname(os.path.dirname(out)), "manifest_supp.tsv")
    with open(ledger, "w") as fh:
        fh.write("path\tsha256\tbytes\traw_bytes\n")
        fh.write(f"supp_catalog.json.gz\t{hashlib.sha256(blob).hexdigest()}"
                 f"\t{len(blob)}\t{len(body)}\n")
    print(f"  catalog -> {out}  ({len(blob)/1024:.0f} KB gz)")
    print(f"  ledger  -> {ledger}")

    if args.stage_only:
        print("  --stage-only: nothing uploaded")
        return
    if upload(args) != 0:
        sys.exit("upload failed")
    print(f"\n  published to gs://{BUCKET}/{PREFIX}/")


if __name__ == "__main__":
    main()
