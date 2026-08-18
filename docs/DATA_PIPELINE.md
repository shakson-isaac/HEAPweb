# HEAP website data pipeline

How results get from the analysis on O2 onto the site. Two halves that meet at GCS.

```
O2  (data lives here)                          GCP / GitHub  (code lives here)
──────────────────────────────────             ─────────────────────────────────
R: heap_export_website()                       push heap/backend/**
  -> HEAP/figures/website/*.json                 -> deploy-backend.yml
     128 figures, 1.1 GB                         -> Cloud Run  flask-backend
        |
        |  tools/build_payload.py               push heap/frontend/**
        v                                         -> deploy-firebase.yml
     build/web/v1/**   20.5 MB                    -> Firebase Hosting
        |
        |  tools/sync_gcs.py
        v
  gs://heap-web-data/web/v1/**  (public, CORS)  <──  browser fetches shards directly
```

## Why the packer runs on O2 and not in CI or Cloud Run

Its input is `HEAP/figures/website/`, which lives on O2 and is not in this repo.
A GitHub runner and a Cloud Run container can both see the code but neither can
see that directory. Moving the input to the cloud first would mean uploading
1.1 GB in order to produce 20.5 MB -- 13x more transfer to reach the same result.
The packing *is* the size reduction, so it happens where the data already is.

## Payload layout

| tier | what | where | per request |
|------|------|-------|-------------|
| S | one columnar blob per section | `s/<section>.json.gz` | 0.2 - 39 KB |
| K | one blob per key + a key index | `k/<section>/<key>.json.gz` | 4 - 20 KB |

"Columnar" is `{"col": [v0, v1, ...]}` rather than `[{"col": v0}, ...]`: on a
1.2M-row table the repeated key names are most of the bytes. Sharding then means
a page fetches only the protein it is rendering, instead of the whole table.

Objects are stored gzipped and labelled `Content-Encoding: gzip`, so the browser
inflates them natively -- `fetch().json()` is all the client does.

## Running it

```bash
python3 tools/build_payload.py                 # all sections in web_sections.tsv
python3 tools/build_payload.py --only causal   # one page, or --only <section_id>
python3 tools/sync_gcs.py --dry-run            # verify, print the rsync, upload nothing
python3 tools/sync_gcs.py --prune              # upload; drop objects no longer built
```

`build_payload.py` gzips with `mtime=0`, so unchanged shards hash identically
between runs and rsync skips them: re-syncing after a one-figure change uploads
one object, not 2,727.

`sync_gcs.py` refuses to run if the built tree does not match
`build/web/manifest.tsv` (a half-finished build cannot be published) or if
`--prefix` points anywhere outside the payload prefix (a typo plus `--prune`
would otherwise delete the legacy `data/` tree).

## Adding a result

1. Give the figure `website_export = yes` in
   `HEAP/config/figures/figure_registry.tsv`, and re-run its plotter so
   `figures/website/<figure_id>.json` exists.
2. Add a row to `tools/web_sections.tsv` (`page`, `section_id`, `source_figure`,
   `tier`, `key_column`, `title`, `chart_hint`, `status`).
3. `python3 tools/build_payload.py && python3 tools/sync_gcs.py --prune`
4. Render it: `<TableSection section="..." />` needs nothing further; a bespoke
   chart goes in the page component under `heap/frontend/src/pages/subpages/`.

Set `status` to anything other than `on` to build the site without a section.
`build_payload.py` prints any configured section whose source figure HEAP has
not exported yet, so a stale registry is visible rather than silent.

## Storage

| bucket | contents | access |
|--------|----------|--------|
| `gs://heap-web-data` | `web/v1/**` sharded payloads | public read + CORS |
| `gs://heaptester135` | legacy `data/**` (per-protein HTML, download CSVs) | private, via Flask |

Result data is not committed to git. `.gitignore:12` (`data/`) and `:24`
(`build/`) already cover both trees; `build/web/manifest.tsv` is the committed
record of what was published.
