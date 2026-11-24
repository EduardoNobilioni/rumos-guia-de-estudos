/**
 * Regras puras do Rumos.
 * Sem DOM: dá para testar no Node e reutilizar no navegador.
 */

export const STORAGE_KEY = 'rumo_guia_ptbr_v1';
export const PREVIOUS_STORAGE_KEY = 'trilha_estudos_ptbr_v2';
export const LEGACY_STORAGE_KEY = 'roadmap_fullstack_ptbr_v1';
export const APP_NAME = 'Rumos';
export const APP_TAGLINE = 'Rumos: roadmap, guia e plano de estudos em tecnologia';

const STORAGE_KEYS = [STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY];

export function readStoredJson(getItem) {
  if (typeof getItem !== 'function') return null;
  for (const key of STORAGE_KEYS) {
    const raw = getItem(key);
    if (typeof raw !== 'string' || !raw.trim()) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return { key, parsed };
    } catch {
      /* chave corrompida: tenta a anterior */
    }
  }
  return null;
}

export const LEVELS = ['iniciante', 'intermediario', 'avancado'];

export const LEVEL_LABELS = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

export const LEVEL_RANK = {
  iniciante: 0,
  intermediario: 1,
  avancado: 2,
};

/** A trilha publicada como Dados manteve este id ao passar a se chamar Ciência de Dados. */
export const CIENCIA_DE_DADOS_ID = 'dados';

export const TRACK_GROUPS = [
  {
    id: 'carreira',
    title: 'Carreiras',
    lead: 'Um caminho de profissão, com projeto em cada etapa.',
  },
  {
    id: 'fundamentos',
    title: 'Fundamentos',
    lead: 'Computação que continua valendo quando a ferramenta muda.',
  },
  {
    id: 'tecnologia',
    title: 'Tecnologias',
    lead: 'Uma ferramenta por vez. Pode ser a trilha principal ou entrar junto com uma carreira.',
  },
];

export function foldText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function trackHaystack(track) {
  const keywords = Array.isArray(track.keywords) ? track.keywords : [];
  return foldText([track.name, track.tagline, track.description, track.group, ...keywords].join(' '));
}

export function tracksMatching(list, query) {
  const needle = foldText(query).trim();
  const source = Array.isArray(list) ? list : [];
  if (!needle) return source.slice();
  return source.filter((track) => trackHaystack(track).includes(needle));
}

export function groupTracks(list) {
  const source = Array.isArray(list) ? list : [];
  return TRACK_GROUPS.map((group) => ({
    ...group,
    tracks: source.filter((track) => track.group === group.id),
  })).filter((group) => group.tracks.length > 0);
}

export const LEVEL_ALIASES = {
  iniciante: 'iniciante',
  intermediario: 'intermediario',
  intermediário: 'intermediario',
  avancado: 'avancado',
  avançado: 'avancado',
};

export const RESOURCE_KINDS = ['leitura', 'curso', 'documentacao', 'pratica', 'video'];
export const STATUSES = ['required', 'optional', 'hidden'];
const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const NOTE_LIMIT = 20000;

export function normalizeLevel(value) {
  if (typeof value !== 'string') return null;
  return LEVEL_ALIASES[value.trim().toLowerCase()] || null;
}

export function clampHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 60) return null;
  return rounded;
}

export function isId(value) {
  return typeof value === 'string' && ID_RE.test(value);
}

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeBoolMap(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (isId(key) && value) out[key] = true;
  }
  return out;
}

export function sanitizeTextMap(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!isId(key) || typeof value !== 'string') continue;
    const text = value.slice(0, NOTE_LIMIT);
    if (text.trim()) out[key] = text;
  }
  return out;
}

export function sanitizeIdList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const id of raw) {
    if (!isId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function sanitizeOverrides(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (isId(key) && STATUSES.includes(value)) out[key] = value;
  }
  return out;
}

export function sanitizeTopicOrder(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [phaseId, list] of Object.entries(raw)) {
    if (!isId(phaseId)) continue;
    const ids = sanitizeIdList(list);
    if (ids.length) out[phaseId] = ids;
  }
  return out;
}

