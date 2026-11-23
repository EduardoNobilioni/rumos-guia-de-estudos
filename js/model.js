/**
 * Regras puras do Rumo.
 * Sem DOM: dá para testar no Node e reutilizar no navegador.
 */

export const STORAGE_KEY = 'rumo_guia_ptbr_v1';
export const PREVIOUS_STORAGE_KEY = 'trilha_estudos_ptbr_v2';
export const LEGACY_STORAGE_KEY = 'roadmap_fullstack_ptbr_v1';
export const APP_NAME = 'Rumo';
export const APP_TAGLINE = 'Rumo: roadmap, guia e plano de estudos em tecnologia';

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

const LEVEL_ALIASES = {
  iniciante: 'iniciante',
  intermediario: 'intermediario',
  intermediário: 'intermediario',
  avancado: 'avancado',
  avançado: 'avancado',
};

const RESOURCE_KINDS = ['leitura', 'curso', 'documentacao', 'pratica', 'video'];
const STATUSES = ['required', 'optional', 'hidden'];
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

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeBoolMap(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (isId(key) && value) out[key] = true;
  }
  return out;
}

function sanitizeTextMap(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!isId(key) || typeof value !== 'string') continue;
    const text = value.slice(0, NOTE_LIMIT);
    if (text.trim()) out[key] = text;
  }
  return out;
}

function sanitizeIdList(raw) {
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

function sanitizeOverrides(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (isId(key) && STATUSES.includes(value)) out[key] = value;
  }
  return out;
}

function sanitizeTopicOrder(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [phaseId, list] of Object.entries(raw)) {
    if (!isId(phaseId)) continue;
    const ids = sanitizeIdList(list);
    if (ids.length) out[phaseId] = ids;
  }
  return out;
}

