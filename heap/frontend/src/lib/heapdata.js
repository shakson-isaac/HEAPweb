// Client for the HEAP website payload tree.
//
// The payload is built on O2 by tools/build_payload.py and published to a
// public GCS bucket by tools/sync_gcs.py. Objects are stored gzipped and
// labelled Content-Encoding: gzip, so the browser decompresses them for free --
// fetch().json() is all that is needed here, no client-side inflate.
//
// Two shapes live in the tree:
//   tier S  one columnar blob per section       -> getSection(id)
//   tier K  one columnar blob per key + index   -> getKeys(id), getShard(id, key)
//
// "Columnar" means {col: [v0, v1, ...]} rather than [{col: v0}, ...]; it drops
// the repeated key names, which on the large tables is most of the bytes.
// Use toRows() at the point of use if you need record shape.

const BASE = (
  process.env.REACT_APP_WEB_DATA_URL ||
  'https://storage.googleapis.com/heap-data/web/v1'
).replace(/\/$/, '');

// Promise-level cache: concurrent callers share one in-flight request, and a
// resolved entry is reused for the life of the page.
const cache = new Map();

// Entry points must never be served from a stale browser cache: everything else
// is fetched by a path named inside one, so a stale entry point makes new
// sections look missing ("unknown section X -- not in manifest") even though the
// payload is published. `cache: 'no-cache'` forces a conditional request, so the
// browser still revalidates against its copy and usually gets a cheap 304 --
// it does not mean "download every time".
//
// This matters because a TTL is sticky: a client that fetched the manifest while
// it carried max-age=3600 keeps it for an hour, whatever the header says now.
const ENTRY_POINT = /(^manifest\.json|^catalog\.json|^meta\/|_keys\.json|_index\.json)/;

// One token per page load. Entry points carry it as a query parameter, which
// no cache -- browser, proxy or CDN edge -- can serve around, so a freshly
// published section is visible on the next load rather than up to an hour
// later. Content shards are untouched and stay fully cacheable.
const LOAD_TOKEN = Math.random().toString(36).slice(2, 10);

function getJSON(path) {
  if (!cache.has(path)) {
    const entry = ENTRY_POINT.test(path);
    const url = entry ? `${BASE}/${path}?v=${LOAD_TOKEN}` : `${BASE}/${path}`;
    const init = entry ? { cache: 'no-cache' } : undefined;
    cache.set(
      path,
      fetch(url, init).then((r) => {
        if (!r.ok) {
          cache.delete(path); // let a later attempt retry
          throw new Error(`${r.status} ${r.statusText} fetching ${path}`);
        }
        return r.json();
      })
    );
  }
  return cache.get(path);
}

export function getManifest() {
  return getJSON('manifest.json.gz');
}

/** All sections declared for a page, in registry order. */
export async function getPage(page) {
  const m = await getManifest();
  const hit = m.pages.find((p) => p.page === page);
  return hit ? hit.sections : [];
}

async function findSection(sectionId) {
  const m = await getManifest();
  for (const p of m.pages) {
    const s = p.sections.find((x) => x.section_id === sectionId);
    if (s) return s;
  }
  throw new Error(
    `unknown section '${sectionId}' -- not in the published manifest. `
    + 'If it was just published, reload the page.'
  );
}

/** Tier S: the whole section as columnar data. */
export async function getSection(sectionId) {
  const s = await findSection(sectionId);
  if (s.tier !== 'S') throw new Error(`section '${sectionId}' is tier ${s.tier}; use getShard()`);
  return getJSON(s.path);
}

/** Tier K: {key_column, keys: {label -> shard filename}}. */
export async function getKeys(sectionId) {
  const s = await findSection(sectionId);
  if (s.tier !== 'K') throw new Error(`section '${sectionId}' is tier ${s.tier}; it has no keys`);
  return getJSON(s.keys_path);
}

/** Tier K: one key's slice, columnar. The key column itself is not repeated. */
export async function getShard(sectionId, key) {
  const s = await findSection(sectionId);
  const { keys } = await getKeys(sectionId);
  const fname = keys[key];
  if (!fname) throw new Error(`key '${key}' not present in section '${sectionId}'`);
  return getJSON(`${s.base}${fname}.json.gz`);
}