export function sanitizeResources(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    if (typeof item.title !== 'string' || !item.title.trim()) continue;
    if (typeof item.url !== 'string' || !/^https?:\/\//i.test(item.url)) continue;
    out.push({
      title: item.title.trim().slice(0, 180),
      url: item.url.trim().slice(0, 500),
      lang: item.lang === 'en' ? 'en' : 'pt',
      kind: RESOURCE_KINDS.includes(item.kind) ? item.kind : 'leitura',
    });
    if (out.length >= 6) break;
  }
  return out;
}

export function sanitizeStringList(raw, limit = 12) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const text = item.trim().slice(0, 40);
    if (!text) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

export function sanitizeCustomTopics(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (!isPlainObject(item) || !isId(item.id) || seen.has(item.id)) continue;
    if (!isId(item.phaseId)) continue;
    if (typeof item.title !== 'string' || item.title.trim().length < 2) continue;
    seen.add(item.id);
    const hours = clampHours(item.hours) || 4;
    out.push({
      id: item.id,
      phaseId: item.phaseId,
      title: item.title.trim().slice(0, 140),
      description: typeof item.description === 'string' ? item.description.trim().slice(0, 600) : '',
      level: normalizeLevel(item.level) || 'iniciante',
      hours,
      tags: sanitizeStringList(item.tags),
      prerequisites: sanitizeIdList(item.prerequisites),
      resources: sanitizeResources(item.resources),
      custom: true,
    });
    if (out.length >= 80) break;
  }
  return out;
}

export function sanitizeCustomProjects(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (!isPlainObject(item) || !isId(item.id) || seen.has(item.id)) continue;
    if (!isId(item.phaseId)) continue;
    if (typeof item.title !== 'string' || item.title.trim().length < 2) continue;
    seen.add(item.id);
    out.push({
      id: item.id,
      phaseId: item.phaseId,
      title: item.title.trim().slice(0, 140),
      description: typeof item.description === 'string' ? item.description.trim().slice(0, 600) : '',
      level: normalizeLevel(item.level) || 'iniciante',
      hours: clampHours(item.hours) || 4,
      steps: sanitizeLines(item.steps),
      definitionOfDone: sanitizeLines(item.definitionOfDone),
      custom: true,
    });
    if (out.length >= 80) break;
  }
  return out;
}

export function emptyTrackState() {
  return {
    level: null,
    weeklyHours: null,
    includeBelowLevel: false,
    showAllProjectLevels: false,
    completed: {},
    notes: {},
    phaseNotes: {},
    collapsedPhases: {},
    overrides: {},
    customTopics: [],
    customProjects: [],
    customLinks: {},
    doneResources: {},
    completedProjects: {},
    guideChecks: {},
    quizAnswers: {},
    studyPlan: null,
    phaseOrder: [],
    topicOrder: {},
  };
}

export function sanitizeLines(raw, limit = 12) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const text = item.trim().slice(0, 280);
    if (!text) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function sanitizeIndexMap(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (/^\d{1,2}$/.test(key) && value) out[key] = true;
  }
  return out;
}

function sanitizeGuideChecks(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!isId(id) || !isPlainObject(value)) continue;
    const steps = sanitizeIndexMap(value.steps);
    const criteria = sanitizeIndexMap(value.criteria);
    if (Object.keys(steps).length || Object.keys(criteria).length) out[id] = { steps, criteria };
  }
  return out;
}

function sanitizeClock(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? value : null;
}

