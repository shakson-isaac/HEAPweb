#!/bin/bash
# ---------------------------------------------------------------------------
# One-line setup for anything that talks to HEAP's cloud resources.
#
#   source tools/cloud_env.sh          # authenticate + pin the project
#   source tools/cloud_env.sh --check  # just report, change nothing
#
# WHY THIS EXISTS
#
# Two failures kept recurring, both silent until they were expensive:
#
#   1. "Reauthentication required". A *user* credential on O2 expires on the
#      identity provider's schedule and needs a browser to renew. There is no
#      browser on a login node, and `gcloud auth login` through a non-interactive
#      shell dies at the paste step. A service account has neither problem.
#
#   2. The wrong project. Every HEAP resource lives in heap-4b852 --
#      gs://heap-data, Firebase Hosting, heap-ci. The machine default here is
#      cgmsy-467321, and a bucket's project CANNOT be changed after creation,
#      so a tool that reads the ambient default can put 51 GB somewhere that
#      takes a migration to undo.
#
# SETUP, ONCE
#
#   1. Get the key for heap-ci@heap-4b852 (it already holds storage.admin and
#      firebasehosting.admin). Either reuse the one in the GitHub secret
#      GCP_CREDENTIALS, or mint a fresh one:
#
#        gcloud iam service-accounts keys create ~/.config/gcloud/heap-ci.json \
#          --iam-account=heap-ci@heap-4b852.iam.gserviceaccount.com \
#          --project=heap-4b852
#
#   2. Lock it down. It is a long-lived credential to a public-facing bucket:
#
#        chmod 600 ~/.config/gcloud/heap-ci.json
#
#   3. Nothing else. This script finds it there from then on.
#
# The key must never enter a repository. .gitignore carries a rule for it, but
# the rule is a safety net, not the reason it is safe: keep it in ~/.config.
# ---------------------------------------------------------------------------

HEAP_PROJECT=${HEAP_WEB_PROJECT:-heap-4b852}
HEAP_SA_KEY=${HEAP_SA_KEY:-$HOME/.config/gcloud/heap-ci.json}
HEAP_SA_EMAIL=heap-ci@heap-4b852.iam.gserviceaccount.com

_heap_cloud_status() {
  local acct
  acct=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1)
  echo "  account : ${acct:-<none>}"
  echo "  project : $(gcloud config get-value project 2>/dev/null || echo '<unset>')  (HEAP wants $HEAP_PROJECT)"
  echo "  key file: $([[ -f $HEAP_SA_KEY ]] && echo "$HEAP_SA_KEY" || echo '<missing>')"
  if timeout 60 gcloud storage ls "gs://heap-data/" --project="$HEAP_PROJECT" >/dev/null 2>&1; then
    echo "  access  : OK -- gs://heap-data is readable"
    return 0
  fi
  echo "  access  : FAILING -- cannot read gs://heap-data"
  return 1
}

if [[ "${1:-}" == "--check" ]]; then
  echo "HEAP cloud credentials"
  _heap_cloud_status
  return 0 2>/dev/null || exit 0
fi

# Pin the project for every tool in this shell, including python clients, which
# read CLOUDSDK_CORE_PROJECT and GOOGLE_CLOUD_PROJECT rather than gcloud config.
export CLOUDSDK_CORE_PROJECT="$HEAP_PROJECT"
export GOOGLE_CLOUD_PROJECT="$HEAP_PROJECT"
export HEAP_WEB_PROJECT="$HEAP_PROJECT"

if [[ -f "$HEAP_SA_KEY" ]]; then
  # Service account: no expiry, no browser, no prompt.
  export GOOGLE_APPLICATION_CREDENTIALS="$HEAP_SA_KEY"
  if ! gcloud auth list --filter="status:ACTIVE account:$HEAP_SA_EMAIL" \
        --format="value(account)" 2>/dev/null | grep -q .; then
    gcloud auth activate-service-account --key-file="$HEAP_SA_KEY" --quiet >/dev/null 2>&1 \
      && echo "activated $HEAP_SA_EMAIL" \
      || echo "WARNING: could not activate $HEAP_SA_KEY"
  fi
else
  cat <<EOF
No service-account key at $HEAP_SA_KEY.

Falling back to whatever user credential is cached, which is what expires and
asks for a browser. To stop that happening, create the key once:

  gcloud iam service-accounts keys create $HEAP_SA_KEY \\
    --iam-account=$HEAP_SA_EMAIL --project=$HEAP_PROJECT
  chmod 600 $HEAP_SA_KEY

EOF
fi

echo "HEAP cloud credentials"
_heap_cloud_status
