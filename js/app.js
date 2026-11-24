import {
  LEVELS,
  LEVEL_LABELS,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  applyImport,
  applySharePlan,
  buildCombinedRoadmap,
  buildExport,
  buildRoadmap,
  clampHours,
  currentPhase,
  effectiveStatus,
  emptyState,
  emptyTrackState,
  CIENCIA_DE_DADOS_ID,
  ensureTrack,
  formatDuration,
  groupTracks,
  isReady,
  moveId,
  naturalStatus,
  newId,
  normalizeState,
  projectPlanStats,
  quizScore,
  readStoredJson,
  roadmapStats,
  setTopicStatus,
  sharePlanFromTrack,
  stateFromLegacyStorage,
  tracksMatching,
  validateTrack,
  visibleProjects,
} from './model.js';
import { decodePlan, encodePlan, planFromHash } from './share.js';
import { drawRoadmap, roadmapLines, roadmapMarkdown, roadmapPdf, textPdf } from './files.js';
import { initPlanScreen } from './plan-screen.js';
import { initDashboardScreen } from './dashboard-screen.js';
import { planMarkdown } from './plan.js';
import { topicIconHtml, trackIconHtml } from './icons.js';

const KIND_LABEL = {
  leitura: 'Leitura',
  curso: 'Curso',
  documentacao: 'Documentação',
  pratica: 'Prática',
  video: 'Vídeo',
};

const LEVEL_COPY = {
  iniciante: 'Estou começando ou vi pouco disso na faculdade.',
  intermediario: 'Já programo e entendo o básico da área.',
  avancado: 'Já fiz projetos e quero o que ainda não domino.',
};

const HOUR_PRESETS = [4, 8, 12, 20];

const $ = (id) => document.getElementById(id);

let tracks = [];
let state = emptyState();
let pendingPlan = null;
let editingTopicId = null;
let editingProjectId = null;

const session = {
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
  onboarding: { step: 1, trackId: null, level: null, hours: null, mode: 'create', companionIds: [], query: '' },
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
  } catch {
    return '';
  }
  return '';
}

