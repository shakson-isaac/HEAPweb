#!/bin/bash
# ---------------------------------------------------------------------------
# Publish the exposure GWAS summary statistics to a REQUESTER-PAYS bucket.
#
#   gs://heap-gwas/   169 files + indexes, 51 GB, requester pays
#
# WHO PAYS WHAT
#   storage   51 GB x $0.020/GB/mo   = ~$1.02/month, ours
#   egress    every byte             = the reader's project, ~$0.12/GB
#
# WHY NOTHING IS ON THE PUBLIC BUCKET. A public copy would be free to take --
# `gcloud storage cp -r` against a public prefix pulls all 51 GB on our bill,
# and GCS has no per-bucket egress cap to stop it. Folders do not help: a
# "folder" is part of an object's name, not a permission boundary, and Requester
# Pays is a bucket-wide setting with no prefix form. So the only way to make the
# reader pay is for the files to exist nowhere else.
#
# THE PRICE OF THAT CHOICE. Requester-pays requires an authenticated request
# carrying a billing project, so:
#   * no browser download links, and no anonymous curl;
#   * no tabix-over-HTTPS region queries (the reader indexes locally instead);
#   * no anonymous file listing -- which is why the CATALOG is published
#     separately, as meta/gwas_manifest.json on the public payload (4.4 KB).
#     tools/build_catalog.py --only gwas writes it; the Downloads page renders
#     the table and the commands from it.
#
# Nothing here runs without `gcloud auth login` first. Read it, then run it.
# ---------------------------------------------------------------------------
set -euo pipefail

DEPOSIT=${HEAP_DEPOSIT_OUT:-/n/groups/patel/IGLOO/UKB/HEAP/output/gwas_deposit}
BUCKET=${HEAP_GWAS_BUCKET:-gs://heap-gwas}

# THE PROJECT IS NAMED HERE, NOT TAKEN FROM gcloud config. Every HEAP cloud
# resource lives in heap-4b852: gs://heap-data, Firebase Hosting, and the
# heap-ci service account. A workstation's default project is often something
# else entirely -- on O2 it is cgmsy-467321 -- and a bucket's project cannot be
# changed after creation, so reading the ambient default would silently split
# the resource across two bills and two IAM policies. docs/WEB_PUNCHLIST.md
# records the August cleanup that undid exactly that split; this is how it stays
# undone.
PROJECT=${HEAP_WEB_PROJECT:-heap-4b852}
ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
if [[ "$ACTIVE_PROJECT" != "$PROJECT" ]]; then
  echo "note: gcloud default project is '$ACTIVE_PROJECT'; publishing to '$PROJECT' instead."
fi

echo "deposit : $DEPOSIT"
echo "bucket  : $BUCKET (requester pays)"
echo "project : $PROJECT"
echo

# --- 0. refuse to publish a partial set -------------------------------------
n_bgz=$(find "$DEPOSIT" -name '*.tsv.bgz' | wc -l)
n_tbi=$(find "$DEPOSIT" -name '*.tsv.bgz.tbi' | wc -l)
n_src=$(find /n/groups/patel/IGLOO/UKB/HEAP/output/gwas/regenie_step2 -name '*.regenie' | wc -l)
echo "files: $n_bgz bgz, $n_tbi index, against $n_src source GWAS"
[[ "$n_bgz" == "$n_src" && "$n_tbi" == "$n_src" ]] || {
  echo "REFUSING: the deposit is incomplete. Publishing a partial set would put"
  echo "a silently truncated resource behind a permanent URL."; exit 1; }
[[ -f "$DEPOSIT/manifest.tsv" ]] || { echo "REFUSING: no manifest.tsv (run --finalize)"; exit 1; }

# --- 1. the bucket -----------------------------------------------------------
if ! gcloud storage buckets describe "$BUCKET" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud storage buckets create "$BUCKET" \
    --location=US --uniform-bucket-level-access --project="$PROJECT"
fi
gcloud storage buckets update "$BUCKET" --requester-pays --project="$PROJECT"
# Readable by anyone who brings a billing project. Without this line the files
# are private; with it, they are public but never free.
gcloud storage buckets add-iam-policy-binding "$BUCKET" \
  --member=allUsers --role=roles/storage.objectViewer --project="$PROJECT"

# --- 2. upload ---------------------------------------------------------------
# Writing to a requester-pays bucket needs a billing project even as the owner.
gcloud storage rsync "$DEPOSIT" "$BUCKET" \
  --recursive --exclude='\.manifest_parts.*' \
  --billing-project="$PROJECT"

# --- 3. the public catalog ---------------------------------------------------
# The site cannot list the bucket, so it reads this instead. Rebuild it from the
# manifest the array left behind, then sync the payload as usual.
python3 "$(dirname "$0")/build_catalog.py" --only gwas
echo
echo "Now sync the payload so the site picks up meta/gwas_manifest.json:"
echo "  python3 tools/sync_gcs.py        # or whatever the usual payload sync is"

cat <<USAGE

Published. What a reader runs:

  One exposure:
    gcloud storage cp $BUCKET/ever_smoked_f20160_0_0.tsv.bgz . --billing-project=THEIR_PROJECT

  Everything (51 GB, billed to them):
    gcloud storage cp -r $BUCKET/ . --billing-project=THEIR_PROJECT

  Then, locally, one locus without reading the whole file:
    tabix ever_smoked_f20160_0_0.tsv.bgz 19:44900000-44920000

USAGE
