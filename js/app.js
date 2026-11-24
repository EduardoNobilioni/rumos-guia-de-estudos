import {
  CIENCIA_DE_DADOS_ID, applySharePlan, buildCombinedRoadmap, currentPhase, ensureTrack, isReady, sharePlanFromTrack,
} from './model.js';
import { decodePlan, encodePlan, planFromHash } from './share.js';
import { drawRoadmap, roadmapMarkdown, roadmapPdf } from './files.js';
import { syncPlanWeeklyHours } from './plan.js';
import { catalog, cachedTrack, cachedTracks, loadAllTracks, loadIndex, loadTracks } from './load-tracks.js';
import { getState, loadState, persist, persistAll, session } from './store.js';
import { $, brandMark, escapeHtml, icon, openMenu, ring, runViewTransition, toast } from './ui/dom.js';
import { initOnboarding } from './ui/onboarding.js';
import { initSidebar } from './ui/sidebar.js';
import { initCmdk } from './ui/cmdk.js';
import { initDialogs } from './ui/dialogs.js';
import { initQuiz } from './ui/quiz.js';
import { initRoadmap } from './ui/roadmap.js';
import { initPlanScreen } from './screens/plan-screen.js';
import { initDashboardScreen } from './screens/dashboard-screen.js';
import { initProjectsScreen } from './screens/projects-screen.js';

const api = { $, session, toast, ring, escapeHtml, getState, persist, persistAll };

function activeEntries() {
  const state = getState();
  const ids = session.combinedView
    ? [state.profile.primaryTrackId, ...(state.profile.companionIds || [])]
    : [state.activeTrackId];
  const seen = new Set();
  const entries = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const track = cachedTrack(id);
    const trackState = state.tracks[id];
    if (track && trackState) entries.push({ track, trackState });
  }
  return entries;
}

function activeTrack() {
  return cachedTrack(getState().activeTrackId);
}
function activeTrackState() {
  const state = getState();
  return state.tracks[state.activeTrackId] || null;
}
function activeView() {
  return buildCombinedRoadmap(activeEntries());
}

function findTopic(topicId, sourceTrackId = null) {
  const view = activeView();
  for (const phase of view.phases) {
    const topic = phase.topics.find((item) => item.id === topicId && (!sourceTrackId || item.sourceTrackId === sourceTrackId));
    if (topic) return { phase, topic };
  }
  return null;
}

function applyTheme() {
  const light = getState().theme === 'light';
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = light ? '#FAFAF9' : '#0B0B0C';
  $('themeToggleBtn').setAttribute('aria-label', light ? 'Usar tema escuro' : 'Usar tema claro');
  $('themeIcon').innerHTML = icon(light ? 'moon' : 'sun');
  if ($('onbThemeBtn')) $('onbThemeBtn').innerHTML = icon(light ? 'moon' : 'sun');
}

function toggleTheme() {
  getState().theme = getState().theme === 'light' ? 'dark' : 'light';
  persist();
  applyTheme();
}

