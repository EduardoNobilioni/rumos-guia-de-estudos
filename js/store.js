import { STORAGE_KEY, emptyState, normalizeState, readStoredJson, stateFromLegacyStorage, LEGACY_STORAGE_KEY } from './model.js';

export const session = {
  search: '',
  filter: 'all',
  viewMode: 'map',
  combinedView: false,
  detailTopicId: null,
  detailSourceTrackId: null,
  resourceLang: 'all',
  resourceKind: 'all',
  openNotes: {},
  openLinkForms: {},
  openPhaseNotes: {},
  dialogResources: [],
  sidebarQuery: '',
  openGroups: {},
  onboarding: {
    step: 0,
    trackId: null,
    level: null,
    hours: 8,
    mode: 'create',
    companionIds: [],
    query: '',
    backendLanguageId: null,
    backendEcosystemIds: [],
    frontendFrameworkId: null,
    careerChoiceId: null,
  },
};

let state = emptyState();
let timer = 0;
const dirtyTracks = new Set();
let dirtyMeta = false;

export function getState() { return state; }
export function setState(next) { state = next; }

export function loadState() {
  try {
    const stored = readStoredJson((key) => localStorage.getItem(key));
    if (!stored) {
      state = emptyState();
      state.theme = 'dark';
      return;
    }
    state = stored.key === LEGACY_STORAGE_KEY ? stateFromLegacyStorage(stored.parsed) : normalizeState(stored.parsed);
    if (!state.theme) state.theme = 'dark';
    if (stored.key !== STORAGE_KEY) persistAll();
  } catch (error) {
    console.warn(error);
    state = emptyState();
  }
}

function snapshot() {
  return {
    version: 2,
    theme: state.theme,
    strikethrough: state.strikethrough,
    activeTrackId: state.activeTrackId,
    profile: state.profile,
    tracks: state.tracks,
  };
}

function write(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function flushPersist() {
  clearTimeout(timer);
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { stored = null; }
  if (!stored || !stored.tracks || dirtyTracks.size === 0) {
    write(snapshot());
  } else {
    const tracks = { ...stored.tracks };
    if (dirtyMeta) {
      for (const id of Object.keys(state.tracks)) tracks[id] = state.tracks[id];
    } else {
      for (const id of dirtyTracks) {
        if (state.tracks[id]) tracks[id] = state.tracks[id];
        else delete tracks[id];
      }
    }
    write({ ...snapshot(), tracks });
  }
  dirtyTracks.clear();
  dirtyMeta = false;
}

export function persist(trackId) {
  if (trackId) dirtyTracks.add(trackId);
  else dirtyMeta = true;
  clearTimeout(timer);
  timer = setTimeout(flushPersist, 250);
}

export function persistAll() {
  dirtyMeta = true;
  flushPersist();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPersist);
}