function sanitizeResources(raw) {
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

function sanitizeStringList(raw, limit = 12) {
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

function sanitizeLines(raw, limit = 12) {
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

export function naturalStatus(topic, trackState) {
  const userLevel = normalizeLevel(trackState.level) || 'iniciante';
  const topicLevel = normalizeLevel(topic.level) || 'iniciante';
  if (!trackState.includeBelowLevel && LEVEL_RANK[topicLevel] < LEVEL_RANK[userLevel]) {
    return 'optional';
  }
  return 'required';
}

export function effectiveStatus(topic, trackState) {
  const override = trackState.overrides && trackState.overrides[topic.id];
  if (STATUSES.includes(override)) return override;
  return naturalStatus(topic, trackState);
}

export function setTopicStatus(trackState, topic, status) {
  if (!STATUSES.includes(status)) return;
  const natural = naturalStatus(topic, trackState);
  if (!trackState.overrides) trackState.overrides = {};
  if (status === natural) delete trackState.overrides[topic.id];
  else trackState.overrides[topic.id] = status;
}

export function mergeOrder(naturalIds, savedOrder) {
  const natural = (naturalIds || []).filter(isId);
  const saved = sanitizeIdList(savedOrder).filter((id) => natural.includes(id));
  if (!saved.length) return natural.slice();
  const result = saved.slice();
  const seen = new Set(result);
  for (let i = 0; i < natural.length; i += 1) {
    const id = natural[i];
    if (seen.has(id)) continue;
    let insertAt = 0;
    for (let j = i - 1; j >= 0; j -= 1) {
      const prev = result.indexOf(natural[j]);
      if (prev !== -1) {
        insertAt = prev + 1;
        break;
      }
    }
    result.splice(insertAt, 0, id);
    seen.add(id);
  }
  return result;
}

export function moveId(list, id, direction) {
  const ids = list.slice();
  const index = ids.indexOf(id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= ids.length) return ids;
  const [item] = ids.splice(index, 1);
  ids.splice(next, 0, item);
  return ids;
}

export function topicsForPhase(phase, trackState) {
  const extraLinks = (topicId) => ((trackState.customLinks && trackState.customLinks[topicId]) || [])
    .map((resource) => ({ ...resource, custom: true }));
  const builtin = (phase.topics || []).map((topic) => ({
    ...topic,
    custom: false,
    resources: [...(topic.resources || []), ...extraLinks(topic.id)],
  }));
  const custom = (trackState.customTopics || [])
    .filter((topic) => topic.phaseId === phase.id)
    .map((topic) => ({
      ...topic,
      custom: true,
      tags: topic.tags || [],
      prerequisites: topic.prerequisites || [],
      resources: [...(topic.resources || []), ...extraLinks(topic.id)],
    }));
  return [...builtin, ...custom];
}

export function projectsForPhase(phase, trackState) {
  const builtin = (phase.projects || []).map((project) => ({
    ...project,
    custom: false,
    phaseId: phase.id,
  }));
  const custom = (trackState.customProjects || [])
    .filter((project) => project.phaseId === phase.id)
    .map((project) => ({ ...project, custom: true }));
  return [...builtin, ...custom].map((project) => ({
    ...project,
    level: normalizeLevel(project.level) || 'iniciante',
    steps: sanitizeLines(project.steps),
    definitionOfDone: sanitizeLines(project.definitionOfDone),
    done: !!(trackState.completedProjects && trackState.completedProjects[project.id]),
  }));
}

export const QUIZ_REVIEW_BELOW = 0.7;

export function quizScore(questions, answers = {}) {
  const list = Array.isArray(questions) ? questions : [];
  let answered = 0;
  let correct = 0;
  for (const question of list) {
    const choiceId = answers[question.id];
    if (!choiceId) continue;
    answered += 1;
    const choice = (question.choices || []).find((item) => item.id === choiceId);
    if (choice && choice.correct) correct += 1;
  }
  const total = list.length;
  const ratio = total ? correct / total : 1;
  return {
    total,
    answered,
    correct,
    ratio,
    complete: total > 0 && answered === total,
    needsReview: total > 0 && answered === total && ratio < QUIZ_REVIEW_BELOW,
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

export function phaseDeadlines(phases, weeklyHours, startDate) {
  const start = parseISODate(startDate);
  const hoursPerWeek = clampHours(weeklyHours);
  if (!start || !hoursPerWeek) return [];
  let cursor = start;
  const events = [];
  for (const phase of phases) {
    const topicHours = (phase.topics || [])
      .filter((topic) => topic.status === 'required')
      .reduce((sum, topic) => sum + (Number(topic.hours) > 0 ? Number(topic.hours) : 0), 0);
    if (topicHours <= 0) continue;
    const days = Math.max(1, Math.ceil((topicHours / hoursPerWeek) * 7));
    const end = addUtcDays(cursor, days);
    events.push({
      phaseId: phase.id,
      title: `Etapa ${phase.number}: ${phase.title}`,
      start: formatISODate(cursor),
      end: formatISODate(end),
      hours: topicHours,
      days,
    });
    cursor = end;
  }
  return events;
}

export function phaseProgress(topics) {
  const visible = topics.filter((topic) => topic.status !== 'hidden');
  const required = visible.filter((topic) => topic.status === 'required');
  const pool = required.length ? required : visible;
  const done = pool.filter((topic) => topic.done).length;
  const total = pool.length;
  return {
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
    complete: total > 0 && done === total,
    requiredDone: required.filter((topic) => topic.done).length,
    requiredTotal: required.length,
    optionalTotal: visible.filter((topic) => topic.status === 'optional').length,
  };
}

export function buildRoadmap(track, trackState) {
  const phaseIds = mergeOrder(
    (track.phases || []).map((phase) => phase.id),
    trackState.phaseOrder,
  );
  const known = new Set(phaseIds);
  const phases = phaseIds.map((phaseId) => {
    const phase = track.phases.find((item) => item.id === phaseId);
    const natural = topicsForPhase(phase, trackState);
    const orderedIds = mergeOrder(
      natural.map((topic) => topic.id),
      trackState.topicOrder && trackState.topicOrder[phase.id],
    );
    const byId = new Map(natural.map((topic) => [topic.id, topic]));
    const topics = orderedIds.map((id) => {
      const topic = byId.get(id);
      return {
        ...topic,
        status: effectiveStatus(topic, trackState),
        done: !!(trackState.completed && trackState.completed[topic.id]),
        note: (trackState.notes && trackState.notes[topic.id]) || '',
      };
    });
    return {
      ...phase,
      topics,
      projects: projectsForPhase(phase, trackState),
      note: (trackState.phaseNotes && trackState.phaseNotes[phase.id]) || '',
      progress: phaseProgress(topics),
    };
  });

  const orphans = (trackState.customProjects || [])
    .filter((project) => !known.has(project.phaseId))
    .map((project) => ({
      ...project,
      custom: true,
      level: normalizeLevel(project.level) || 'iniciante',
      done: !!(trackState.completedProjects && trackState.completedProjects[project.id]),
    }));

  return { phases, orphans };
}

export function roadmapStats(phases) {
  let required = 0;
  let requiredDone = 0;
  let optional = 0;
  let optionalDone = 0;
  let hidden = 0;
  let hours = 0;
  let hoursLeft = 0;
  let badges = 0;

  for (const phase of phases) {
    if (phase.progress && phase.progress.complete) badges += 1;
    for (const topic of phase.topics) {
      const topicHours = Number(topic.hours) > 0 ? Number(topic.hours) : 0;
      if (topic.status === 'hidden') {
        hidden += 1;
        continue;
      }
      if (topic.status === 'optional') {
        optional += 1;
        if (topic.done) optionalDone += 1;
        continue;
      }
      required += 1;
      hours += topicHours;
      if (topic.done) requiredDone += 1;
      else hoursLeft += topicHours;
    }
  }

  return {
    required,
    requiredDone,
    optional,
    optionalDone,
    hidden,
    hours,
    hoursLeft,
    percent: required ? Math.round((requiredDone / required) * 100) : 0,
    badges,
    phases: phases.length,
  };
}

export function projectPlanStats(phases, level) {
  let total = 0;
  let done = 0;
  let hours = 0;
  for (const phase of phases) {
    for (const project of phase.projects || []) {
      if (project.level !== level) continue;
      total += 1;
      hours += Number(project.hours) > 0 ? Number(project.hours) : 0;
      if (project.done) done += 1;
    }
  }
  return { total, done, hours };
}

export function visibleProjects(projects, level, showAll) {
  if (showAll) return projects;
  return projects.filter((project) => project.level === level);
}

export function formatDuration(hours, weeklyHours) {
  const roundedHours = Math.round(Number(hours) || 0);
  const hourLabel = `${roundedHours.toLocaleString('pt-BR')} h`;
  if (!weeklyHours || weeklyHours <= 0 || roundedHours <= 0) return hourLabel;
  const weeks = Number(hours) / weeklyHours;
  if (weeks < 0.8) {
    const days = Math.max(1, Math.round(weeks * 7));
    return `${hourLabel} · ${days === 1 ? 'cerca de 1 dia' : `cerca de ${days} dias`}`;
  }
  const rounded = weeks < 10 ? Math.round(weeks * 2) / 2 : Math.round(weeks);
  const num = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  const unit = rounded === 1 ? 'semana' : 'semanas';
  return `${hourLabel} · cerca de ${num} ${unit}`;
}

export function currentPhase(phases) {
  for (const phase of phases) {
    const required = phase.topics.filter((topic) => topic.status === 'required');
    if (!required.length) continue;
    if (required.some((topic) => !topic.done)) return phase;
  }
  return null;
}

export function sharePlanFromTrack(state, trackId) {
  const track = state.tracks[trackId];
  if (!track || !track.level || !track.weeklyHours) return null;
  const plan = {
    v: 1,
    t: trackId,
    l: track.level,
    h: track.weeklyHours,
    b: track.includeBelowLevel ? 1 : 0,
  };
  if (track.showAllProjectLevels) plan.s = 1;
  if (track.overrides && Object.keys(track.overrides).length) plan.o = track.overrides;
  if (track.customTopics && track.customTopics.length) plan.c = track.customTopics;
  if (track.customProjects && track.customProjects.length) plan.p = track.customProjects;
  if (track.phaseOrder && track.phaseOrder.length) plan.po = track.phaseOrder;
  if (track.topicOrder && Object.keys(track.topicOrder).length) plan.to = track.topicOrder;
  return plan;
}

export function applySharePlan(state, plan) {
  if (!isPlainObject(plan) || plan.v !== 1 || !isId(plan.t)) {
    throw new Error('Plano compartilhado inválido.');
  }
  const level = normalizeLevel(plan.l);
  const hours = clampHours(plan.h);
  if (!level || !hours) throw new Error('Plano compartilhado inválido.');

  const previous = state.tracks[plan.t];
  const kept = previous
    ? {
      completed: previous.completed,
      notes: previous.notes,
      phaseNotes: previous.phaseNotes,
      completedProjects: previous.completedProjects,
      collapsedPhases: previous.collapsedPhases,
      quizAnswers: previous.quizAnswers,
      guideChecks: previous.guideChecks,
      studyPlan: previous.studyPlan,
    }
    : null;

  const track = ensureTrack(state, plan.t);
  track.level = level;
  track.weeklyHours = hours;
  track.includeBelowLevel = plan.b === 1 || plan.b === true;
  track.showAllProjectLevels = plan.s === 1 || plan.s === true;
  track.overrides = sanitizeOverrides(plan.o);
  track.customTopics = sanitizeCustomTopics(plan.c);
  track.customProjects = sanitizeCustomProjects(plan.p);
  track.phaseOrder = sanitizeIdList(plan.po);
  track.topicOrder = sanitizeTopicOrder(plan.to);
  if (kept) {
    track.completed = kept.completed;
    track.notes = kept.notes;
    track.phaseNotes = kept.phaseNotes;
    track.completedProjects = kept.completedProjects;
    track.collapsedPhases = kept.collapsedPhases;
    track.quizAnswers = kept.quizAnswers;
    track.guideChecks = kept.guideChecks;
    track.studyPlan = kept.studyPlan;
  }
  state.activeTrackId = plan.t;
  state.profile.onboarded = true;
  return state;
}

export function newId(prefix) {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now().toString(36)}${token}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

export function validateTrack(data) {
  const errors = [];
  if (!isPlainObject(data)) return ['A trilha precisa ser um objeto JSON.'];
  if (!isId(data.id)) errors.push('O id da trilha é obrigatório e deve usar letras, números e hífen.');
  for (const field of ['name', 'tagline', 'description']) {
    if (typeof data[field] !== 'string' || !data[field].trim()) {
      errors.push(`Campo "${field}" é obrigatório.`);
    }
  }
  if (!Array.isArray(data.phases) || data.phases.length === 0) {
    errors.push('A trilha precisa de uma lista "phases" com ao menos uma etapa.');
    return errors;
  }

  const phaseIds = new Set();
  const topicIds = new Set();
  const projectIds = new Set();
  const questionIds = new Set();
  const reviewPointers = [];

  function validateQuiz(questions, label, ownerTopicId) {
    if (questions == null) return;
    if (!Array.isArray(questions) || questions.length < 2) {
      errors.push(`${label}: quiz precisa de ao menos duas perguntas.`);
      return;
    }
    for (const question of questions) {
      if (!isPlainObject(question) || !isId(question.id)) {
        errors.push(`${label}: pergunta sem id válido.`);
        continue;
      }
      if (questionIds.has(question.id)) errors.push(`Pergunta duplicada: ${question.id}.`);
      questionIds.add(question.id);
      if (typeof question.prompt !== 'string' || question.prompt.trim().length < 8) {
        errors.push(`${question.id}: prompt curto demais.`);
      }
      if (!Array.isArray(question.choices) || question.choices.length < 2) {
        errors.push(`${question.id}: inclua ao menos duas alternativas.`);
        continue;
      }
      const correct = question.choices.filter((choice) => choice && choice.correct === true);
      if (correct.length !== 1) errors.push(`${question.id}: marque exatamente uma alternativa correta.`);
      const choiceIds = new Set();
      for (const choice of question.choices) {
        if (!isPlainObject(choice) || !isId(choice.id)) {
          errors.push(`${question.id}: alternativa sem id.`);
          continue;
        }
        if (choiceIds.has(choice.id)) errors.push(`${question.id}: alternativa duplicada.`);
        choiceIds.add(choice.id);
        if (typeof choice.text !== 'string' || !choice.text.trim()) errors.push(`${question.id}: alternativa sem texto.`);
        if (typeof choice.explanation !== 'string' || choice.explanation.trim().length < 8) {
          errors.push(`${question.id}: cada alternativa precisa de uma explicação curta.`);
        }
      }
      const reviewId = question.reviewTopicId || ownerTopicId;
      if (!isId(reviewId)) errors.push(`${question.id}: aponte reviewTopicId para um tópico.`);
      else reviewPointers.push([question.id, reviewId]);
    }
  }

  data.phases.forEach((phase, index) => {
    const label = phase && phase.id ? phase.id : `etapa ${index + 1}`;
    if (!isPlainObject(phase) || !isId(phase.id)) errors.push(`${label}: id de etapa inválido.`);
    else if (phaseIds.has(phase.id)) errors.push(`${label}: id de etapa duplicado.`);
    else phaseIds.add(phase.id);
    if (!phase || typeof phase.title !== 'string' || !phase.title.trim()) errors.push(`${label}: title obrigatório.`);
    if (!phase || typeof phase.badgeTitle !== 'string' || !phase.badgeTitle.trim()) {
      errors.push(`${label}: badgeTitle obrigatório.`);
    }
    if (!phase || !Array.isArray(phase.topics) || phase.topics.length === 0) {
      errors.push(`${label}: inclua ao menos um tópico.`);
    }
    for (const topic of (phase && phase.topics) || []) {
      if (!isPlainObject(topic) || !isId(topic.id)) {
        errors.push(`${label}: tópico sem id válido.`);
        continue;
      }
      if (topicIds.has(topic.id)) errors.push(`Tópico duplicado: ${topic.id}.`);
      topicIds.add(topic.id);
      if (!normalizeLevel(topic.level)) errors.push(`${topic.id}: level deve ser iniciante, intermediario ou avancado.`);
      if (!(Number(topic.hours) > 0)) errors.push(`${topic.id}: hours deve ser um número maior que zero.`);
      if (typeof topic.title !== 'string' || !topic.title.trim()) errors.push(`${topic.id}: title obrigatório.`);
      if (typeof topic.description !== 'string' || !topic.description.trim()) {
        errors.push(`${topic.id}: description obrigatória.`);
      }
      if (!Array.isArray(topic.tags)) errors.push(`${topic.id}: tags deve ser uma lista.`);
      if (!Array.isArray(topic.prerequisites)) errors.push(`${topic.id}: prerequisites deve ser uma lista.`);
      if (!Array.isArray(topic.resources) || topic.resources.length === 0) {
        errors.push(`${topic.id}: inclua ao menos um recurso gratuito.`);
      }
      for (const resource of topic.resources || []) {
        if (!isPlainObject(resource) || typeof resource.title !== 'string' || !resource.title.trim()) {
          errors.push(`${topic.id}: recurso sem título.`);
          continue;
        }
        if (typeof resource.url !== 'string' || !/^https?:\/\//i.test(resource.url)) {
          errors.push(`${topic.id}: URL inválida em "${resource.title}".`);
        }
        if (resource.lang !== 'pt' && resource.lang !== 'en') errors.push(`${topic.id}: lang deve ser pt ou en.`);
        if (!RESOURCE_KINDS.includes(resource.kind)) {
          errors.push(`${topic.id}: kind inválido. Use leitura, curso, documentacao, pratica ou video.`);
        }
      }
      if (topic.quiz) validateQuiz(topic.quiz, topic.id, topic.id);
    }
    if (!phase || !Array.isArray(phase.quiz) || phase.quiz.length < 2) {
      errors.push(`${label}: inclua um quiz com ao menos duas perguntas.`);
    } else {
      validateQuiz(phase.quiz, label);
    }

    if (!phase || !Array.isArray(phase.projects) || phase.projects.length === 0) {
      errors.push(`${label}: inclua ideias de projeto em "projects".`);
    }
    const levels = new Set();
    for (const project of (phase && phase.projects) || []) {
      if (!isPlainObject(project) || !isId(project.id)) {
        errors.push(`${label}: projeto sem id válido.`);
        continue;
      }
      if (projectIds.has(project.id) || topicIds.has(project.id)) {
        errors.push(`Id de projeto duplicado: ${project.id}.`);
      }
      projectIds.add(project.id);
      const level = normalizeLevel(project.level);
      if (!level) errors.push(`${project.id}: level de projeto inválido.`);
      else levels.add(level);
      if (typeof project.title !== 'string' || !project.title.trim()) errors.push(`${project.id}: title obrigatório.`);
      if (typeof project.description !== 'string' || !project.description.trim()) {
        errors.push(`${project.id}: description obrigatória.`);
      }
      for (const field of ['steps', 'definitionOfDone']) {
        if (project[field] == null) continue;
        if (!Array.isArray(project[field]) || project[field].some((line) => typeof line !== 'string' || !line.trim())) {
          errors.push(`${project.id}: ${field} deve ser uma lista de textos.`);
        }
      }
    }
    for (const level of LEVELS) {
      if (!levels.has(level)) errors.push(`${label}: falta um projeto de nível ${level}.`);
    }
  });

  for (const phase of data.phases) {
    for (const topic of (phase && phase.topics) || []) {
      for (const prerequisite of (topic && topic.prerequisites) || []) {
        if (!topicIds.has(prerequisite)) {
          errors.push(`${topic.id}: pré-requisito "${prerequisite}" não existe nesta trilha.`);
        }
      }
    }
  }
  for (const [questionId, reviewId] of reviewPointers) {
    if (!topicIds.has(reviewId)) errors.push(`${questionId}: reviewTopicId "${reviewId}" não existe.`);
  }

  return errors;
}