function toast(message, type = 'success') {
  const el = document.createElement('div');
  const tone = type === 'error'
    ? 'bg-card text-blush border-terra'
    : 'bg-card text-blush border-line';
  el.className = `pointer-events-auto px-4 py-3 rounded-sm border  text-sm ${tone}`;
  el.textContent = message;
  $('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function persist() {
  const payload = {
    version: 2,
    theme: state.theme,
    strikethrough: state.strikethrough,
    activeTrackId: state.activeTrackId,
    profile: state.profile,
    tracks: state.tracks,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  try {
    const stored = readStoredJson((key) => localStorage.getItem(key));
    if (!stored) {
      state.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      return;
    }
    state = stored.key === LEGACY_STORAGE_KEY
      ? stateFromLegacyStorage(stored.parsed)
      : normalizeState(stored.parsed);
    if (stored.key !== STORAGE_KEY) persist();
  } catch (error) {
    console.warn(error);
    state = emptyState();
  }
}

function trackById(id) {
  return tracks.find((track) => track.id === id) || null;
}

function activeTrack() {
  return trackById(state.activeTrackId);
}

function activeTrackState() {
  if (!state.activeTrackId) return null;
  return state.tracks[state.activeTrackId] || null;
}

function isCombinedView() {
  const primary = state.profile.primaryTrackId;
  return !!session.combinedView
    && !!primary
    && !!trackById(primary)
    && (state.profile.companionIds || []).some((id) => id !== primary && trackById(id));
}

function activeEntries() {
  if (isCombinedView()) {
    const ids = [state.profile.primaryTrackId, ...(state.profile.companionIds || [])];
    const seen = new Set();
    const entries = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const track = trackById(id);
      if (track) entries.push({ track, trackState: ensureTrack(state, id) });
    }
    return entries;
  }
  const track = activeTrack();
  const trackState = activeTrackState();
  return track && trackState ? [{ track, trackState }] : [];
}

function activeView() {
  return buildCombinedRoadmap(activeEntries());
}

function showScreen(name) {
  for (const id of ['loading', 'loadError', 'onboarding', 'app']) {
    $(id).hidden = id !== name;
  }
  const plan = $('planScreen');
  if (plan && name !== 'app') plan.hidden = true;
}

function applyTheme() {
  document.documentElement.classList.toggle('dark', state.theme !== 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = state.theme === 'light' ? '#FFFFFF' : '#090D16';
  $('themeLabel').textContent = state.theme === 'light' ? 'Tema escuro' : 'Tema claro';
  $('themeIcon').textContent = state.theme === 'light' ? '☾' : '☀';
  $('onbThemeBtn').textContent = state.theme === 'light' ? 'Tema escuro' : 'Tema claro';
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  persist();
  applyTheme();
}

function fillLevelSelect(select, selected) {
  select.innerHTML = LEVELS.map((level) => (
    `<option value="${level}" ${level === selected ? 'selected' : ''}>${LEVEL_LABELS[level]}</option>`
  )).join('');
}

function fillPhaseSelect(select, selected) {
  const track = activeTrack();
  select.innerHTML = (track?.phases || []).map((phase) => (
    `<option value="${escapeHtml(phase.id)}" ${phase.id === selected ? 'selected' : ''}>${escapeHtml(`Etapa ${phase.number}: ${phase.title}`)}</option>`
  )).join('');
}

function captureFocus() {
  const el = document.activeElement;
  if (!el || !el.dataset || !el.dataset.action) return null;
  return {
    action: el.dataset.action,
    itemId: el.dataset.itemId || '',
    phaseId: el.dataset.phaseId || '',
    projectId: el.dataset.projectId || '',
  };
}

function restoreFocus(token) {
  if (!token) return;
  const selector = [
    `[data-action="${CSS.escape(token.action)}"]`,
    token.itemId ? `[data-item-id="${CSS.escape(token.itemId)}"]` : '',
    token.phaseId ? `[data-phase-id="${CSS.escape(token.phaseId)}"]` : '',
    token.projectId ? `[data-project-id="${CSS.escape(token.projectId)}"]` : '',
  ].join('');
  document.querySelector(selector)?.focus();
}

function topicMatches(topic, query) {
  if (!query) return true;
  const blob = [
    topic.title,
    topic.description,
    topic.note || '',
    ...(topic.tags || []),
    ...(topic.resources || []).map((resource) => resource.title),
  ].join(' ').toLowerCase();
  return blob.includes(query);
}

function projectMatches(project, query) {
  if (!query) return true;
  return `${project.title} ${project.description}`.toLowerCase().includes(query);
}

const CHECK_SVG = '<svg viewBox="0 0 16 16" class="w-4 h-4" aria-hidden="true"><path d="M3 8.2 6.2 11.4 13 4.6" fill="none" stroke="currentColor" stroke-width="2"></path></svg>';
const DASH_SVG = '<svg viewBox="0 0 16 16" class="w-4 h-4" aria-hidden="true"><path d="M3 8h10" fill="none" stroke="currentColor" stroke-width="2"></path></svg>';

function checkbox(checked, attrs, label) {
  return `<button type="button" role="checkbox" aria-checked="${checked}" aria-label="${escapeHtml(label)}" ${attrs} class="mark-box ${checked ? 'is-on' : ''}">${checked ? CHECK_SVG : ''}</button>`;
}

function miniButton(label, attrs, extra = '') {
  return `<button type="button" ${attrs} class="px-2 py-1 rounded-sm text-[11px] font-medium border border-line dark:border-sage/60 text-muted dark:text-blush ${extra}">${label}</button>`;
}

function renderTopicNode(topic, titleById, doneIds) {
  const strike = topic.done && state.strikethrough ? 'line-through opacity-75' : '';
  const optional = topic.status === 'optional';
  const isCheckpoint = /\bcheckpoint\b/i.test(topic.title || '');
  const resCount = (topic.resources || []).length;
  const pendingPrereqs = (topic.prerequisites || []).filter((id) => !doneIds.has(id) && titleById.has(id));
  const nodeClass = [
    topic.done ? 'is-done' : (optional ? 'is-optional' : ''),
    isCheckpoint ? 'is-checkpoint' : '',
  ].filter(Boolean).join(' ');
  const prereqsAttr = escapeHtml((topic.prerequisites || []).join(','));
  const sourceTrackId = topic.sourceTrackId || activeTrack()?.id || '';
  const sourceBadge = isCombinedView() && topic.sourceTrackName
    ? `<span class="px-1.5 py-0.5 rounded-sm bg-terra/10 dark:bg-ochre/15 text-terra dark:text-ochre text-[10px] font-semibold">${escapeHtml(topic.sourceTrackName)}</span>`
    : '';
  return `
    <div class="topic-node ${nodeClass}" data-node-id="${topic.id}" data-prereqs="${prereqsAttr}">
      <div class="pt-0.5 shrink-0">
        ${checkbox(topic.done, `data-action="toggle-item" data-item-id="${topic.id}" data-source-track="${escapeHtml(sourceTrackId)}"`, `${topic.done ? 'Desmarcar' : 'Concluir'} ${topic.title}`)}
      </div>
      <button type="button" data-action="open-topic-detail" data-item-id="${topic.id}" data-source-track="${escapeHtml(sourceTrackId)}" class="min-w-0 flex-1 text-left">
        <div class="flex items-start gap-2.5">
          ${topicIconHtml(topic, sourceTrackId, 'md')}
          <p class="text-sm font-semibold leading-snug ${strike}">${escapeHtml(topic.title)}</p>
        </div>
        <p class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted">
          ${sourceBadge}
          <span>${LEVEL_LABELS[topic.level] || topic.level}</span>
          <span>·</span>
          <span>${Number(topic.hours) || 0} h</span>
          <span>·</span>
          <span>${resCount} ${resCount === 1 ? 'link' : 'links'}</span>
          ${optional ? '<span class="px-1.5 py-0.5 rounded-sm border border-line text-[10px]">Opcional</span>' : ''}
        </p>
        ${pendingPrereqs.length ? `<p class="mt-1 text-[11px] text-muted truncate">Antes: ${escapeHtml(pendingPrereqs.map((id) => titleById.get(id)).join(', '))}</p>` : ''}
      </button>
    </div>`;
}

function renderTopicDetail(topicId, sourceTrackId = session.detailSourceTrackId) {
  const dialog = $('topicDetailDialog');
  if (!dialog) return;
  const located = findTopic(topicId, sourceTrackId);
  if (!located) {
    session.detailTopicId = null;
    session.detailSourceTrackId = null;
    if (dialog.open) dialog.close();
    return;
  }
  const view = activeView();
  const titleById = new Map();
  const doneIds = new Set();
  view.phases.forEach((p) => p.topics.forEach((t) => {
    titleById.set(t.id, t.title);
    if (t.done) doneIds.add(t.id);
  }));
  const phase = view.phases.find((p) => p.id === located.phase.id) || located.phase;
  const idx = phase.topics.findIndex((t) => t.id === topicId && (!sourceTrackId || t.sourceTrackId === sourceTrackId));
  const topic = phase.topics[idx >= 0 ? idx : 0] || located.topic;
  $('topicDetailEyebrow').textContent = `Etapa ${String(phase.number).padStart(2, '0')} · ${phase.title}`;
  $('topicDetailTitle').textContent = topic.title;
  $('topicDetailBody').innerHTML = renderTopic(topic, phase, idx, phase.topics.length, titleById, doneIds);
}

function renderTopic(topic, phase, index, total, titleById, doneIds) {
  const sourceTrackId = topic.sourceTrackId || activeTrack()?.id || '';
  const trackState = state.tracks[sourceTrackId] || activeTrackState();
  const strike = topic.done && state.strikethrough ? 'line-through' : '';
  const optional = topic.status === 'optional';
  const hidden = topic.status === 'hidden';
  const noteOpen = !!session.openNotes[topic.id];
  const linkFormOpen = !!session.openLinkForms[topic.id];
  const tags = (topic.tags || []).map((tag) => `<span class="px-2 py-0.5 text-[11px] font-mono rounded-sm bg-soft dark:bg-card border border-line dark:border-sage/60">${escapeHtml(tag)}</span>`).join('');
  const filteredResources = (topic.resources || []).filter((resource) => {
    if (session.resourceLang !== 'all' && (resource.lang || 'pt') !== session.resourceLang) return false;
    if (session.resourceKind !== 'all' && (resource.kind || 'leitura') !== session.resourceKind) return false;
    return true;
  });
  const resources = filteredResources.map((resource) => {
    const href = safeUrl(resource.url);
    if (!href) return '';
    const kind = KIND_LABEL[resource.kind] || 'Leitura';
    const lang = resource.lang === 'en' ? 'EN' : 'PT';
    const resKey = `${topic.id}::${href}`;
    const resDone = !!(trackState.doneResources && trackState.doneResources[resKey]);
    const resStrike = resDone && state.strikethrough ? 'line-through opacity-75' : '';
    const removeBtn = resource.custom
      ? ` <button type="button" data-action="remove-topic-link" data-item-id="${topic.id}" data-url="${escapeHtml(href)}" class="text-xs text-terra underline ml-1">Remover</button>`
      : '';
    return `<li class="flex items-start gap-2"><input type="checkbox" data-action="toggle-resource" data-item-id="${topic.id}" data-url="${escapeHtml(href)}" aria-label="Marcar recurso ${escapeHtml(resource.title)} como visto" ${resDone ? 'checked' : ''} class="mt-1.5 shrink-0" /><div><a class="underline decoration-terra underline-offset-2 ${resStrike}" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(resource.title)}</a> <span class="font-mono text-[10px] text-muted">${lang} · ${kind}${resource.custom ? ' · seu link' : ''}</span>${removeBtn}</div></li>`;
  }).join('');
  const prereq = (topic.prerequisites || []).map((id) => {
    const name = titleById.get(id);
    if (!name) return '';
    const pending = !doneIds.has(id);
    return `${escapeHtml(name)}${pending ? ' (ainda não concluído)' : ''}`;
  }).filter(Boolean).join(', ');
  const natural = naturalStatus(topic, activeTrackState());
  const optionalLabel = optional
    ? (natural === 'optional' && !activeTrackState().overrides[topic.id] ? 'Opcional · abaixo do seu nível' : 'Opcional')
    : '';
  const statusButtons = hidden
    ? miniButton('Restaurar', `data-action="restore-topic" data-item-id="${topic.id}"`)
    : [
      miniButton(optional ? 'Tornar obrigatório' : 'Marcar como opcional', `data-action="toggle-optional" data-item-id="${topic.id}"`),
      miniButton('Ocultar', `data-action="hide-topic" data-item-id="${topic.id}"`),
      miniButton('Subir', `data-action="move-topic" data-item-id="${topic.id}" data-phase-id="${phase.id}" data-dir="-1" ${index === 0 ? 'disabled' : ''}`),
      miniButton('Descer', `data-action="move-topic" data-item-id="${topic.id}" data-phase-id="${phase.id}" data-dir="1" ${index === total - 1 ? 'disabled' : ''}`),
      topic.custom ? miniButton('Editar', `data-action="edit-topic" data-item-id="${topic.id}"`) : '',
      topic.custom ? miniButton('Excluir', `data-action="delete-topic" data-item-id="${topic.id}"`, 'text-terra') : '',
      (topic.quiz || []).length ? miniButton(quizScore(topic.quiz, activeTrackState().quizAnswers).needsReview ? 'Revisar' : 'Quiz', `data-action="open-quiz" data-quiz-scope="topic" data-item-id="${topic.id}"`) : '',
    ].join('');

  return `
    <article class="p-4 sm:px-5 sm:py-4 ${optional ? 'border-l-4 border-l-ochre' : ''}">
      <div class="flex items-start gap-3">
        ${checkbox(topic.done, `data-action="toggle-item" data-item-id="${topic.id}" data-source-track="${escapeHtml(sourceTrackId)}"`, `${topic.done ? 'Desmarcar' : 'Concluir'} ${topic.title}`)}
        <div class="min-w-0 flex-1">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              ${topicIconHtml(topic, sourceTrackId, 'md')}
              <h3 class="font-semibold ${strike}">${escapeHtml(topic.title)}</h3>
            </div>
            <button type="button" data-action="toggle-note" data-item-id="${topic.id}" class="self-start px-2.5 py-1 rounded-sm text-xs border ${topic.note || noteOpen ? 'border-ochre text-ink dark:text-ochre' : 'border-transparent bg-soft dark:bg-card'}">${topic.note ? 'Anotações' : 'Anotar'}</button>
          </div>
          <p class="read mt-3 text-muted dark:text-blush">${escapeHtml(topic.description)}</p>
          <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <span class="px-2 py-0.5 rounded-sm bg-soft dark:bg-card font-mono">${LEVEL_LABELS[topic.level] || topic.level}</span>
            <span class="px-2 py-0.5 rounded-sm bg-soft dark:bg-card font-mono">${Number(topic.hours) || 0} h</span>
            ${optionalLabel ? `<span class="px-2 py-0.5 rounded-sm bg-ochre text-night">${optionalLabel}</span>` : ''}
            ${topic.custom ? '<span class="px-2 py-0.5 rounded-sm bg-sage/20 text-muted dark:text-blush">Seu tópico</span>' : ''}
            ${tags}
          </div>
          ${prereq ? `<p class="mt-2 text-xs text-muted">Antes: ${prereq}</p>` : ''}
          ${resources ? `<ul class="read mt-3 space-y-2">${resources}</ul>` : ((topic.resources || []).length ? '<p class="mt-2 text-xs text-muted">Nenhum link neste filtro.</p>' : '')}
          <div class="mt-2 flex flex-wrap gap-1.5">${statusButtons}${hidden ? '' : miniButton('+ Link', `data-action="toggle-link-form" data-item-id="${topic.id}"`)}</div>
          ${linkFormOpen ? `
            <div class="mt-3 p-3 rounded-sm border border-line dark:border-sage/50 bg-paper dark:bg-night space-y-2 text-xs">
              <p class="font-mono text-muted">Adicionar link próprio neste tópico</p>
              <div class="grid sm:grid-cols-2 gap-2">
                <input id="link-title-${topic.id}" placeholder="Título do material" maxlength="180" class="rounded-sm border border-line dark:border-sage/60 bg-soft dark:bg-card px-2 py-1.5" />
                <input id="link-url-${topic.id}" type="url" placeholder="https://..." maxlength="500" class="rounded-sm border border-line dark:border-sage/60 bg-soft dark:bg-card px-2 py-1.5" />
              </div>
              <div class="flex flex-wrap gap-2 items-center">
                <select id="link-lang-${topic.id}" class="rounded-sm border border-line dark:border-sage/60 bg-soft dark:bg-card px-2 py-1.5">
                  <option value="pt">PT</option>
                  <option value="en">EN</option>
                </select>
                <select id="link-kind-${topic.id}" class="rounded-sm border border-line dark:border-sage/60 bg-soft dark:bg-card px-2 py-1.5">
                  <option value="leitura">Leitura</option>
                  <option value="documentacao">Documentação</option>
                  <option value="curso">Curso</option>
                  <option value="pratica">Prática</option>
                  <option value="video">Vídeo</option>
                </select>
                <button type="button" data-action="add-topic-link" data-item-id="${topic.id}" class="px-3 py-1.5 rounded-sm bg-terra dark:bg-ochre text-paper dark:text-night font-semibold">Salvar link</button>
              </div>
            </div>
          ` : ''}
          ${noteOpen ? `
            <label class="block mt-3 text-xs font-mono text-muted" for="note-${topic.id}">Anotações pessoais</label>
            <textarea id="note-${topic.id}" data-action="edit-note" data-item-id="${topic.id}" rows="3" class="mt-1 w-full rounded-sm border border-line dark:border-sage/60 bg-paper dark:bg-night p-2 text-sm">${escapeHtml(topic.note || '')}</textarea>
          ` : ''}
        </div>
      </div>
    </article>`;
}

function renderGuide(project) {
  const steps = project.steps || [];
  const criteria = project.definitionOfDone || [];
  if (!steps.length && !criteria.length) return '';
  const checks = (activeTrackState().guideChecks || {})[project.id] || { steps: {}, criteria: {} };
  const line = (group, text, index) => `
    <label class="read flex gap-2 text-muted dark:text-blush">
      <input type="checkbox" data-action="guide-check" data-project-id="${project.id}" data-guide-group="${group}" data-index="${index}" ${checks[group]?.[index] ? 'checked' : ''} />
      <span>${escapeHtml(text)}</span>
    </label>`;
  return `
    <details class="mt-2">
      <summary class="text-xs font-semibold">Roteiro e definição de pronto</summary>
      ${steps.length ? `<ol class="mt-2 space-y-1 list-decimal pl-4">${steps.map((step, index) => `<li>${line('steps', step, index)}</li>`).join('')}</ol>` : ''}
      ${criteria.length ? `<p class="mt-3 text-xs font-mono text-muted">Definição de pronto</p><div class="space-y-2">${criteria.map((item, index) => line('criteria', item, index)).join('')}</div>` : ''}
    </details>`;
}

function renderProject(project) {
  const strike = project.done && state.strikethrough ? 'line-through' : '';
  const actions = project.custom
    ? `${miniButton('Editar', `data-action="edit-project" data-project-id="${project.id}"`)}${miniButton('Excluir', `data-action="delete-project" data-project-id="${project.id}"`, 'text-terra')}`
    : '';
  const sourceTrackId = project.sourceTrackId || activeTrack()?.id || '';
  const sourceBadge = isCombinedView() && project.sourceTrackName
    ? ` · ${escapeHtml(project.sourceTrackName)}`
    : '';
  return `
    <li class="flex items-start gap-3 py-3">
      ${checkbox(project.done, `data-action="toggle-project" data-project-id="${project.id}" data-source-track="${escapeHtml(sourceTrackId)}"`, `${project.done ? 'Desmarcar projeto' : 'Concluir projeto'} ${project.title}`)}
      <div class="min-w-0">
        <p class="text-sm font-semibold ${strike}">${escapeHtml(project.title)}</p>
        <p class="read text-muted dark:text-blush mt-3">${escapeHtml(project.description)}</p>
        <p class="mt-1 text-[11px] font-mono text-muted">${LEVEL_LABELS[project.level]} · ${Number(project.hours) || 0} h${project.custom ? ' · sua ideia' : ''}${sourceBadge}</p>
        ${renderGuide(project)}
        <div class="mt-1 flex gap-1.5">${actions}</div>
      </div>
    </li>`;
}

function renderPhase(phase, query, phaseHit) {
  const trackState = activeTrackState();
  const progress = phase.progress;
  const collapsed = !!trackState.collapsedPhases[phase.id];
  const requiredHours = phase.topics
    .filter((topic) => topic.status === 'required')
    .reduce((sum, topic) => sum + (Number(topic.hours) || 0), 0);
  const duration = requiredHours
    ? formatDuration(requiredHours, trackState.weeklyHours)
    : 'Sem tópicos obrigatórios neste nível';
  const topics = phase.topics.filter((topic) => {
    if (session.filter === 'hidden') return topic.status === 'hidden' && (phaseHit || topicMatches(topic, query));
    if (topic.status === 'hidden') return false;
    if (session.filter === 'pending' && topic.done) return false;
    if (session.filter === 'completed' && !topic.done) return false;
    if (session.filter === 'optional' && topic.status !== 'optional') return false;
    if (query && !phaseHit && !topicMatches(topic, query)) return false;
    return true;
  });
  const levelProjects = visibleProjects(phase.projects, trackState.level, trackState.showAllProjectLevels);
  const projects = levelProjects.filter((project) => {
    if (session.filter === 'hidden' || session.filter === 'optional') return false;
    if (session.filter === 'pending' && project.done) return false;
    if (session.filter === 'completed' && !project.done) return false;
    if (query && !phaseHit && !projectMatches(project, query)) return false;
    return true;
  });
  if (!topics.length && !projects.length) return '';

  const titleById = new Map();
  const doneIds = new Set();
  const view = activeView();
  view.phases.forEach((item) => {
    item.topics.forEach((topic) => {
      titleById.set(topic.id, topic.title);
      if (topic.done) doneIds.add(topic.id);
    });
  });
  const noteHit = query && phase.note.toLowerCase().includes(query);
  const notesKnown = Object.prototype.hasOwnProperty.call(session.openPhaseNotes, phase.id);
  const notesOpen = noteHit || (notesKnown ? session.openPhaseNotes[phase.id] : phase.note.trim().length > 0);
  const allIndexes = phase.topics;
  let branchSide = 0;
  const mapNodes = topics.map((topic) => {
    const isCheckpoint = /\bcheckpoint\b/i.test(topic.title || '');
    const wrapClass = isCheckpoint ? 'is-checkpoint-wrap' : (branchSide++ % 2 === 0 ? 'is-left' : 'is-right');
    return `<div class="roadmap-branch ${wrapClass}">${renderTopicNode(topic, titleById, doneIds)}</div>`;
  }).join('');
  const items = session.viewMode === 'map'
    ? `<div class="roadmap-branches">${mapNodes}</div>`
    : `<div class="divide-y divide-line dark:divide-sage/40">${topics.map((topic) => renderTopic(
      topic,
      phase,
      allIndexes.findIndex((item) => item.id === topic.id),
      allIndexes.length,
      titleById,
      doneIds,
    )).join('')}</div>`;
  const otherLevels = phase.projects.some((project) => project.level !== trackState.level);
  const projectHint = trackState.showAllProjectLevels
    ? 'Mostrando todos os níveis.'
    : `Mostrando ideias de nível ${LEVEL_LABELS[trackState.level]}.`;
  const emptyProjects = !projects.length
    ? `<p class="text-xs text-muted">${session.filter === 'pending' ? 'Nenhum projeto pendente nesta etapa.' : `Nenhuma ideia de nível ${LEVEL_LABELS[trackState.level]} nesta etapa.`}</p>${otherLevels && !trackState.showAllProjectLevels ? '<button type="button" data-action="show-all-projects" class="mt-2 text-xs underline">Ver outros níveis</button>' : ''}`
    : `<ul class="divide-y divide-line dark:divide-sage/40">${projects.map(renderProject).join('')}</ul>`;

  return `
    <section id="phase-${phase.id}" class="rounded-sm bg-soft dark:bg-card border ${progress.complete ? 'border-emerald dark:border-emerald-400' : 'border-line dark:border-sage/50'} overflow-hidden">
      <div class="p-4 sm:p-5 border-b border-line dark:border-sage/50">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button type="button" data-action="toggle-phase" data-phase-id="${phase.id}" aria-expanded="${!collapsed}" class="flex items-center gap-3 text-left">
            <span class="phase-index ${progress.complete ? 'is-on' : ''} ${progress.done > 0 && !progress.complete ? 'is-partial' : ''}">${progress.complete ? CHECK_SVG : progress.done > 0 ? DASH_SVG : String(phase.number).padStart(2, '0')}</span>
            <span>
              <h2 class="text-base sm:text-lg font-bold">Etapa ${phase.number}: ${escapeHtml(phase.title)}</h2>
              <span class="block text-xs text-muted font-mono">${escapeHtml(duration)}${phase.note.trim() ? ' · com observações' : ''}</span>
            </span>
          </button>
          <div class="flex flex-wrap items-center gap-2 pl-11 sm:pl-0">
            <span class="px-2.5 py-1 rounded-sm text-xs font-mono border ${progress.complete ? 'border-terra text-terra dark:border-ochre dark:text-ochre' : 'border-line dark:border-sage/60'}">${progress.done}/${progress.total}</span>
            ${(phase.quiz || []).length ? miniButton(quizScore(phase.quiz, trackState.quizAnswers).needsReview ? 'Revisar' : 'Autoavaliação', `data-action="open-quiz" data-quiz-scope="phase" data-phase-id="${phase.id}"`) : ''}
            ${miniButton(progress.complete ? 'Desmarcar etapa' : 'Concluir etapa', `data-action="toggle-phase-done" data-phase-id="${phase.id}"`)}
            ${miniButton('Subir etapa', `data-action="move-phase" data-phase-id="${phase.id}" data-dir="-1"`)}
            ${miniButton('Descer etapa', `data-action="move-phase" data-phase-id="${phase.id}" data-dir="1"`)}
            <button type="button" data-action="toggle-phase" data-phase-id="${phase.id}" aria-label="${collapsed ? 'Expandir etapa' : 'Recolher etapa'}" class="px-2 py-1">${collapsed ? '▸' : '▾'}</button>
          </div>
        </div>
        <div class="mt-3 h-1.5 rounded-sm bg-line/40 dark:bg-card overflow-hidden">
          <div class="progress-fill" style="width:${progress.percent}%"></div>
        </div>
      </div>
      ${collapsed ? '' : `
        ${items}
        <div class="p-4 sm:px-5 border-t border-line dark:border-sage/50">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-bold">Ideias de projeto</h3>
            <button type="button" data-action="add-project" data-phase-id="${phase.id}" class="text-xs font-semibold text-terra dark:text-ochre">Adicionar ideia</button>
          </div>
          <p class="mt-1 text-xs text-muted">${projectHint}</p>
          ${session.filter === 'optional' || session.filter === 'hidden' ? '<p class="mt-2 text-xs text-muted">As ideias de projeto ficam de fora deste filtro.</p>' : `<div class="mt-2">${emptyProjects}</div>`}
          <details class="mt-4" data-phase-notes data-phase-id="${phase.id}" ${notesOpen ? 'open' : ''}>
            <summary class="text-sm font-semibold">Observações${phase.note.trim() ? ' · texto salvo' : ''}</summary>
            <label class="sr-only" for="obs-${phase.id}">Observações desta etapa</label>
            <textarea id="obs-${phase.id}" data-action="edit-phase-note" data-phase-id="${phase.id}" rows="3" class="mt-2 w-full rounded-sm border border-line dark:border-sage/60 bg-paper dark:bg-night p-2 text-sm" placeholder="O que você quer lembrar desta etapa">${escapeHtml(phase.note)}</textarea>
          </details>
        </div>
      `}
    </section>`;
}

function renderPhaseFlowchart(view) {
  const container = $('phaseFlowchart');
  if (!container) return;
  if (!view.phases.length) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.hidden = false;
  const nodes = view.phases.map((phase, index) => {
    const p = phase.progress;
    const cls = p.complete ? 'is-done' : (p.done > 0 ? 'is-active' : '');
    const arrow = index < view.phases.length - 1 ? '<span class="flow-arrow" aria-hidden="true">→</span>' : '';
    return `
      <button type="button" data-flow-phase="${phase.id}" class="flow-node ${cls}">
        <span class="font-mono text-xs font-semibold ${p.complete ? 'text-emerald dark:text-emerald-300' : 'text-terra dark:text-ochre'}">Etapa ${phase.number}</span>
        <span class="font-semibold">${escapeHtml(phase.title)}</span>
        <span class="font-mono text-xs text-muted">${p.done}/${p.total}</span>
      </button>${arrow}`;
  }).join('');
  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h2 class="text-sm font-bold">Fluxograma das etapas</h2>
      <span class="text-xs text-muted">Clique em uma etapa para ir direto ao conteúdo</span>
    </div>
    <div class="flow-track">${nodes}</div>`;
}

function renderMapLegend() {
  return `
    <div class="roadmap-legend" aria-label="Legenda do mapa visual">
      <span><span class="legend-swatch border-2 border-terra dark:border-ochre bg-paper dark:bg-card"></span>Obrigatório</span>
      <span><span class="legend-swatch border-2 border-dashed border-amber-600 dark:border-amber-400 bg-paper dark:bg-card"></span>Opcional</span>
      <span><span class="legend-swatch border-2 border-emerald dark:border-emerald-400 bg-emerald/15"></span>Concluído ✓</span>
      <span><span class="legend-swatch border-2 border-terra dark:border-ochre bg-gradient-to-br from-blue-500/20 to-emerald-500/20"></span>Checkpoint</span>
      <span class="text-muted">Passe o mouse em um tópico para destacar os pré-requisitos</span>
    </div>`;
}

function renderRoadmap() {
  const track = activeTrack();
  const trackState = activeTrackState();
  const container = $('conteudo');
  const focus = captureFocus();
  const y = window.scrollY;
  const view = activeView();
  renderPhaseFlowchart(view);
  const query = session.search.trim().toLowerCase();
  const html = view.phases.map((phase) => {
    const phaseHit = !!query && `${phase.title} ${phase.badgeTitle} ${phase.note}`.toLowerCase().includes(query);
    return renderPhase(phase, query, phaseHit);
  }).join('');
  container.classList.toggle('is-map-mode', session.viewMode === 'map');
  container.innerHTML = session.viewMode === 'map' && html.trim().length > 0
    ? `${renderMapLegend()}${html}`
    : html;
  $('emptyState').hidden = html.trim().length > 0;
  const orphans = $('orphans');
  if (view.orphans.length) {
    orphans.hidden = false;
    orphans.innerHTML = `
      <section class="rounded-sm border border-ochre p-4">
        <h2 class="font-bold">Ideias sem etapa</h2>
        <ul>${view.orphans.map(renderProject).join('')}</ul>
      </section>`;
  } else {
    orphans.hidden = true;
    orphans.innerHTML = '';
  }
  window.scrollTo(0, y);
  restoreFocus(focus);
}

function updateDashboard() {
  const track = activeTrack();
  const trackState = activeTrackState();
  const view = activeView();
  const stats = roadmapStats(view.phases);
  const projects = projectPlanStats(view.phases, trackState.level);
  const focus = currentPhase(view.phases);
  $('overallPercent').textContent = `${stats.percent}%`;
  $('overallCounter').textContent = `${stats.requiredDone} de ${stats.required} tópicos do plano`;
  $('overallProgressBar').style.width = `${stats.percent}%`;
  $('overallStatusTag').textContent = stats.percent === 0 ? 'Pronto para começar' : stats.percent === 100 ? 'Plano concluído' : 'Em andamento';
  $('planEstimate').textContent = stats.hours
    ? `Plano de ${formatDuration(stats.hours, trackState.weeklyHours)}. Restam ${formatDuration(stats.hoursLeft, trackState.weeklyHours)}.`
    : 'Nenhum tópico obrigatório neste nível. Os opcionais continuam na lista.';
  const optionalText = stats.optional ? ` ${stats.optional} opcionais fora da conta.` : '';
  $('planEstimate').textContent += optionalText;
  $('projectCounter').textContent = `Projetos deste nível: ${projects.done} de ${projects.total}${projects.hours ? ` · cerca de ${projects.hours} h, à parte do plano` : ''}`;
  $('currentPhaseName').textContent = focus ? `Etapa ${focus.number}: ${focus.title}` : 'Você concluiu os tópicos obrigatórios desta trilha.';
  $('currentPhaseSub').textContent = focus
    ? `${focus.progress.requiredDone}/${focus.progress.requiredTotal} tópicos obrigatórios nesta etapa`
    : 'As ideias de projeto e os tópicos opcionais continuam disponíveis.';
  $('levelLabel').textContent = `Nível ${LEVEL_LABELS[trackState.level]} · ${track.name}`;
  $('optionalHint').textContent = stats.optional
    ? `Há ${stats.optional} tópico(s) abaixo do nível ${LEVEL_LABELS[trackState.level]}.`
    : 'Nada abaixo do seu nível ficou de fora.';
  const hours = $('weeklyHoursInput');
  if (document.activeElement !== hours) hours.value = trackState.weeklyHours;
  $('includeBelowLevel').checked = trackState.includeBelowLevel;
  $('allProjectLevels').checked = trackState.showAllProjectLevels;
  $('strikethroughToggle').checked = state.strikethrough;
  $('badgesUnlockedCounter').textContent = `${stats.badges}/${view.phases.length} desbloqueadas`;
  $('badgesContainer').innerHTML = view.phases.map((phase) => `
    <div class="flex items-center gap-2 p-2.5 rounded-sm border ${phase.progress.complete ? 'border-terra dark:border-ochre' : 'border-line dark:border-sage/50'}" title="${escapeHtml(phase.badgeTitle)}">
      <span class="phase-index ${phase.progress.complete ? 'is-on' : ''} ${phase.progress.done > 0 && !phase.progress.complete ? 'is-partial' : ''}">${phase.progress.complete ? CHECK_SVG : phase.progress.done > 0 ? DASH_SVG : phase.number}</span>
      <span class="min-w-0"><span class="block text-[11px] font-bold truncate">${escapeHtml(phase.badgeTitle)}</span><span class="text-[10px] font-mono">${phase.progress.done}/${phase.progress.total}</span></span>
    </div>`).join('');
  $('footerStats').textContent = `${view.phases.length} etapas · ${stats.required} tópicos no plano · ${projects.total} projetos deste nível`;
  const allCollapsed = view.phases.every((phase) => trackState.collapsedPhases[phase.id]);
  $('toggleAllPhasesLabel').textContent = allCollapsed ? 'Expandir todas' : 'Recolher todas';
  document.querySelectorAll('.filter-btn').forEach((button) => {
    const active = button.dataset.filter === session.filter;
    button.className = `filter-btn px-3 py-1.5 rounded-sm text-xs sm:text-sm ${active ? 'bg-soft dark:bg-card text-terra dark:text-ochre font-semibold' : 'text-muted dark:text-blush'}`;
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderRenameNotice() {
  const notice = $('renameNotice');
  if (!notice) return;
  const show = state.activeTrackId === CIENCIA_DE_DADOS_ID
    && !(state.profile.dismissedNotices || []).includes('dados-ciencia');
  notice.hidden = !show;
  if (show) {
    $('renameNoticeText').textContent = 'Esta trilha se chamava Dados. O nome agora é Ciência de Dados, e o progresso dos tópicos que você já marcou continua aqui. Analista de Dados, Engenharia de Dados e Machine Learning são trilhas separadas.';
  }
}

function renderTrackSwitcher() {
  const nav = $('trackSwitcher');
  if (!nav) return;
  const ids = [];
  if (state.profile.primaryTrackId && trackById(state.profile.primaryTrackId)) {
    ids.push(state.profile.primaryTrackId);
  }
  for (const id of state.profile.companionIds || []) {
    if (trackById(id) && !ids.includes(id)) ids.push(id);
  }
  if (state.activeTrackId && trackById(state.activeTrackId) && !ids.includes(state.activeTrackId)) {
    ids.unshift(state.activeTrackId);
  }
  if (ids.length < 2) {
    nav.hidden = true;
    nav.innerHTML = '';
    return;
  }
  nav.hidden = false;
  const combinedActive = isCombinedView();
  const combinedBtn = `<button type="button" class="track-switch inline-flex items-center gap-2" data-switch-track="__combined__"${combinedActive ? ' aria-current="page"' : ''}><span>Trajeto completo</span></button>`;
  nav.innerHTML = combinedBtn + ids.map((id) => {
    const track = trackById(id);
    const current = !combinedActive && id === state.activeTrackId ? ' aria-current="page"' : '';
    return `<button type="button" class="track-switch inline-flex items-center gap-2" data-switch-track="${escapeHtml(id)}"${current}>${trackIconHtml(id, 'sm')}<span>${escapeHtml(track.name)}</span></button>`;
  }).join('');
}

function renderTrackSidebar() {
  const list = $('sidebarList');
  if (!list) return;
  const group = session.sidebarGroup || 'all';
  const query = session.sidebarQuery || '';
  const allGroups = groupTracks(tracks);
  $('sidebarGroups').innerHTML = [{ id: 'all', title: 'Todas' }, ...allGroups].map((g) => (
    `<button type="button" class="sidebar-chip" data-sidebar-group="${escapeHtml(g.id)}" aria-pressed="${g.id === group}">${escapeHtml(g.title)}</button>`
  )).join('');
  const visible = new Set(tracksMatching(tracks, query).map((t) => t.id));
  const planned = new Set([state.profile.primaryTrackId, ...(state.profile.companionIds || [])].filter(Boolean));
  const html = allGroups
    .filter((g) => group === 'all' || g.id === group)
    .map((g) => {
      const items = g.tracks.filter((t) => visible.has(t.id)).map((t) => {
        const current = t.id === state.activeTrackId ? ' aria-current="page"' : '';
        const dot = planned.has(t.id) ? '<span class="sidebar-dot" title="No seu plano"></span>' : '';
        return `<li><button type="button" class="sidebar-item" data-sidebar-track="${escapeHtml(t.id)}"${current}>${trackIconHtml(t.id, 'sm')}<span class="min-w-0 truncate">${escapeHtml(t.name)}</span>${dot}</button></li>`;
      }).join('');
      return items ? `<div><p class="text-[11px] font-mono uppercase tracking-wider text-muted">${escapeHtml(g.title)}</p><ul class="mt-1.5 space-y-0.5">${items}</ul></div>` : '';
    }).join('');
  list.innerHTML = html || '<p class="text-xs text-muted">Nenhuma trilha com esse termo.</p>';
}

function setSidebarOpen(open) {
  $('trackSidebar').classList.toggle('is-open', open);
  $('sidebarBackdrop').hidden = !open;
  $('sidebarToggleBtn').setAttribute('aria-expanded', String(open));
  if (open) $('sidebarSearch').focus();
}

function switchToTrack(id) {
  if (id === '__combined__') {
    session.combinedView = true;
    if (state.profile.primaryTrackId && trackById(state.profile.primaryTrackId)) {
      state.activeTrackId = state.profile.primaryTrackId;
    }
    persist();
    refresh();
    return;
  }
  if (!trackById(id)) return;
  if (id === state.activeTrackId && !session.combinedView) return;
  session.combinedView = false;
  const current = activeTrackState();
  const next = ensureTrack(state, id);
  if (!next.level) next.level = current?.level || 'iniciante';
  if (!next.weeklyHours) next.weeklyHours = current?.weeklyHours || 6;
  state.activeTrackId = id;
  persist();
  refresh();
}

function updateHeader() {
  const track = activeTrack();
  if (isCombinedView()) {
    const names = activeEntries().map((e) => e.track.name);
    $('trackBadge').textContent = 'Trajeto completo';
    $('trackTagline').textContent = `Sequência integrada do básico ao avançado: ${names.join(' + ')}`;
    $('trackIcon').innerHTML = trackIconHtml(track.id, 'lg');
    document.title = `Rumos — Trajeto completo (${track.name})`;
  } else {
    $('trackBadge').textContent = track.name;
    $('trackTagline').textContent = track.description;
    $('trackIcon').innerHTML = trackIconHtml(track.id, 'lg');
    document.title = `Rumos — ${track.name}`;
  }
  renderTrackSwitcher();
  renderTrackSidebar();
  renderRenameNotice();
}

function refresh() {
  applyTheme();
  if (!isReady(state) || !activeTrack()) {
    openOnboarding(state.profile.onboarded ? 'retake' : 'create');
    return;
  }
  showScreen('app');
  updateHeader();
  updateDashboard();
  renderRoadmap();
  if ($('topicDetailDialog').open && session.detailTopicId) renderTopicDetail(session.detailTopicId);
}

function choiceCard(name, value, title, text, selected, type = 'radio', iconHtml = '') {
  const checked = selected ? 'checked' : '';
  const body = iconHtml
    ? `<span class="flex items-start gap-3">${iconHtml}<span class="min-w-0 flex-1"><span class="block font-semibold">${escapeHtml(title)}</span><span class="block mt-1 text-xs text-muted">${escapeHtml(text)}</span></span></span>`
    : `<span class="block font-semibold">${escapeHtml(title)}</span><span class="block mt-1 text-xs text-muted">${escapeHtml(text)}</span>`;
  return `<label class="choice-card ${selected ? 'is-selected' : ''}" data-choice="${escapeHtml(name)}" data-value="${escapeHtml(value)}" data-track-card data-search="">
    <input class="sr-only" type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${checked} />
    ${body}
  </label>`;
}

function paintChoices() {
  document.querySelectorAll('.choice-card').forEach((card) => {
    const input = card.querySelector('input');
    card.classList.toggle('is-selected', input.checked);
  });
}

function trackSearchBlob(track) {
  return [track.name, track.tagline, track.description, ...(track.keywords || [])].join(' ');
}

function renderOnboardingChoices() {
  const draft = session.onboarding;
  const groups = groupTracks(tracks);
  const careerGroups = groups.filter((g) => g.id === 'carreira');
  const addonGroups = groups.filter((g) => g.id === 'fundamentos' || g.id === 'tecnologia');
  $('onbTrackGroups').innerHTML = careerGroups.map((group) => {
    const cards = group.tracks.map((track) => {
      const card = choiceCard('track', track.id, track.name, track.tagline, draft.trackId === track.id, 'radio', trackIconHtml(track.id, 'md'));
      return card.replace('data-search=""', `data-search="${escapeHtml(trackSearchBlob(track))}"`);
    }).join('');
    return `<fieldset class="onb-group" data-track-group="${escapeHtml(group.id)}">
      <legend class="text-sm font-bold">${escapeHtml(group.title)}</legend>
      <p class="mt-1 text-xs text-muted dark:text-blush">${escapeHtml(group.lead)}</p>
      <div class="mt-3 grid sm:grid-cols-2 gap-3">${cards}</div>
    </fieldset>`;
  }).join('');
  $('onbCompanionList').innerHTML = addonGroups.map((group) => {
    const cards = group.tracks.map((track) => {
      const card = choiceCard('companion', track.id, track.name, track.tagline, draft.companionIds.includes(track.id), 'checkbox', trackIconHtml(track.id, 'md'));
      return card.replace('data-search=""', `data-search="${escapeHtml(trackSearchBlob(track))}" data-companion`);
    }).join('');
    return `<fieldset class="onb-group">
      <legend class="text-sm font-bold">${escapeHtml(group.title)}</legend>
      <p class="mt-1 text-xs text-muted dark:text-blush">${escapeHtml(group.lead)}</p>
      <div class="mt-3 grid sm:grid-cols-2 gap-3">${cards}</div>
    </fieldset>`;
  }).join('');
  $('onbSearch').value = draft.query || '';
  filterOnboarding(draft.query || '');
  syncCompanionLocks();
  $('onbStep3').innerHTML = `<legend class="sr-only">Nível atual</legend>${LEVELS.map((level) => choiceCard(
    'level',
    level,
    LEVEL_LABELS[level],
    LEVEL_COPY[level],
    draft.level === level,
  )).join('')}`;
  $('hourChoices').innerHTML = HOUR_PRESETS.map((hours) => choiceCard(
    'hours',
    String(hours),
    `${hours} h`,
    'por semana',
    draft.hours === hours,
  )).join('') + choiceCard('hours', 'custom', 'Outro', 'informar horas', draft.hours && !HOUR_PRESETS.includes(draft.hours));
  if (draft.hours && !HOUR_PRESETS.includes(draft.hours)) $('hoursCustom').value = draft.hours;
}

function filterOnboarding(query) {
  const needle = query.trim();
  const visible = new Set(tracksMatching(tracks, needle).map((track) => track.id));
  let count = 0;
  document.querySelectorAll('#onbTrackGroups [data-track-card]').forEach((card) => {
    const show = visible.has(card.dataset.value);
    card.hidden = !show;
    if (show) count += 1;
  });
  document.querySelectorAll('#onbTrackGroups [data-track-group]').forEach((group) => {
    group.hidden = ![...group.querySelectorAll('[data-track-card]')].some((card) => !card.hidden);
  });
  $('onbSearchStatus').textContent = !needle
    ? ''
    : count === 0
      ? 'Nenhuma carreira com esse termo.'
      : `${count} ${count === 1 ? 'carreira' : 'carreiras'}`;
}

function syncCompanionLocks() {
  const primary = selectedRadio('track') || session.onboarding.trackId;
  document.querySelectorAll('input[name="companion"]').forEach((input) => {
    const same = input.value === primary;
    input.disabled = same;
    if (same) input.checked = false;
  });
  paintChoices();
}

function selectedCompanionIds() {
  return [...document.querySelectorAll('input[name="companion"]:checked')].map((input) => input.value);
}

const STEP_COPY = [
  ['Qual carreira é o seu objetivo?', 'Escolha sua trilha principal de carreira. Ao selecionar, você avança automaticamente para o próximo passo.'],
  ['Quer adicionar fundamentos ou linguagens?', 'Opcional. Marque quantas trilhas adicionais quiser estudar em paralelo e clique em Continuar.'],
  ['Qual é o seu nível hoje?', 'Tópicos abaixo desse nível entram como opcionais. Eles continuam visíveis.'],
  ['Quantas horas por semana você consegue estudar?', 'A estimativa de cada etapa usa esse ritmo. Dá para ajustar depois.'],
  ['Seu plano', 'Confira a carreira, as trilhas adicionais e as etapas antes de gerar seu roadmap completo.'],
];

function goToStep(step) {
  session.onboarding.step = step;
  for (let index = 0; index <= 5; index += 1) $(`onbStep${index}`).hidden = index !== step;
  if (step === 0) {
    $('onbStepLabel').textContent = 'Boas-vindas';
    $('onbHeading').textContent = 'Planeje seus estudos em tecnologia com clareza';
    $('onbLead').textContent = 'Entenda como o Rumos funciona e monte seu roadmap personalizado em poucos cliques.';
    $('onbNavRow').hidden = true;
    $('welcomeBackBtn').hidden = !isReady(state) || !activeTrack();
    return;
  }
  const [heading, lead] = STEP_COPY[step - 1];
  $('onbStepLabel').textContent = `Passo ${step} de 5`;
  $('onbHeading').textContent = heading;
  $('onbLead').textContent = session.onboarding.mode === 'retake' && step === 5
    ? 'Progresso, anotações, observações e ideias criadas por você continuam. Opcionais e ocultos desta trilha voltam para a recomendação do novo nível.'
    : lead;
  $('onbNavRow').hidden = false;
  $('onbBack').hidden = false;
  $('onbNext').hidden = step === 5;
  $('onbStart').hidden = step !== 5;
  $('onbStart').textContent = session.onboarding.mode === 'retake' ? 'Atualizar trilha' : 'Gerar roadmap completo';
  if (step === 5) renderPreview();
}

function selectedRadio(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || null;
}

function selectedHours() {
  const picked = selectedRadio('hours');
  if (!picked) return null;
  if (picked === 'custom') return clampHours($('hoursCustom').value);
  return clampHours(picked);
}

function renderPreview() {
  const track = trackById(session.onboarding.trackId);
  const level = session.onboarding.level;
  const hours = session.onboarding.hours;
  if (!track || !level || !hours) {
    $('planPreview').textContent = 'Faltou alguma resposta. Volte um passo.';
    return;
  }
  const temp = emptyTrackState();
  temp.level = level;
  temp.weeklyHours = hours;
  const existing = state.tracks[track.id];
  if (existing) {
    temp.customTopics = existing.customTopics;
    temp.customProjects = existing.customProjects;
  }
  const companionIds = document.querySelector('input[name="companion"]')
    ? selectedCompanionIds().filter((id) => id !== track.id)
    : session.onboarding.companionIds.filter((id) => id !== track.id);
  session.onboarding.companionIds = companionIds;
  const entries = [{ track, trackState: temp }];
  for (const cid of companionIds) {
    const cTrack = trackById(cid);
    if (!cTrack) continue;
    const cTemp = { ...emptyTrackState(), level, weeklyHours: hours };
    entries.push({ track: cTrack, trackState: cTemp });
  }
  const view = buildCombinedRoadmap(entries);
  const stats = roadmapStats(view.phases);
  const projects = projectPlanStats(view.phases, level);
  const phases = view.phases.map((phase) => {
    const phaseHours = phase.topics
      .filter((topic) => topic.status === 'required')
      .reduce((sum, topic) => sum + (Number(topic.hours) || 0), 0);
    return `<li class="flex justify-between gap-3 py-2 border-t border-line dark:border-sage/50"><span>Etapa ${phase.number}: ${escapeHtml(phase.title)}</span><span class="font-mono text-xs shrink-0">${escapeHtml(phaseHours ? formatDuration(phaseHours, hours) : 'opcional')}</span></li>`;
  }).join('');
  const companionNames = companionIds.map((id) => trackById(id)?.name).filter(Boolean);
  const together = companionNames.length
    ? `<p class="mt-2 text-sm">Trilhas combinadas: ${escapeHtml(companionNames.join(', '))}. O trajeto já está ordenado do mais básico ao mais avançado.</p>`
    : '';
  $('planPreview').innerHTML = `
    <p class="font-semibold">${escapeHtml(track.name)} · ${LEVEL_LABELS[level]} · ${hours} h/semana</p>
    ${together}
    <p class="read mt-3 text-muted dark:text-blush">${stats.required} tópicos obrigatórios, ${stats.optional} opcionais e ${projects.total} ideias de projeto neste nível. ${escapeHtml(formatDuration(stats.hours, hours))} no ritmo escolhido.</p>
    <ol class="mt-3 text-sm">${phases}</ol>`;
}

function openOnboarding(mode, initialStep = mode === 'create' ? 0 : 1) {
  session.onboarding.mode = mode;
  const current = activeTrackState();
  session.onboarding.trackId = mode === 'retake' ? state.activeTrackId : session.onboarding.trackId;
  session.onboarding.level = mode === 'retake' ? current?.level : session.onboarding.level;
  session.onboarding.hours = mode === 'retake' ? current?.weeklyHours : session.onboarding.hours;
  session.onboarding.companionIds = mode === 'retake'
    ? [...(state.profile.companionIds || [])]
    : session.onboarding.companionIds;
  session.onboarding.query = '';
  renderOnboardingChoices();
  showScreen('onboarding');
  goToStep(initialStep);
}

function confirmOnboarding() {
  const { trackId, level, hours } = session.onboarding;
  const existing = state.tracks[trackId];
  const kept = existing
    ? {
      completed: existing.completed,
      notes: existing.notes,
      phaseNotes: existing.phaseNotes,
      completedProjects: existing.completedProjects,
      customTopics: existing.customTopics,
      customProjects: existing.customProjects,
      phaseOrder: existing.phaseOrder,
      topicOrder: existing.topicOrder,
      collapsedPhases: existing.collapsedPhases,
      showAllProjectLevels: existing.showAllProjectLevels,
      quizAnswers: existing.quizAnswers,
      guideChecks: existing.guideChecks,
      studyPlan: existing.studyPlan,
    }
    : null;
  const track = ensureTrack(state, trackId);
  if (kept) Object.assign(track, kept);
  track.level = level;
  track.weeklyHours = hours;
  track.includeBelowLevel = false;
  track.overrides = {};
  const companionIds = selectedCompanionIds().filter((id) => id !== trackId);
  state.profile.primaryTrackId = trackId;
  state.profile.companionIds = companionIds;
  for (const id of companionIds) {
    const companion = ensureTrack(state, id);
    if (!companion.level) companion.level = level;
    if (!companion.weeklyHours) companion.weeklyHours = hours;
  }
  state.activeTrackId = trackId;
  state.profile.onboarded = true;
  session.combinedView = companionIds.length > 0;
  persist();
  toast(session.onboarding.mode === 'retake' ? 'Trilha atualizada. Seu progresso continua salvo.' : 'Roadmap pronto. Bom estudo.');
  refresh();
}

function findTopic(topicId, sourceTrackId = null) {
  const view = activeView();
  for (const phase of view.phases) {
    const topic = phase.topics.find((item) => item.id === topicId && (!sourceTrackId || item.sourceTrackId === sourceTrackId));
    if (topic) return { phase, topic };
  }
  return null;
}

function poolOf(phase) {
  const required = phase.topics.filter((topic) => topic.status === 'required');
  return required.length ? required : phase.topics.filter((topic) => topic.status !== 'hidden');
}

async function askConfirm({ title, body, confirmLabel, danger = true }) {
  $('confirmTitle').textContent = title;
  $('confirmBody').textContent = body;
  $('confirmAccept').textContent = confirmLabel;
  $('confirmAccept').className = danger
    ? 'px-4 py-2 rounded-sm text-sm font-semibold bg-terra text-paper'
    : 'px-4 py-2 rounded-sm text-sm font-semibold bg-terra text-paper dark:bg-ochre dark:text-night';
  const dialog = $('confirmDialog');
  const result = await new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      resolve(dialog.returnValue === 'confirm');
    };
    dialog.addEventListener('close', onClose);
    dialog.showModal();
  });
  return result;
}

function renderDialogResources() {
  const list = $('topicResourcesList');
  if (!list) return;
  list.innerHTML = session.dialogResources.map((res, idx) => `
    <li class="flex items-center justify-between gap-2 px-2 py-1 rounded-sm border border-line dark:border-sage/50">
      <span class="truncate">${escapeHtml(res.title)} (${res.lang === 'en' ? 'EN' : 'PT'} · ${KIND_LABEL[res.kind] || 'Leitura'})</span>
      <button type="button" data-remove-dialog-res="${idx}" class="text-terra underline shrink-0">Remover</button>
    </li>`).join('');
}

function openTopicDialog(topic) {
  editingTopicId = topic?.id || null;
  $('topicDialogTitle').textContent = topic ? 'Editar tópico' : 'Novo tópico';
  fillPhaseSelect($('topicPhase'), topic?.phaseId || activeTrack().phases[0].id);
  $('topicTitle').value = topic?.title || '';
  $('topicDescription').value = topic?.description || '';
  fillLevelSelect($('topicLevel'), topic?.level || activeTrackState().level);
  $('topicHours').value = topic?.hours || 4;
  $('topicTags').value = (topic?.tags || []).join(', ');
  session.dialogResources = (topic?.resources || []).filter((r) => !r.custom || topic?.custom).map((r) => ({
    title: r.title,
    url: r.url,
    lang: r.lang === 'en' ? 'en' : 'pt',
    kind: r.kind || 'leitura',
  }));
  $('topicResourceTitle').value = '';
  $('topicResourceUrl').value = '';
  $('topicResourceLang').value = 'pt';
  $('topicResourceKind').value = 'leitura';
  renderDialogResources();
  $('topicDialog').showModal();
}

function openProjectDialog(phaseId, project) {
  editingProjectId = project?.id || null;
  $('projectDialogTitle').textContent = project ? 'Editar ideia' : 'Nova ideia de projeto';
  fillPhaseSelect($('projectPhase'), project?.phaseId || phaseId);
  $('projectTitle').value = project?.title || '';
  $('projectDescription').value = project?.description || '';
  fillLevelSelect($('projectLevel'), project?.level || activeTrackState().level);
  $('projectHours').value = project?.hours || 6;
  $('projectDialog').showModal();
}

function saveTopic(event) {
  event.preventDefault();
  const trackState = activeTrackState();
  const title = $('topicTitle').value.trim();
  if (title.length < 2) {
    toast('Dê um título para o tópico.', 'error');
    return;
  }
  const resourceTitle = $('topicResourceTitle').value.trim();
  const resourceUrl = $('topicResourceUrl').value.trim();
  const resources = [...session.dialogResources];
  if (resourceTitle && safeUrl(resourceUrl)) {
    resources.push({
      title: resourceTitle,
      url: resourceUrl,
      lang: $('topicResourceLang').value === 'en' ? 'en' : 'pt',
      kind: $('topicResourceKind').value || 'leitura',
    });
  }
  const data = {
    id: editingTopicId || newId('topico'),
    phaseId: $('topicPhase').value,
    title,
    description: $('topicDescription').value.trim(),
    level: $('topicLevel').value,
    hours: clampHours($('topicHours').value) || 4,
    tags: $('topicTags').value.split(',').map((tag) => tag.trim()).filter(Boolean),
    prerequisites: [],
    resources,
    custom: true,
  };
  trackState.customTopics = trackState.customTopics.filter((topic) => topic.id !== data.id);
  trackState.customTopics.push(data);
  $('topicDialog').close();
  persist();
  refresh();
  toast('Tópico salvo nesta trilha.');
}

function saveProject(event) {
  event.preventDefault();
  const trackState = activeTrackState();
  const title = $('projectTitle').value.trim();
  if (title.length < 2) {
    toast('Dê um título para a ideia.', 'error');
    return;
  }
  const data = {
    id: editingProjectId || newId('projeto'),
    phaseId: $('projectPhase').value,
    title,
    description: $('projectDescription').value.trim(),
    level: $('projectLevel').value,
    hours: clampHours($('projectHours').value) || 4,
    custom: true,
  };
  trackState.customProjects = trackState.customProjects.filter((project) => project.id !== data.id);
  trackState.customProjects.push(data);
  $('projectDialog').close();
  persist();
  refresh();
  toast('Ideia de projeto salva nesta trilha.');
}

function exportJson() {
  const blob = new Blob([JSON.stringify(buildExport(state), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rumo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast('Backup JSON exportado.');
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const result = applyImport(state, parsed);
      if (state.activeTrackId && !trackById(state.activeTrackId)) {
        state.activeTrackId = tracks[0].id;
      }
      if (!activeTrackState()?.level) state.profile.onboarded = false;
      persist();
      refresh();
      toast(result.kind === 'legacy'
        ? 'Backup antigo do Full-Stack restaurado. Suas observações já salvas foram mantidas.'
        : 'Backup restaurado.');
    } catch (error) {
      toast('Arquivo JSON inválido. Verifique o formato.', 'error');
    }
  };
  reader.readAsText(file);
}

async function openShare() {
  const plan = sharePlanFromTrack(state, state.activeTrackId);
  const token = await encodePlan(plan);
  const url = `${location.origin}${location.pathname}${location.search}#plano=${encodeURIComponent(token)}`;
  if (url.length > 12000) {
    toast('Esse plano ficou grande para um link. Use o JSON.', 'error');
    return;
  }
  $('shareUrl').value = url;
  $('shareDialog').showModal();
  $('shareUrl').focus();
  $('shareUrl').select();
}

async function readIncomingPlan() {
  const token = planFromHash(location.hash);
  if (!token) return;
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  try {
    const plan = await decodePlan(token);
    if (!trackById(plan.t)) throw new Error('Trilha ausente');
    if (!isReady(state)) {
      applySharePlan(state, plan);
      persist();
      toast('Plano compartilhado aplicado. O progresso continua só neste navegador.');
    } else {
      pendingPlan = plan;
      const track = trackById(plan.t);
      $('sharedBody').textContent = `${track.name}, nível ${LEVEL_LABELS[plan.l] || plan.l}, ${plan.h} h por semana. Isso substitui opcionais, ordem e ideias criadas nesta trilha. Progresso, anotações e observações são mantidos.`;
      $('sharedDialog').showModal();
    }
  } catch (error) {
    toast('Não foi possível ler o plano deste link.', 'error');
  }
}

function onRoadmapClick(event) {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const trackState = activeTrackState();
  const sourceTrackId = el.dataset.sourceTrack;
  const targetTrackState = (sourceTrackId && state.tracks[sourceTrackId]) || trackState;
  const action = el.dataset.action;
  if (action === 'open-topic-detail') {
    session.detailTopicId = el.dataset.itemId;
    session.detailSourceTrackId = sourceTrackId || null;
    renderTopicDetail(session.detailTopicId, session.detailSourceTrackId);
    $('topicDetailDialog').showModal();
    return;
  }
  if (action === 'toggle-phase') {
    const id = el.dataset.phaseId;
    if (trackState.collapsedPhases[id]) delete trackState.collapsedPhases[id];
    else trackState.collapsedPhases[id] = true;
    persist();
    refresh();
    return;
  }
  if (action === 'toggle-note') {
    const id = el.dataset.itemId;
    if (session.openNotes[id]) delete session.openNotes[id];
    else session.openNotes[id] = true;
    renderRoadmap();
    if (session.openNotes[id]) document.getElementById(`note-${id}`)?.focus();
    return;
  }
  if (action === 'toggle-link-form') {
    const id = el.dataset.itemId;
    if (session.openLinkForms[id]) delete session.openLinkForms[id];
    else session.openLinkForms[id] = true;
    renderRoadmap();
    if (session.openLinkForms[id]) document.getElementById(`link-title-${id}`)?.focus();
    return;
  }
  if (action === 'add-topic-link') {
    const id = el.dataset.itemId;
    const title = (document.getElementById(`link-title-${id}`)?.value || '').trim();
    const url = (document.getElementById(`link-url-${id}`)?.value || '').trim();
    const lang = document.getElementById(`link-lang-${id}`)?.value === 'en' ? 'en' : 'pt';
    const kind = document.getElementById(`link-kind-${id}`)?.value || 'leitura';
    if (!title || !safeUrl(url)) {
      toast('Informe um título e uma URL válida (https://...).', 'error');
      return;
    }
    trackState.customLinks = trackState.customLinks || {};
    const list = trackState.customLinks[id] || [];
    if (list.length >= 6) {
      toast('Limite de 6 links próprios por tópico atingido.', 'error');
      return;
    }
    list.push({ title: title.slice(0, 180), url: url.slice(0, 500), lang, kind });
    trackState.customLinks[id] = list;
    delete session.openLinkForms[id];
    persist();
    refresh();
    toast('Link adicionado ao tópico.');
    return;
  }
  if (action === 'remove-topic-link') {
    const id = el.dataset.itemId;
    const url = el.dataset.url;
    if (trackState.customLinks && trackState.customLinks[id]) {
      trackState.customLinks[id] = trackState.customLinks[id].filter((item) => item.url !== url);
      if (!trackState.customLinks[id].length) delete trackState.customLinks[id];
      persist();
      refresh();
      toast('Link removido.');
    }
    return;
  }
  if (action === 'toggle-resource') {
    const id = el.dataset.itemId;
    const url = el.dataset.url;
    const key = `${id}::${url}`;
    trackState.doneResources = trackState.doneResources || {};
    if (trackState.doneResources[key]) delete trackState.doneResources[key];
    else trackState.doneResources[key] = true;
    persist();
    renderRoadmap();
    return;
  }
  if (action === 'toggle-item') {
    const located = findTopic(el.dataset.itemId, sourceTrackId);
    if (!located) return;
    const wasDone = located.topic.done;
    if (wasDone) delete targetTrackState.completed[located.topic.id];
    else targetTrackState.completed[located.topic.id] = true;
    const after = activeView();
    const phase = after.phases.find((item) => item.id === located.phase.id);
    if (!wasDone && phase?.progress.complete) toast(`Etapa concluída: ${phase.badgeTitle}.`);
    persist();
    refresh();
    return;
  }
  if (action === 'toggle-phase-done') {
    const view = activeView();
    const phase = view.phases.find((item) => item.id === el.dataset.phaseId);
    const pool = poolOf(phase);
    const allDone = pool.every((topic) => topic.done);
    pool.forEach((topic) => {
      const ts = (topic.sourceTrackId && state.tracks[topic.sourceTrackId]) || trackState;
      if (allDone) delete ts.completed[topic.id];
      else ts.completed[topic.id] = true;
    });
    if (!allDone) toast(`Etapa ${phase.number} concluída.`);
    persist();
    refresh();
    return;
  }
  if (action === 'toggle-optional' || action === 'hide-topic' || action === 'restore-topic') {
    const located = findTopic(el.dataset.itemId, sourceTrackId);
    if (!located) return;
    const ts = (located.topic.sourceTrackId && state.tracks[located.topic.sourceTrackId]) || trackState;
    if (action === 'hide-topic') setTopicStatus(ts, located.topic, 'hidden');
    else if (action === 'restore-topic') setTopicStatus(ts, located.topic, naturalStatus(located.topic, ts));
    else setTopicStatus(ts, located.topic, located.topic.status === 'optional' ? 'required' : 'optional');
    persist();
    refresh();
    if (action === 'hide-topic') toast('Tópico oculto. Você pode restaurá-lo no filtro Ocultos.');
    return;
  }
  if (action === 'move-topic') {
    const view = buildRoadmap(activeTrack(), trackState);
    const phase = view.phases.find((item) => item.id === el.dataset.phaseId);
    trackState.topicOrder[phase.id] = moveId(phase.topics.map((topic) => topic.id), el.dataset.itemId, Number(el.dataset.dir));
    persist();
    refresh();
    return;
  }
  if (action === 'move-phase') {
    const view = buildRoadmap(activeTrack(), trackState);
    trackState.phaseOrder = moveId(view.phases.map((phase) => phase.id), el.dataset.phaseId, Number(el.dataset.dir));
    persist();
    refresh();
    return;
  }
  if (action === 'edit-topic') {
    const custom = trackState.customTopics.find((topic) => topic.id === el.dataset.itemId);
    if (custom) openTopicDialog(custom);
    return;
  }
  if (action === 'delete-topic') {
    const id = el.dataset.itemId;
    askConfirm({
      title: 'Excluir este tópico?',
      body: 'A anotação e o progresso dele também saem. Isso vale só para tópicos que você criou.',
      confirmLabel: 'Excluir tópico',
    }).then((ok) => {
      if (!ok) return;
      trackState.customTopics = trackState.customTopics.filter((topic) => topic.id !== id);
      delete trackState.completed[id];
      delete trackState.notes[id];
      delete trackState.overrides[id];
      persist();
      refresh();
    }, () => {
      toast('Não foi possível confirmar a exclusão.', 'error');
    });
    return;
  }
  if (action === 'toggle-project') {
    const id = el.dataset.projectId;
    if (targetTrackState.completedProjects[id]) delete targetTrackState.completedProjects[id];
    else targetTrackState.completedProjects[id] = true;
    persist();
    refresh();
    return;
  }
  if (action === 'add-project') {
    openProjectDialog(el.dataset.phaseId);
    return;
  }
  if (action === 'edit-project') {
    const project = trackState.customProjects.find((item) => item.id === el.dataset.projectId);
    if (project) openProjectDialog(project.phaseId, project);
    return;
  }
  if (action === 'delete-project') {
    const id = el.dataset.projectId;
    askConfirm({
      title: 'Excluir esta ideia?',
      body: 'A marcação de concluída também sai. Ideias que já vêm na trilha não são apagadas.',
      confirmLabel: 'Excluir ideia',
    }).then((ok) => {
      if (!ok) return;
      trackState.customProjects = trackState.customProjects.filter((project) => project.id !== id);
      delete trackState.completedProjects[id];
      persist();
      refresh();
    }, () => {
      toast('Não foi possível confirmar a exclusão.', 'error');
    });
    return;
  }
  if (action === 'show-all-projects') {
    trackState.showAllProjectLevels = true;
    persist();
    refresh();
    return;
  }
  if (action === 'open-quiz') {
    openQuiz(el.dataset.quizScope, el.dataset.quizScope === 'phase' ? el.dataset.phaseId : el.dataset.itemId);
    return;
  }
  if (action === 'guide-check') {
    const projectId = el.dataset.projectId;
    const group = el.dataset.guideGroup === 'criteria' ? 'criteria' : 'steps';
    const index = String(Number(el.dataset.index));
    const current = trackState.guideChecks[projectId] || { steps: {}, criteria: {} };
    if (!current[group]) current[group] = {};
    if (el.checked) current[group][index] = true;
    else delete current[group][index];
    trackState.guideChecks[projectId] = current;
    persist();
  }
}

function onRoadmapInput(event) {
  const el = event.target;
  const trackState = activeTrackState();
  if (!trackState) return;
  if (el.dataset.action === 'edit-note') {
    const value = el.value.slice(0, 20000);
    if (value.trim()) trackState.notes[el.dataset.itemId] = value;
    else delete trackState.notes[el.dataset.itemId];
    persist();
  }
  if (el.dataset.action === 'edit-phase-note') {
    const value = el.value.slice(0, 20000);
    if (value.trim()) trackState.phaseNotes[el.dataset.phaseId] = value;
    else delete trackState.phaseNotes[el.dataset.phaseId];
    persist();
  }
}

function bind() {
  $('themeToggleBtn').addEventListener('click', toggleTheme);
  $('onbThemeBtn').addEventListener('click', toggleTheme);
  $('retakeBtn').addEventListener('click', () => openOnboarding('retake'));
  $('shareBtn').addEventListener('click', () => { openShare().catch(() => toast('Não foi possível gerar o link.', 'error')); });
  $('copyShareBtn').addEventListener('click', async () => {
    const value = $('shareUrl').value;
    try {
      await navigator.clipboard.writeText(value);
      toast('Link copiado.');
    } catch {
      $('shareUrl').select();
      toast('Selecione o link e copie manualmente.', 'error');
    }
  });
  $('applyShareBtn').addEventListener('click', () => {
    if (!pendingPlan) return;
    applySharePlan(state, pendingPlan);
    pendingPlan = null;
    $('sharedDialog').close();
    persist();
    refresh();
    toast('Plano aplicado. Progresso e observações foram mantidos.');
  });
  $('searchInput').addEventListener('input', (event) => {
    session.search = event.target.value;
    renderRoadmap();
    updateDashboard();
  });
  document.querySelectorAll('.filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      session.filter = button.dataset.filter;
      updateDashboard();
      renderRoadmap();
    });
  });
  $('resetFiltersBtn').addEventListener('click', () => {
    session.search = '';
    session.filter = 'all';
    session.resourceLang = 'all';
    session.resourceKind = 'all';
    $('searchInput').value = '';
    $('resourceLangFilter').value = 'all';
    $('resourceKindFilter').value = 'all';
    updateDashboard();
    renderRoadmap();
  });
  $('resourceLangFilter').addEventListener('change', (event) => {
    session.resourceLang = event.target.value;
    renderRoadmap();
  });
  $('resourceKindFilter').addEventListener('change', (event) => {
    session.resourceKind = event.target.value;
    renderRoadmap();
  });
  $('viewModeBtn').addEventListener('click', () => {
    session.viewMode = session.viewMode === 'map' ? 'list' : 'map';
    $('viewModeBtn').textContent = session.viewMode === 'map' ? 'Modo: Mapa visual' : 'Modo: Lista detalhada';
    renderRoadmap();
  });
  const clearPrereqHighlights = () => {
    document.querySelectorAll('#conteudo .is-prereq-highlight').forEach((el) => el.classList.remove('is-prereq-highlight'));
  };
  const highlightPrereqs = (target) => {
    clearPrereqHighlights();
    const node = target.closest('[data-node-id]');
    if (!node || !node.dataset.prereqs) return;
    node.dataset.prereqs.split(',').filter(Boolean).forEach((id) => {
      document.querySelector(`#conteudo [data-node-id="${CSS.escape(id)}"]`)?.classList.add('is-prereq-highlight');
    });
  };
  $('conteudo').addEventListener('mouseover', (event) => highlightPrereqs(event.target));
  $('conteudo').addEventListener('mouseout', clearPrereqHighlights);
  $('conteudo').addEventListener('focusin', (event) => highlightPrereqs(event.target));
  $('conteudo').addEventListener('focusout', clearPrereqHighlights);
  $('phaseFlowchart').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-flow-phase]');
    if (!btn) return;
    const id = btn.dataset.flowPhase;
    const trackState = activeTrackState();
    if (trackState.collapsedPhases[id]) {
      delete trackState.collapsedPhases[id];
      persist();
      refresh();
    }
    document.getElementById(`phase-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('topicDetailClose').addEventListener('click', () => {
    session.detailTopicId = null;
    $('topicDetailDialog').close();
  });
  $('topicDetailDialog').addEventListener('close', () => {
    session.detailTopicId = null;
  });
  $('topicDetailBody').addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    handleAction(el, event);
    if (session.detailTopicId && $('topicDetailDialog').open) renderTopicDetail(session.detailTopicId);
  });
  $('topicDetailBody').addEventListener('input', (event) => {
    const el = event.target;
    if (el.dataset.action === 'edit-note') {
      const id = el.dataset.itemId;
      const trackState = activeTrackState();
      if (el.value.trim()) trackState.notes[id] = el.value;
      else delete trackState.notes[id];
      persist();
    }
  });
  $('toggleAllPhasesBtn').addEventListener('click', () => {
    const trackState = activeTrackState();
    const view = buildRoadmap(activeTrack(), trackState);
    const allCollapsed = view.phases.every((phase) => trackState.collapsedPhases[phase.id]);
    trackState.collapsedPhases = {};
    if (!allCollapsed) view.phases.forEach((phase) => { trackState.collapsedPhases[phase.id] = true; });
    persist();
    refresh();
  });
  $('strikethroughToggle').addEventListener('change', (event) => {
    state.strikethrough = event.target.checked;
    persist();
    renderRoadmap();
  });
  $('allProjectLevels').addEventListener('change', (event) => {
    activeTrackState().showAllProjectLevels = event.target.checked;
    persist();
    refresh();
  });
  $('includeBelowLevel').addEventListener('change', (event) => {
    activeTrackState().includeBelowLevel = event.target.checked;
    persist();
    refresh();
  });
  $('weeklyHoursInput').addEventListener('change', (event) => {
    const hours = clampHours(event.target.value);
    if (!hours) {
      toast('Use entre 1 e 60 horas por semana.', 'error');
      event.target.value = activeTrackState().weeklyHours;
      return;
    }
    activeTrackState().weeklyHours = hours;
    persist();
    refresh();
  });
  $('addTopicBtn').addEventListener('click', () => openTopicDialog());
  $('topicCancel').addEventListener('click', () => $('topicDialog').close());
  $('projectCancel').addEventListener('click', () => $('projectDialog').close());
  $('topicForm').addEventListener('submit', saveTopic);
  $('topicAddResourceBtn').addEventListener('click', () => {
    const title = $('topicResourceTitle').value.trim();
    const url = $('topicResourceUrl').value.trim();
    if (!title || !safeUrl(url)) {
      toast('Informe título e URL válida (https://...) para adicionar.', 'error');
      return;
    }
    if (session.dialogResources.length >= 6) {
      toast('Máximo de 6 recursos por tópico.', 'error');
      return;
    }
    session.dialogResources.push({
      title,
      url,
      lang: $('topicResourceLang').value === 'en' ? 'en' : 'pt',
      kind: $('topicResourceKind').value || 'leitura',
    });
    $('topicResourceTitle').value = '';
    $('topicResourceUrl').value = '';
    renderDialogResources();
  });
  $('topicResourcesList').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-remove-dialog-res]');
    if (!btn) return;
    session.dialogResources.splice(Number(btn.dataset.removeDialogRes), 1);
    renderDialogResources();
  });
  $('projectForm').addEventListener('submit', saveProject);
  $('exportJsonBtn').addEventListener('click', exportJson);
  $('importJsonBtn').addEventListener('click', () => $('importFileInput').click());
  $('importFileInput').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) importJson(file);
  });
  $('resetProgressBtn').addEventListener('click', async () => {
    const ok = await askConfirm({
      title: 'Resetar o progresso desta trilha?',
      body: 'Isso desmarca tópicos e projetos e apaga anotações e observações desta trilha. Tópicos e ideias que você criou continuam na lista. As outras trilhas não mudam.',
      confirmLabel: 'Resetar esta trilha',
    });
    if (!ok) return;
    const trackState = activeTrackState();
    trackState.completed = {};
    trackState.notes = {};
    trackState.phaseNotes = {};
    trackState.completedProjects = {};
    session.openNotes = {};
    session.openPhaseNotes = {};
    persist();
    refresh();
    toast('Progresso desta trilha foi resetado.');
  });
  $('conteudo').addEventListener('click', onRoadmapClick);
  $('orphans').addEventListener('click', onRoadmapClick);
  $('conteudo').addEventListener('input', onRoadmapInput);
  $('conteudo').addEventListener('toggle', (event) => {
    const details = event.target;
    if (details instanceof HTMLDetailsElement && details.dataset.phaseId) {
      session.openPhaseNotes[details.dataset.phaseId] = details.open;
    }
  }, true);
  let autoAdvanceTimer = null;
  const scheduleAutoAdvance = (targetStep) => {
    if (!$('onbAutoAdvance')?.checked) return;
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = setTimeout(() => {
      if ($('onboarding') && !$('onboarding').hidden) goToStep(targetStep);
    }, 180);
  };
  document.addEventListener('change', (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (event.target.type === 'radio' || event.target.type === 'checkbox') paintChoices();
    if (event.target.name === 'track') {
      session.onboarding.trackId = event.target.value;
      syncCompanionLocks();
      if (session.onboarding.step === 1) scheduleAutoAdvance(2);
    }
    if (event.target.name === 'companion') session.onboarding.companionIds = selectedCompanionIds();
    if (event.target.name === 'level') {
      session.onboarding.level = event.target.value;
      if (session.onboarding.step === 3) scheduleAutoAdvance(4);
    }
    if (event.target.name === 'hours') {
      if (event.target.value === 'custom') {
        $('hoursCustom')?.focus();
      } else {
        session.onboarding.hours = clampHours(event.target.value);
        if (session.onboarding.step === 4 && session.onboarding.hours) scheduleAutoAdvance(5);
      }
    }
  });
  $('onbSearch').addEventListener('input', () => {
    session.onboarding.query = $('onbSearch').value;
    filterOnboarding(session.onboarding.query);
  });
  $('onbSearch').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    document.querySelector('#onbTrackGroups [data-track-card]:not([hidden]) input')?.focus();
  });
  $('trackSwitcher').addEventListener('click', (event) => {
    const button = event.target.closest('[data-switch-track]');
    if (!button) return;
    switchToTrack(button.dataset.switchTrack);
  });
  $('sidebarToggleBtn').addEventListener('click', () => setSidebarOpen(true));
  $('sidebarCloseBtn').addEventListener('click', () => setSidebarOpen(false));
  $('sidebarBackdrop').addEventListener('click', () => setSidebarOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && $('trackSidebar').classList.contains('is-open')) setSidebarOpen(false);
  });
  $('sidebarSearch').addEventListener('input', (event) => {
    session.sidebarQuery = event.target.value;
    renderTrackSidebar();
  });
  $('sidebarGroups').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-sidebar-group]');
    if (!chip) return;
    session.sidebarGroup = chip.dataset.sidebarGroup;
    renderTrackSidebar();
  });
  $('sidebarList').addEventListener('click', (event) => {
    const item = event.target.closest('[data-sidebar-track]');
    if (!item) return;
    setSidebarOpen(false);
    switchToTrack(item.dataset.sidebarTrack);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('renameNoticeDismiss').addEventListener('click', () => {
    if (!state.profile.dismissedNotices.includes('dados-ciencia')) {
      state.profile.dismissedNotices.push('dados-ciencia');
    }
    persist();
    renderRenameNotice();
  });
  $('hoursCustom').addEventListener('input', () => {
    const custom = document.querySelector('input[name="hours"][value="custom"]');
    if (custom) custom.checked = true;
    paintChoices();
  });
  $('hoursCustom').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const hours = selectedHours();
    if (!hours) return toast('Informe entre 1 e 60 horas por semana.', 'error');
    session.onboarding.hours = hours;
    goToStep(5);
  });
  $('welcomeStartBtn').addEventListener('click', () => goToStep(1));
  $('welcomeBackBtn').addEventListener('click', () => refresh());
  $('onbBack').addEventListener('click', () => {
    clearTimeout(autoAdvanceTimer);
    goToStep(Math.max(0, session.onboarding.step - 1));
  });
  $('infoDialogClose').addEventListener('click', () => $('infoDialog').close());
  $('siteFooter').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-footer-action]');
    if (!btn) return;
    const action = btn.dataset.footerAction;
    if (action === 'about') {
      openOnboarding(isReady(state) ? 'retake' : 'create', 0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const INFO_COPY = {
      privacy: {
        title: 'Política de Privacidade',
        body: '<p>O <strong>Rumos</strong> não possui cadastro, não usa cookies próprios nem ferramentas de analytics, e não envia seu progresso, anotações ou plano de estudos para servidores próprios.</p><p>Seus dados (progresso, anotações, autoavaliações e plano semanal) ficam salvos localmente no <code>localStorage</code> do seu navegador. Você pode exportar, restaurar ou limpar tudo quando quiser usando os botões de backup JSON. O link de compartilhamento grava apenas a configuração básica (trilha, nível, horas e ordem) no fragmento <code>#</code> da URL, sem dados pessoais.</p><p><strong>Serviços de infraestrutura e terceiros:</strong> como site estático hospedado no GitHub Pages, o provedor de hospedagem e as CDNs usadas para carregar fontes, estilos e ícones (Google Fonts, Tailwind CDN e jsDelivr/Devicon) recebem requisições HTTP padrão do navegador (como endereço IP e cabeçalho <code>User-Agent</code>) estritamente para entregar os arquivos. Ao acessar links externos de estudo ou o GitHub, aplicam-se as políticas de privacidade de cada site de destino.</p>',
      },
      terms: {
        title: 'Termos de Uso',
        body: '<p>O <strong>Rumos</strong> é uma ferramenta educacional gratuita e de código aberto (licença MIT). As trilhas, estimativas de carga horária e sugestões de projetos têm caráter exclusivamente orientativo para apoiar seus estudos.</p><p>O aplicativo apenas agrega e organiza links públicos para documentações, cursos e materiais externos de terceiros. O mantenedor do projeto não possui controle sobre esses sites externos e <strong>não se responsabiliza</strong> pelo conteúdo, disponibilidade, atualizações, segurança, práticas de privacidade ou quaisquer consequências decorrentes de acessos realizados fora da aplicação.</p><p><strong>Marcas e ícones de terceiros:</strong> os nomes, logotipos e ícones de linguagens, frameworks e ferramentas (exibidos por meio da biblioteca Devicon sob licença MIT) pertencem aos seus respectivos titulares e são utilizados estritamente para fins educacionais e de identificação, sem vínculo oficial ou endosso.</p><p>O acesso a links externos ocorre por conta e risco do usuário. Caso encontre algum link quebrado, desatualizado ou que precise ser removido, abra uma solicitação na página de issues do GitHub.</p>',
      },
      accessibility: {
        title: 'Declaração de Acessibilidade',
        body: '<p>O Rumos foi projetado seguindo as diretrizes <strong>WCAG 2.2 nível AA</strong>, com suporte completo a navegação por teclado, alto contraste nos temas claro e escuro, foco visível e respeito à preferência <code>prefers-reduced-motion</code>.</p><p>Caso encontre qualquer barreira de acessibilidade, abra uma issue no repositório do projeto no GitHub.</p>',
      },
    };
    const info = INFO_COPY[action];
    if (!info) return;
    $('infoDialogTitle').textContent = info.title;
    $('infoDialogBody').innerHTML = info.body;
    $('infoDialog').showModal();
  });
  $('onbNext').addEventListener('click', () => {
    const step = session.onboarding.step;
    if (step === 1) {
      session.onboarding.trackId = selectedRadio('track');
      if (!session.onboarding.trackId) return toast('Escolha uma carreira.', 'error');
    }
    if (step === 2) {
      session.onboarding.companionIds = selectedCompanionIds().filter((id) => id !== session.onboarding.trackId);
    }
    if (step === 3) {
      session.onboarding.level = selectedRadio('level');
      if (!session.onboarding.level) return toast('Escolha um nível.', 'error');
    }
    if (step === 4) {
      session.onboarding.hours = selectedHours();
      if (!session.onboarding.hours) return toast('Informe entre 1 e 60 horas por semana.', 'error');
    }
    goToStep(step + 1);
  });
  $('onbStart').addEventListener('click', confirmOnboarding);
  $('exportMdBtn').addEventListener('click', () => {
    const view = activeView();
    const label = isCombinedView() ? { ...activeTrack(), name: `Trajeto completo (${activeTrack().name})` } : activeTrack();
    downloadFile(`rumos-${activeTrack().id}.md`, roadmapMarkdown(label, view), 'text/markdown');
  });
  $('exportPdfBtn').addEventListener('click', () => {
    const view = activeView();
    const label = isCombinedView() ? { ...activeTrack(), name: `Trajeto completo (${activeTrack().name})` } : activeTrack();
    downloadFile(`rumos-${activeTrack().id}.pdf`, roadmapPdf(label, view), 'application/pdf');
  });
  $('exportPngBtn').addEventListener('click', async () => {
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    const label = isCombinedView() ? { ...activeTrack(), name: `Trajeto completo (${activeTrack().name})` } : activeTrack();
    drawRoadmap(canvas, label, activeView());
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rumos-${activeTrack().id}.png`;
    link.click();
    URL.revokeObjectURL(url);
  });
  initPlanScreen({
    track: activeTrack,
    trackState: activeTrackState,
    view: () => buildRoadmap(activeTrack(), activeTrackState()),
    companions: () => (state.profile.companionIds || [])
      .filter((id) => id !== activeTrack().id)
      .map((id) => trackById(id))
      .filter(Boolean)
      .map((t) => {
        const ts = ensureTrack(state, t.id);
        return { track: t, trackState: ts, view: buildRoadmap(t, ts) };
      }),
    isDone: (kind, refId, trackId) => {
      const ts = trackId ? ensureTrack(state, trackId) : activeTrackState();
      if (kind === 'project') return !!ts.completedProjects?.[refId];
      if (kind === 'topic') return !!ts.completed?.[refId];
      return false;
    },
    toggleDone: (kind, refId, trackId) => {
      const ts = trackId ? ensureTrack(state, trackId) : activeTrackState();
      if (kind === 'project') {
        if (ts.completedProjects[refId]) delete ts.completedProjects[refId];
        else ts.completedProjects[refId] = true;
      } else if (kind === 'topic') {
        if (ts.completed[refId]) delete ts.completed[refId];
        else ts.completed[refId] = true;
      }
      persist();
    },
    refreshApp: refresh,
    persist,
    toast,
    escapeHtml,
    showApp: () => { $('app').hidden = false; refresh(); },
    hideApp: () => { $('app').hidden = true; },
    download: downloadFile,
    downloadPdf: (sessions) => downloadFile(`rumo-plano-${activeTrack().id}.pdf`, textPdf(planMarkdown(activeTrack().name, sessions).split('\n')), 'application/pdf'),
  });
  initDashboardScreen({
    track: activeTrack,
    trackState: activeTrackState,
    view: () => buildRoadmap(activeTrack(), activeTrackState()),
    companions: () => (state.profile.companionIds || [])
      .filter((id) => id !== activeTrack().id)
      .map((id) => trackById(id))
      .filter(Boolean)
      .map((t) => {
        const ts = ensureTrack(state, t.id);
        return { track: t, trackState: ts, view: buildRoadmap(t, ts) };
      }),
    exportJson,
    escapeHtml,
    showApp: () => { $('app').hidden = false; refresh(); },
    hideApp: () => { $('app').hidden = true; },
  });
  $('quizDialog').addEventListener('close', () => {
    if (!$('app').hidden) refresh();
  });
  $('quizDialog').addEventListener('change', onQuizChange);
  $('quizDialog').addEventListener('click', (event) => {
    const button = event.target.closest('[data-review-topic]');
    if (!button) return;
    $('quizDialog').close();
    focusTopic(button.dataset.reviewTopic);
  });
}