function sanitizeStudyPlan(raw) {
  if (!isPlainObject(raw) || !parseISODate(raw.startDate)) return null;
  const weekdays = [...new Set((raw.weekdays || []).map(Number).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b);
  const slots = {};
  for (const day of weekdays) {
    const slot = (raw.slots && (raw.slots[day] || raw.slots[String(day)])) || {};
    const start = sanitizeClock(slot.start);
    const end = sanitizeClock(slot.end);
    if (!start || !end || end <= start) continue;
    slots[day] = { start, end };
  }
  const activeDays = weekdays.filter((day) => slots[day]);
  if (!activeDays.length) return null;
  const sessions = [];
  for (const session of Array.isArray(raw.sessions) ? raw.sessions : []) {
    if (!isPlainObject(session) || !isId(session.id) || !parseISODate(session.date)) continue;
    const start = sanitizeClock(session.start);
    const end = sanitizeClock(session.end);
    if (!start || !end || end <= start) continue;
    const kind = ['topic', 'project', 'review', 'custom'].includes(session.kind) ? session.kind : 'custom';
    sessions.push({
      id: session.id,
      date: formatISODate(parseISODate(session.date)),
      start,
      end,
      title: String(session.title || 'Sessão').slice(0, 140),
      kind,
      refId: isId(session.refId) ? session.refId : '',
      phaseId: isId(session.phaseId) ? session.phaseId : '',
      trackId: isId(session.trackId) ? session.trackId : '',
      trackName: typeof session.trackName === 'string' ? session.trackName.slice(0, 80) : '',
      locked: session.locked === true,
      detail: typeof session.detail === 'string' ? session.detail.slice(0, 500) : '',
      summary: typeof session.summary === 'string' ? session.summary.slice(0, 600) : '',
      links: Array.isArray(session.links) ? session.links.filter((link) => link && /^https?:\/\//.test(link.url || '')).slice(0, 6).map((link) => ({
        title: String(link.title || 'Link').slice(0, 140),
        url: String(link.url).slice(0, 500),
      })) : [],
    });
    if (sessions.length >= 800) break;
  }
  const university = isPlainObject(raw.university) ? raw.university : {};
  const manual = [];
  for (const row of Array.isArray(university.manual) ? university.manual : []) {
    const weekday = Number(row.weekday);
    const start = sanitizeClock(row.start);
    const end = sanitizeClock(row.end);
    if (weekday < 0 || weekday > 6 || !start || !end || end <= start) continue;
    if (typeof row.title !== 'string' || row.title.trim().length < 2) continue;
    manual.push({
      id: isId(row.id) ? row.id : `aula-${manual.length + 1}`,
      weekday,
      start,
      end,
      title: row.title.trim().slice(0, 120),
    });
    if (manual.length >= 80) break;
  }
  const busy = [];
  for (const event of Array.isArray(university.busy) ? university.busy : []) {
    if (!event || typeof event.start !== 'string' || typeof event.end !== 'string') continue;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(event.start) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(event.end)) continue;
    busy.push({
      id: isId(String(event.id || '').slice(0, 80)) ? String(event.id).slice(0, 80) : `ocupado-${busy.length + 1}`,
      title: String(event.title || 'Ocupado').slice(0, 140),
      start: event.start,
      end: event.end,
      allDay: event.allDay === true,
      source: event.source === 'csv' ? 'csv' : 'ics',
    });
    if (busy.length >= 2000) break;
  }
  const examRanges = [];
  for (const range of Array.isArray(university.examRanges) ? university.examRanges : []) {
    if (!parseISODate(range.start) || !parseISODate(range.end) || range.end < range.start) continue;
    examRanges.push({
      id: isId(range.id) ? range.id : `prova-${examRanges.length + 1}`,
      start: range.start,
      end: range.end,
      label: String(range.label || 'Provas').slice(0, 80),
      percent: Math.min(80, Math.max(20, Number(range.percent) || 50)),
    });
  }
  return {
    startDate: formatISODate(parseISODate(raw.startDate)),
    weekdays: activeDays,
    slots,
    weeklyHours: clampHours(raw.weeklyHours) || 10,
    includeOptional: raw.includeOptional === true,
    includeProjects: raw.includeProjects !== false,
    includeReviews: raw.includeReviews !== false,
    includeCompanions: raw.includeCompanions !== false,
    spacedReview: raw.spacedReview === true,
    minBlockMinutes: Math.min(90, Math.max(20, Number(raw.minBlockMinutes) || 30)),
    maxBlockMinutes: Number(raw.maxBlockMinutes) > 0 ? Math.min(240, Math.max(30, Number(raw.maxBlockMinutes))) : 0,
    skippedDates: [...new Set((raw.skippedDates || []).filter((date) => parseISODate(date)))].slice(0, 100),
    sessions,
    university: {
      bufferBefore: Math.min(120, Math.max(0, Number(university.bufferBefore) || 0)),
      bufferAfter: Math.min(120, Math.max(0, Number(university.bufferAfter) || 0)),
      examLoadPercent: Math.min(80, Math.max(20, Number(university.examLoadPercent) || 50)),
      examRanges,
      manual,
      busy,
    },
  };
}