/** Columnar -> array of records. Only worth doing for tables and small sets. */
export function toRows(columnar) {
  const cols = Object.keys(columnar);
  if (!cols.length) return [];
  const n = columnar[cols[0]].length;
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const row = {};
    for (const c of cols) row[c] = columnar[c][i];
    out[i] = row;
  }
  return out;
}

/** Row indices kept by a predicate over the columnar data, without materializing rows. */
export function selectIndices(columnar, pred) {
  const cols = Object.keys(columnar);
  const n = cols.length ? columnar[cols[0]].length : 0;
  const keep = [];
  for (let i = 0; i < n; i += 1) if (pred(columnar, i)) keep.push(i);
  return keep;
}

/** Pull one column at the given indices. */
export function at(columnar, col, idx) {
  const v = columnar[col];
  return v ? idx.map((i) => v[i]) : [];
}

export const WEB_DATA_BASE = BASE;

/**
 * Long columnar data -> dense matrix for a heatmap.
 * Returns {x, y, z} where z[rowIndex][colIndex], with null for absent cells.
 * Row and column order follow first appearance unless `sort` is set.
 */
export function pivot(columnar, { xCol, yCol, zCol, sort = true }) {
  const xs = [...new Set(columnar[xCol])];
  const ys = [...new Set(columnar[yCol])];
  if (sort) {
    xs.sort((a, b) => String(a).localeCompare(String(b)));
    ys.sort((a, b) => String(a).localeCompare(String(b)));
  }
  const xi = new Map(xs.map((v, i) => [v, i]));
  const yi = new Map(ys.map((v, i) => [v, i]));
  const z = ys.map(() => new Array(xs.length).fill(null));
  const hits = ys.map(() => new Array(xs.length).fill(0));
  const n = columnar[zCol].length;
  // Several rows can land in one cell (many pathways share a theme). Average
  // them rather than letting the last row silently win.
  for (let i = 0; i < n; i += 1) {
    const r = yi.get(columnar[yCol][i]);
    const c = xi.get(columnar[xCol][i]);
    const v = columnar[zCol][i];
    if (v === null || v === undefined) continue;
    z[r][c] = (z[r][c] === null ? 0 : z[r][c]) + v;
    hits[r][c] += 1;
  }
  for (let r = 0; r < z.length; r += 1) {
    for (let c = 0; c < z[r].length; c += 1) if (hits[r][c] > 1) z[r][c] /= hits[r][c];
  }
  return { x: xs, y: ys, z, hits };
}

/**
 * Pivot a pairwise long table into a full square matrix.
 * Sources such as LDSC store each unordered pair once, so a plain pivot yields
 * only one triangle. The measure is symmetric, so the mirror image is the same
 * estimate rather than a new one; `diagonal` fills the self-comparison.
 */
export function pivotSymmetric(columnar, { aCol, bCol, zCol, labels, diagonal = null }) {
  const keys = [...new Set([...columnar[aCol], ...columnar[bCol]])];
  const label = new Map();
  if (labels) {
    columnar[aCol].forEach((k, i) => label.set(k, columnar[labels[0]][i]));
    columnar[bCol].forEach((k, i) => label.set(k, columnar[labels[1]][i]));
  }
  const names = keys.map((k) => label.get(k) ?? k);
  const order = names
    .map((n, i) => [n, i])
    .sort((p, q) => String(p[0]).localeCompare(String(q[0])));
  const idx = new Map();
  order.forEach(([, orig], pos) => idx.set(keys[orig], pos));
  const axis = order.map(([n]) => n);

  const z = axis.map(() => new Array(axis.length).fill(null));
  const n = columnar[zCol].length;
  for (let i = 0; i < n; i += 1) {
    const r = idx.get(columnar[aCol][i]);
    const c = idx.get(columnar[bCol][i]);
    const v = columnar[zCol][i];
    if (v === null || v === undefined) continue;
    z[r][c] = v;
    z[c][r] = v;
  }
  if (diagonal !== null) for (let i = 0; i < axis.length; i += 1) z[i][i] = diagonal;
  return { x: axis, y: axis, z };
}
