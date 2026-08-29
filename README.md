# HEAPweb

Companion website for **HEAP** — the Human Exposome-Associated Proteome — an analysis
of how lifestyle exposures, genetics, and their interactions shape the plasma proteome
in UK Biobank.

Preprint: https://doi.org/10.1101/2025.05.07.25327178

## Layout

```
heap/backend/     Flask API on Cloud Run: legacy blob serving + paginated Cloud SQL tables
heap/frontend/    React app on Firebase Hosting
tools/            Result payload pipeline (runs on O2, where the analysis output lives)
docs/             DATA_PIPELINE.md — how results reach the site
```

## How a result reaches the site

Analysis output lives on the O2 cluster and is **not** in this repo. `tools/build_payload.py`
packs HEAP's figure exports into small sharded JSON, and `tools/sync_gcs.py` publishes them
to a public GCS bucket that the browser reads directly. See
[`docs/DATA_PIPELINE.md`](docs/DATA_PIPELINE.md) for the full picture, including why the
packing step runs on O2 rather than in CI or Cloud Run.

```bash
python3 tools/build_payload.py      # figures/website/*.json  ->  build/web/v1/**
python3 tools/sync_gcs.py --prune   # build/web/v1/**  ->  gs://heap-data/web/v1/**
```

## Deployment

| workflow | trigger | target |
|----------|---------|--------|
| `deploy-backend.yml` | `heap/backend/**` | Cloud Run `flask-backend` (+ Cloud SQL) |
| `deploy-firebase.yml` | `heap/frontend/**` | Firebase Hosting |

Data is published from O2, not by CI — GitHub runners cannot see the analysis output.

## Local development

```bash
cd heap/frontend
npm install
cp .env.example .env      # point at a backend and the payload bucket
npm start
```