function sanitizeQuizAnswers(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [questionId, choiceId] of Object.entries(raw)) {
    if (isId(questionId) && isId(choiceId)) out[questionId] = choiceId;
  }
  return out;
}

function sanitizeCustomLinksMap(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [topicId, list] of Object.entries(raw)) {
    if (!isId(topicId)) continue;
    const links = sanitizeResources(list);
    if (links.length) out[topicId] = links;
  }
  return out;
}

function sanitizeDoneResources(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== 'string' || !key.trim() || key.length > 600 || !value) continue;
    out[key] = true;
    count += 1;
    if (count >= 2000) break;
  }
  return out;
}

export function sanitizeTrackState(raw) {
  const base = emptyTrackState();
  if (!isPlainObject(raw)) return base;
  base.level = normalizeLevel(raw.level);
  base.weeklyHours = clampHours(raw.weeklyHours);
  base.includeBelowLevel = raw.includeBelowLevel === true;
  base.showAllProjectLevels = raw.showAllProjectLevels === true;
  base.completed = sanitizeBoolMap(raw.completed);
  base.notes = sanitizeTextMap(raw.notes);
  base.phaseNotes = sanitizeTextMap(raw.phaseNotes);
  base.collapsedPhases = sanitizeBoolMap(raw.collapsedPhases);
  base.overrides = sanitizeOverrides(raw.overrides);
  base.customTopics = sanitizeCustomTopics(raw.customTopics);
  base.customProjects = sanitizeCustomProjects(raw.customProjects);
  base.customLinks = sanitizeCustomLinksMap(raw.customLinks);
  base.doneResources = sanitizeDoneResources(raw.doneResources);
  base.completedProjects = sanitizeBoolMap(raw.completedProjects);
  base.guideChecks = sanitizeGuideChecks(raw.guideChecks);
  base.quizAnswers = sanitizeQuizAnswers(raw.quizAnswers);
  base.studyPlan = sanitizeStudyPlan(raw.studyPlan);
  base.phaseOrder = sanitizeIdList(raw.phaseOrder);
  base.topicOrder = sanitizeTopicOrder(raw.topicOrder);
  return base;
}

function emptyProfile() {
  return {
    onboarded: false,
    primaryTrackId: null,
    companionIds: [],
    dismissedNotices: [],
  };
}

function sanitizeProfile(raw) {
  const profile = emptyProfile();
  if (!isPlainObject(raw)) return profile;
  profile.onboarded = !!raw.onboarded;
  profile.primaryTrackId = isId(raw.primaryTrackId) ? raw.primaryTrackId : null;
  profile.companionIds = sanitizeIdList(raw.companionIds)
    .filter((id) => id !== profile.primaryTrackId)
    .slice(0, 6);
  profile.dismissedNotices = sanitizeIdList(raw.dismissedNotices).slice(0, 20);
  return profile;
}

export function emptyState() {
  return {
    version: 2,
    theme: 'dark',
    strikethrough: true,
    activeTrackId: null,
    profile: emptyProfile(),
    tracks: {},
  };
}

export function ensureTrack(state, trackId) {
  if (!state.tracks[trackId]) state.tracks[trackId] = emptyTrackState();
  return state.tracks[trackId];
}

export function normalizeState(raw) {
  const state = emptyState();
  if (!isPlainObject(raw)) return state;
  state.theme = raw.theme === 'light' ? 'light' : 'dark';
  state.strikethrough = typeof raw.strikethrough === 'boolean' ? raw.strikethrough : true;
  state.profile = sanitizeProfile(raw.profile);
  if (isPlainObject(raw.tracks)) {
    for (const [id, track] of Object.entries(raw.tracks)) {
      if (!isId(id)) continue;
      state.tracks[id] = sanitizeTrackState(track);
    }
  }
  if (isId(raw.activeTrackId) && state.tracks[raw.activeTrackId]) {
    state.activeTrackId = raw.activeTrackId;
  } else {
    state.activeTrackId = null;
  }
  return state;
}