function showScreen(name) {
  const ids = { loading: 'loading', loadError: 'loadError', onboarding: 'onboarding', roadmap: 'app', plan: 'planScreen', projects: 'projectsScreen', dashboard: 'dashboardScreen' };
  runViewTransition(() => {
    for (const id of Object.values(ids)) $(id).hidden = ids[name] !== id;
    const inApp = ['roadmap', 'plan', 'projects', 'dashboard'].includes(name);
    $('topnav').hidden = !inApp;
    $('tabbar').hidden = !inApp;
    document.querySelectorAll('[data-nav]').forEach((button) => {
      if (button.dataset.nav === name) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  });
  if (name === 'plan') planUi.render();
  if (name === 'dashboard') dashUi.render();
  if (name === 'projects') projectsUi.open();
  if (name === 'roadmap' && activeTrack()) roadmap.render();
}

function renderNotice() {
  const state = getState();
  const show = state.activeTrackId === CIENCIA_DE_DADOS_ID && !(state.profile.dismissedNotices || []).includes('dados-ciencia');
  $('renameNotice').hidden = !show;
  if (show) $('renameNoticeText').textContent = 'Essa trilha se chamava Dados. O nome agora é Ciência de Dados, e o que você já marcou continua aqui. Analista, Engenharia de Dados e Machine Learning são outras trilhas.';
}

async function ensureTracks(ids) {
  const loaded = await loadTracks(ids);
  loaded.forEach((track) => { if (track) ensureTrack(getState(), track.id); });
  return loaded.filter(Boolean);
}

async function switchToTrack(id) {
  if (id === '__combined__') {
    session.combinedView = true;
    showScreen('roadmap');
    return;
  }
  $('conteudo').innerHTML = '<div class="skeleton" style="height:88px"></div><div class="skeleton" style="height:88px"></div>';
  await ensureTracks([id, ...(getState().profile.companionIds || [])]);
  const state = getState();
  const current = activeTrackState();
  const next = ensureTrack(state, id);
  if (!next.level) next.level = current?.level || 'iniciante';
  if (!next.weeklyHours) next.weeklyHours = current?.weeklyHours || 8;
  state.activeTrackId = id;
  session.combinedView = false;
  persist(id);
  showScreen('roadmap');
  renderNotice();
  sidebar.render();
}

function download(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function focusTopic(topicId, sourceTrackId) {
  const located = findTopic(topicId, sourceTrackId);
  if (!located) return;
  const trackState = getState().tracks[located.topic.sourceTrackId] || activeTrackState();
  delete trackState.collapsedPhases[located.phase.id];
  session.filter = 'all';
  session.search = '';
  $('searchInput').value = '';
  showScreen('roadmap');
  document.querySelector(`[data-item-id="${CSS.escape(topicId)}"]`)?.scrollIntoView({ block: 'center' });
}

Object.assign(api, {
  activeTrack, activeTrackState, activeView, activeEntries, findTopic, toggleTheme, showScreen,
  ensureTracks, ensureAllTracks: loadAllTracks, switchToTrack, download, focusTopic,
  syncPlan: syncPlanWeeklyHours,
  tracks: () => cachedTracks(),
  state: getState,
  track: activeTrack,
  trackState: activeTrackState,
  view: activeView,
  companions: () => (getState().profile.companionIds || []).filter((id) => id !== getState().activeTrackId).map((id) => cachedTrack(id)).filter(Boolean).map((track) => ({ track, trackState: ensureTrack(getState(), track.id), view: buildCombinedRoadmap([{ track, trackState: ensureTrack(getState(), track.id) }]) })),
  refresh(part) {
    if (!isReady(getState()) || !cachedTrack(getState().activeTrackId)) return onboarding.open(getState().profile.onboarded ? 'retake' : 'create');
    if (part === 'roadmap') { roadmap.render(); return; }
    showScreen('roadmap');
    renderNotice();
    sidebar.render();
  },
  nextTopic() {
    const phase = currentPhase(activeView().phases || []);
    return phase?.topics.find((topic) => topic.status === 'required' && !topic.done) || null;
  },
  topicHits(needle) {
    return activeView().phases.flatMap((phase) => phase.topics).filter((topic) => `${topic.title} ${topic.description}`.toLowerCase().includes(needle));
  },
  applyShare(plan) { applySharePlan(getState(), plan); },
});

const onboarding = initOnboarding(api);
const sidebar = initSidebar(api);
const cmdk = initCmdk(api);
const dialogs = initDialogs(api);
const quiz = initQuiz(api);
const roadmap = initRoadmap(api);
const planUi = initPlanScreen(api);
const dashUi = initDashboardScreen(api);
const projectsUi = initProjectsScreen(api);

api.openTopicDialog = dialogs.openTopicDialog;
api.openProjectDialog = dialogs.openProjectDialog;
api.openQuiz = quiz.openQuiz;
api.openSheet = sidebar.openSheet;
api.renderNotice = renderNotice;
api.openShare = async () => {
  const plan = sharePlanFromTrack(getState(), getState().activeTrackId);
  if (!plan) return toast('Monta a trilha antes de compartilhar.', 'error');
  const token = await encodePlan(plan);
  const url = `${location.origin}${location.pathname}${location.search}#plano=${encodeURIComponent(token)}`;
  $('shareUrl').value = url;
  $('shareDialog').showModal();
};
api.confirmRemove = async (kind, id) => {
  const ok = await dialogs.askConfirm({
    title: kind === 'topic' ? 'Tirar este tópico?' : 'Tirar esta ideia?',
    body: 'Sai desta trilha. O resto fica.',
    confirmLabel: 'Tirar',
  });
  if (!ok) return;
  const trackState = activeTrackState();
  if (kind === 'topic') {
    trackState.customTopics = trackState.customTopics.filter((topic) => topic.id !== id);
    delete trackState.completed[id];
    delete trackState.notes[id];
  } else {
    trackState.customProjects = trackState.customProjects.filter((project) => project.id !== id);
    delete trackState.completedProjects[id];
  }
  persist(getState().activeTrackId);
  roadmap.render();
};

function bindChrome() {
  $('brandHome').innerHTML = `${brandMark(false)}<span>Rumo</span>`;
  $('moreBtn').innerHTML = icon('more');
  $('shareBtn').innerHTML = `${icon('share')} Compartilhar`;
  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => showScreen(button.dataset.nav));
  });
  $('themeToggleBtn').addEventListener('click', toggleTheme);
  $('shareBtn').addEventListener('click', () => api.openShare().catch(() => toast('Não gerei o link.', 'error')));
  $('moreBtn').addEventListener('click', () => openMenu($('moreBtn'), [
    { label: 'Exportar JSON', run: () => dialogs.exportJson() },
    { label: 'Markdown', run: () => download(`rumo-${activeTrack().id}.md`, roadmapMarkdown(activeTrack(), activeView()), 'text/markdown') },
    { label: 'PNG', run: async () => { const canvas = document.createElement('canvas'); drawRoadmap(canvas, activeTrack(), activeView()); const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')); download(`rumo-${activeTrack().id}.png`, blob, 'image/png'); } },
    { label: 'PDF', run: () => download(`rumo-${activeTrack().id}.pdf`, roadmapPdf(activeTrack(), activeView()), 'application/pdf') },
    { label: 'Importar JSON', run: () => $('importFileInput').click() },
    { label: 'Trocar de trilha', run: () => onboarding.open('retake') },
    { label: 'Resetar esta trilha', danger: true, run: async () => {
      const ok = await dialogs.askConfirm({ title: 'Resetar esta trilha?', body: 'Desmarca tópico e projeto e apaga anotação desta trilha. As outras ficam.', confirmLabel: 'Resetar' });
      if (!ok) return;
      const trackState = activeTrackState();
      trackState.completed = {}; trackState.notes = {}; trackState.phaseNotes = {}; trackState.completedProjects = {};
      persist(getState().activeTrackId);
      roadmap.render();
    } },
  ]));
  $('retryBtn').addEventListener('click', () => boot());
  onboarding.bind();
  sidebar.bind();
  cmdk.bind();
  dialogs.bind();
  quiz.bind();
  roadmap.bind();
}

async function readIncoming() {
  const token = planFromHash(location.hash);
  if (!token) return;
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  try {
    const plan = await decodePlan(token);
    if (!catalog().some((track) => track.id === plan.t)) throw new Error('ausente');
    await ensureTracks([plan.t]);
    if (!isReady(getState())) {
      applySharePlan(getState(), plan);
      persistAll();
      toast('Plano do link aplicado. O progresso continua só aqui.');
    } else {
      dialogs.setPending(plan);
      $('sharedBody').textContent = `${catalog().find((track) => track.id === plan.t)?.name}, ${plan.h} h por semana. Progresso e anotações ficam.`;
      $('sharedDialog').showModal();
    }
  } catch { toast('Não li o plano desse link.', 'error'); }
}

async function boot() {
  loadState();
  applyTheme();
  showScreen('loading');
  try { await loadIndex(); }
  catch (error) {
    $('loadErrorText').textContent = `${error.message} Abre com um servidor local, por exemplo python3 -m http.server.`;
    showScreen('loadError');
    return;
  }
  await readIncoming();
  const state = getState();
  const known = catalog().some((track) => track.id === state.activeTrackId);
  if (!isReady(state) || !known) onboarding.open(state.profile.onboarded && known ? 'retake' : 'create');
  else {
    $('conteudo').innerHTML = '<div class="skeleton" style="height:120px"></div>';
    showScreen('roadmap');
    try {
      await ensureTracks([state.activeTrackId, ...(state.profile.companionIds || [])]);
      roadmap.render();
      sidebar.render();
      renderNotice();
    } catch (error) {
      console.error('rumo-render', error);
      $('loadErrorText').textContent = error.message;
      showScreen('loadError');
    }
  }
}

bindChrome();
boot();