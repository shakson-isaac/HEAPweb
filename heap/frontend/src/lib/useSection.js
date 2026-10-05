import { useEffect, useState } from 'react';
import { getSection, getKeys, getShard, getManifest } from './heapdata';

// Small loading-state wrappers so pages read as data + markup rather than
// a pile of useEffect boilerplate. Each returns {data, loading, error}.

function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** Tier S section, columnar. */
export function useSection(sectionId) {
  return useAsync(() => getSection(sectionId), [sectionId]);
}

/** Tier K key index: {key_column, keys}. */
export function useKeys(sectionId) {
  return useAsync(() => getKeys(sectionId), [sectionId]);
}

/** Tier K shard for one key; idle until `key` is set. */
export function useShard(sectionId, key) {
  return useAsync(
    () => (key ? getShard(sectionId, key) : Promise.resolve(null)),
    [sectionId, key]
  );
}

/** The manifest entry for a section (tier, columns, arm, provenance) without
    fetching the section's data. */
export function useSectionMeta(sectionId) {
  const { data, loading, error } = useAsync(
    () => getManifest().then((m) => {
      for (const p of m.pages) {
        const s = p.sections.find((x) => x.section_id === sectionId);
        if (s) return s;
      }
      return null;
    }),
    [sectionId]
  );
  return { meta: data, loading, error };
}