export function isReady(state) {
  const track = state.activeTrackId && state.tracks[state.activeTrackId];
  return !!(state.profile.onboarded && track && track.level && track.weeklyHours);
}

export function stateFromLegacyStorage(parsed) {
  const state = emptyState();
  if (!isPlainObject(parsed)) return state;
  state.theme = parsed.theme === 'light' ? 'light' : 'dark';
  state.strikethrough = typeof parsed.strikethrough === 'boolean' ? parsed.strikethrough : true;
  state.profile.onboarded = true;
  state.activeTrackId = 'fullstack';
  const track = ensureTrack(state, 'fullstack');
  track.level = 'iniciante';
  track.weeklyHours = 10;
  track.completed = sanitizeBoolMap(parsed.completed);
  track.notes = sanitizeTextMap(parsed.notes);
  track.collapsedPhases = sanitizeBoolMap(parsed.collapsedPhases);
  return state;
}

export function isLegacyExport(parsed) {
  if (!isPlainObject(parsed)) return false;
  if (Number(parsed.version) >= 2 && isPlainObject(parsed.tracks)) return false;
  return isPlainObject(parsed.completed);
}

export function applyImport(state, parsed) {
  if (isLegacyExport(parsed)) {
    const track = ensureTrack(state, 'fullstack');
    track.completed = sanitizeBoolMap(parsed.completed);
    track.notes = sanitizeTextMap(parsed.notes);
    if (isPlainObject(parsed.phaseNotes)) track.phaseNotes = sanitizeTextMap(parsed.phaseNotes);
    if (isPlainObject(parsed.completedProjects)) {
      track.completedProjects = sanitizeBoolMap(parsed.completedProjects);
    }
    if (!track.level) track.level = 'iniciante';
    if (!track.weeklyHours) track.weeklyHours = 10;
    state.activeTrackId = 'fullstack';
    state.profile.onboarded = true;
    return { kind: 'legacy' };
  }

  if (!isPlainObject(parsed) || !isPlainObject(parsed.tracks)) {
    throw new Error('Formato de arquivo inválido.');
  }

  if (parsed.theme === 'light' || parsed.theme === 'dark') state.theme = parsed.theme;
  if (typeof parsed.strikethrough === 'boolean') state.strikethrough = parsed.strikethrough;
  if (isPlainObject(parsed.profile)) {
    const kept = sanitizeProfile(parsed.profile);
    state.profile.primaryTrackId = kept.primaryTrackId;
    state.profile.companionIds = kept.companionIds;
    state.profile.dismissedNotices = kept.dismissedNotices;
  }

  for (const [id, raw] of Object.entries(parsed.tracks)) {
    if (!isId(id)) continue;
    state.tracks[id] = sanitizeTrackState(raw);
  }

  if (isId(parsed.activeTrackId) && state.tracks[parsed.activeTrackId]) {
    state.activeTrackId = parsed.activeTrackId;
  } else if (!state.activeTrackId || !state.tracks[state.activeTrackId]) {
    const first = Object.keys(state.tracks)[0] || null;
    state.activeTrackId = first;
  }

  state.profile.onboarded = true;
  return { kind: 'v2' };
}

export function buildExport(state, exportedAt = new Date().toISOString()) {
  const active = (state.activeTrackId && state.tracks[state.activeTrackId]) || emptyTrackState();
  return {
    app: APP_NAME,
    version: 2,
    exportedAt,
    activeTrackId: state.activeTrackId,
    theme: state.theme,
    strikethrough: state.strikethrough,
    profile: {
      onboarded: !!state.profile.onboarded,
      primaryTrackId: state.profile.primaryTrackId,
      companionIds: state.profile.companionIds,
      dismissedNotices: state.profile.dismissedNotices,
    },
    completed: active.completed,
    notes: active.notes,
    phaseNotes: active.phaseNotes,
    tracks: state.tracks,
  };
}

export function parseISODate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1) return null;
  return date;
}

export function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