function downloadFile(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function focusTopic(topicId) {
  const located = findTopic(topicId);
  if (!located) return;
  delete activeTrackState().collapsedPhases[located.phase.id];
  session.filter = 'all';
  session.search = '';
  $('searchInput').value = '';
  refresh();
  document.querySelector(`[data-item-id="${CSS.escape(topicId)}"]`)?.scrollIntoView({ block: 'center' });
}

function openQuiz(scope, id) {
  const trackState = activeTrackState();
  const view = buildRoadmap(activeTrack(), trackState);
  let questions = [];
  let title = 'Autoavaliação';
  if (scope === 'phase') {
    const phase = view.phases.find((item) => item.id === id);
    if (!phase) return;
    questions = phase.quiz || [];
    title = `Autoavaliação · Etapa ${phase.number}`;
  } else {
    const located = findTopic(id);
    if (!located) return;
    questions = located.topic.quiz || [];
    title = `Autoavaliação · ${located.topic.title}`;
  }
  $('quizTitle').textContent = title;
  $('quizBody').innerHTML = questions.map((question) => {
    const picked = trackState.quizAnswers[question.id];
    const pickedChoice = question.choices.find((choice) => choice.id === picked);
    const verdict = !pickedChoice ? '' : pickedChoice.correct ? 'Certa. ' : 'Errada. ';
    const choices = question.choices.map((choice) => {
      const selected = picked === choice.id;
      const tone = !selected ? '' : choice.correct ? 'border-terra dark:border-ochre' : 'border-terra';
      return `<label class="flex gap-2 rounded-sm border border-line dark:border-sage/60 px-3 py-2 ${tone}">
        <input type="radio" name="quiz-${question.id}" data-question="${question.id}" value="${choice.id}" ${selected ? 'checked' : ''} />
        <span><span class="read">${escapeHtml(choice.text)}</span>${selected ? `<span class="read mt-2 block text-muted">${verdict}${escapeHtml(choice.explanation)}</span>` : ''}</span>
      </label>`;
    }).join('');
    const review = pickedChoice && !pickedChoice.correct
      ? `<button type="button" class="mt-2 text-xs underline" data-review-topic="${question.reviewTopicId}">Rever este tópico</button>`
      : '';
    if (pickedChoice) {
      const live = $('quizLive');
      if (live) live.textContent = `${verdict}${pickedChoice.explanation}`;
    }
    return `<fieldset class="mt-4"><legend class="font-semibold">${escapeHtml(question.prompt)}</legend><div class="mt-3 space-y-3">${choices}</div>${review}</fieldset>`;
  }).join('');
  if (!$('quizDialog').open) $('quizDialog').showModal();
}

function onQuizChange(event) {
  const input = event.target;
  if (!input.dataset.question) return;
  activeTrackState().quizAnswers[input.dataset.question] = input.value;
  persist();
  const questionId = input.dataset.question;
  const view = buildRoadmap(activeTrack(), activeTrackState());
  let questions = [];
  let quizScope = 'topic';
  let ownerId = '';
  for (const phase of view.phases) {
    if ((phase.quiz || []).some((question) => question.id === questionId)) {
      questions = phase.quiz;
      quizScope = 'phase';
      ownerId = phase.id;
    }
    for (const topic of phase.topics) {
      if ((topic.quiz || []).some((question) => question.id === questionId)) {
        questions = topic.quiz;
        quizScope = 'topic';
        ownerId = topic.id;
      }
    }
  }
  openQuiz(quizScope, ownerId);
  if (quizScore(questions, activeTrackState().quizAnswers).needsReview) {
    toast('Vale revisar antes de seguir. Isso não é uma nota.');
  }
}

async function loadTracks() {
  const base = new URL('../data/tracks/', import.meta.url);
  const manifest = await fetch(new URL('index.json', base)).then((response) => {
    if (!response.ok) throw new Error('Manifesto das trilhas indisponível.');
    return response.json();
  });
  const loaded = [];
  for (const entry of manifest.tracks) {
    const response = await fetch(new URL(entry.file, base));
    if (!response.ok) throw new Error(`Não encontrei ${entry.file}.`);
    const data = await response.json();
    const errors = validateTrack(data);
    if (errors.length) throw new Error(`${entry.file}: ${errors[0]}`);
    loaded.push({
      ...data,
      group: entry.group,
      keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
    });
  }
  tracks = loaded;
}

async function boot() {
  bind();
  loadState();
  applyTheme();
  try {
    await loadTracks();
  } catch (error) {
    $('loadErrorText').textContent = `${error.message} Use um servidor local, por exemplo python3 -m http.server, ou abra a página publicada. O arquivo solto no navegador bloqueia a leitura dos dados.`;
    showScreen('loadError');
    return;
  }
  await readIncomingPlan();
  if (!isReady(state) || !activeTrack()) openOnboarding('create');
  else refresh();
}

await boot();
