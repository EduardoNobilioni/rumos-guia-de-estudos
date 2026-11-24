const cache = new Map();
let manifest = null;

export function getManifest() { return manifest; }
export function catalog() {
  return manifest?.tracks || [];
}

export async function loadIndex() {
  if (manifest) return manifest;
  const response = await fetch(new URL('../data/tracks/index.json', import.meta.url));
  if (!response.ok) throw new Error('Não achei a lista de trilhas.');
  manifest = await response.json();
  return manifest;
}

export function trackEntry(id) {
  return catalog().find((entry) => entry.id === id) || null;
}

export async function loadTrack(id) {
  if (!id) return null;
  if (cache.has(id)) return cache.get(id);
  await loadIndex();
  const entry = trackEntry(id);
  if (!entry) return null;
  const response = await fetch(new URL(`../data/tracks/${entry.file}`, import.meta.url));
  if (!response.ok) throw new Error(`Não encontrei ${entry.file}.`);
  const data = await response.json();
  const track = {
    ...data,
    group: entry.group,
    keywords: entry.keywords || [],
    name: data.name || entry.name,
    tagline: data.tagline || entry.tagline || '',
    abbr: entry.abbr,
  };
  cache.set(id, track);
  return track;
}

export async function loadTracks(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  return Promise.all(unique.map((id) => loadTrack(id)));
}

export async function loadAllTracks() {
  await loadIndex();
  return loadTracks(catalog().map((entry) => entry.id));
}

export function cachedTrack(id) { return cache.get(id) || null; }
export function cachedTracks() { return [...cache.values()]; }
