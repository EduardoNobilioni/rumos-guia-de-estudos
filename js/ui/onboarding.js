import {
  applyStudySelection, backendEcosystemChoices, backendLanguageChoices, blocksFullStackCompanion, careerIncludesFrontend,
  careerSplitOptions,
  clampHours, emptyTrackState, ensureTrack, formatDuration, FRONTEND_FRAMEWORK_IDS, frontendFrameworkChoices,
  fullstackOnboardingSteps, FULLSTACK_TRACK_ID, groupTracks, projectPlanStats, roadmapStats, tracksMatching,
} from '../model.js';
import { syncPlanWeeklyHours } from '../plan.js';
import { trackIconHtml } from '../icons.js';
import { catalog } from '../load-tracks.js';
import { brandMark, escapeHtml, icon, watchReveals } from './dom.js';

const LEVELS = [
  ['iniciante', 'Iniciante', 'Estou começando ou vi pouco disso.'],
  ['intermediario', 'Intermediário', 'Já programo e entendo o básico da área.'],
  ['avancado', 'Avançado', 'Já fiz projetos e quero o que ainda não domino.'],
];
const HOURS = [4, 8, 12, 20];

const STEP_DOM = {
  career: 'onbStep1',
  language: 'onbStepLanguage',
  ecosystem: 'onbStepEcosystem',
  framework: 'onbStepUiFramework',
  path: 'onbStepPath',
  companions: 'onbStep2',
  level: 'onbStep3',
  hours: 'onbStep4',
  preview: 'onbStep5',
};

const STEP_COPY = {
  career: ['Qual carreira é o seu objetivo?', 'Escolha sua trilha principal de carreira. Ao selecionar, você avança automaticamente para o próximo passo.'],
  language: ['Qual linguagem no back-end?', 'Escolha uma. Nenhuma vem marcada. HTTP, REST, banco, autenticação, testes e deploy continuam.'],
  ecosystem: ['Qual framework de back-end?', 'Escolha um. Ele entra só no lugar do framework de servidor. O restante da trilha permanece.'],
  framework: ['Qual framework de front-end?', 'Escolha um. Nenhuma vem marcada. HTML, CSS e JavaScript continuam.'],
  path: ['Qual caminho nesta parte?', 'Escolha um. Nada vem marcado. O resto da trilha continua na mesma ordem.'],
  companions: ['Quer adicionar fundamentos ou linguagens?', 'Opcional. Marque as trilhas adicionais e clique em Continuar.'],
  level: ['Qual é o seu nível hoje?', 'Tópicos abaixo desse nível entram como opcionais. Eles continuam visíveis.'],
  hours: ['Quantas horas por semana você consegue estudar?', 'A estimativa de cada etapa usa esse ritmo. Dá para ajustar depois.'],
  preview: ['Seu plano', 'Confira a carreira, a linguagem e as etapas antes de gerar seu roadmap completo.'],
};

export function initOnboarding(api) {
  const { $, session, toast } = api;
  const draft = session.onboarding;

  function choice(name, value, title, text, selected, type = 'radio', iconHtml = '') {
    return `<label class="choice-card${selected ? ' is-selected' : ''}" data-value="${escapeHtml(value)}">
      <input type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${selected ? 'checked' : ''} />
      <span class="row" style="align-items:flex-start">${iconHtml}<span><strong>${escapeHtml(title)}</strong><span class="muted" style="display:block;margin-top:4px">${escapeHtml(text)}</span></span></span>
    </label>`;
  }

  function steps() {
    return ['home', ...fullstackOnboardingSteps(draft.trackId, draft.backendLanguageId, catalog())];
  }

  function renderLanguages() {
    const options = backendLanguageChoices(catalog());
    $('onbLanguageList').innerHTML = options.map((track) => choice(
      'backendLanguage',
      track.id,
      track.name,
      track.tagline || '',
      draft.backendLanguageId === track.id,
      'radio',
      trackIconHtml(track.id, 'sm', track.name),
    )).join('') || '<p class="muted">Nenhuma linguagem de back-end com trilha.</p>';
  }

  function renderPath() {
    const options = careerSplitOptions(draft.trackId, catalog());
    $('onbPathList').innerHTML = options.map((track) => choice(
      'careerPath',
      track.id,
      track.name,
      track.tagline || '',
      draft.careerChoiceId === track.id,
      'radio',
      trackIconHtml(track.id, 'sm', track.name),
    )).join('');
  }

  function renderUiFramework() {
    const options = frontendFrameworkChoices(catalog());
    $('onbUiFrameworkList').innerHTML = options.map((track) => choice(
      'uiFramework',
      track.id,
      track.name,
      track.tagline || '',
      draft.frontendFrameworkId === track.id,
      'radio',
      trackIconHtml(track.id, 'sm', track.name),
    )).join('') || '<p class="muted">Nenhum framework de front-end com trilha.</p>';
  }

  function renderEcosystem() {
    const options = backendEcosystemChoices(catalog(), draft.backendLanguageId);
    $('onbEcosystemList').innerHTML = options.map((track) => choice(
      'backendEcosystem',
      track.id,
      track.name,
      track.tagline || '',
      draft.backendEcosystemIds[0] === track.id,
      'radio',
      trackIconHtml(track.id, 'sm', track.name),
    )).join('');
  }

  function renderChoices() {
    const groups = groupTracks(catalog());
    $('onbTrackGroups').innerHTML = groups.filter((group) => group.id === 'carreira').map((group) => (
      `<div data-track-group="${group.id}">${group.tracks.map((track) => choice('track', track.id, track.name, track.tagline || '', draft.trackId === track.id, 'radio', trackIconHtml(track.id, 'md', track.name)).replace('data-value=', `data-search="${escapeHtml(`${track.name} ${track.tagline || ''} ${(track.keywords || []).join(' ')}`)}" data-value=`)).join('')}</div>`
    )).join('');
    $('onbCompanionList').innerHTML = groups.filter((group) => group.id !== 'carreira').map((group) => (
      `<fieldset class="stack"><legend class="eyebrow">${escapeHtml(group.title)}</legend><p class="muted">${escapeHtml(group.lead)}</p>
        ${group.tracks.filter((track) => (draft.trackId !== FULLSTACK_TRACK_ID || !blocksFullStackCompanion(track.id)) && (!careerIncludesFrontend(draft.trackId) || !FRONTEND_FRAMEWORK_IDS.includes(track.id))).map((track) => choice('companion', track.id, track.name, track.tagline || '', draft.companionIds.includes(track.id), 'checkbox', trackIconHtml(track.id, 'sm', track.name))).join('')}
      </fieldset>`
    )).join('');
    $('onbStep3').innerHTML = `<legend class="sr-only">Nível</legend>${LEVELS.map(([id, title, text]) => choice('level', id, title, text, draft.level === id)).join('')}`;
    $('hourChoices').innerHTML = HOURS.map((hours) => choice('hours', String(hours), `${hours} h`, 'por semana', draft.hours === hours)).join('')
      + choice('hours', 'custom', 'Outro', 'eu digo quantas', draft.hours && !HOURS.includes(draft.hours));
    renderLanguages();
    renderEcosystem();
    renderUiFramework();
    renderPath();
  }

  function filter(query) {
    const visible = new Set(tracksMatching(catalog(), query).map((track) => track.id));
    let count = 0;
    document.querySelectorAll('#onbTrackGroups .choice-card').forEach((card) => {
      const show = !query.trim() || visible.has(card.dataset.value);
      card.hidden = !show;
      if (show) count += 1;
    });
    $('onbSearchStatus').textContent = query.trim() ? (count ? `${count} carreiras` : 'Nenhuma carreira com esse nome.') : '';
  }

  function paint() {
    document.querySelectorAll('#onboarding .choice-card').forEach((card) => {
      card.classList.toggle('is-selected', card.querySelector('input')?.checked);
    });
  }

  function selected(name) {
    return document.querySelector(`#onboarding input[name="${name}"]:checked`)?.value || null;
  }

  function companions() {
    return [...document.querySelectorAll('#onboarding input[name="companion"]:checked')].map((input) => input.value);
  }

  function ecosystems() {
    return [...document.querySelectorAll('#onboarding input[name="backendEcosystem"]:checked')].map((input) => input.value);
  }

  function goToStep(step) {
    const flow = steps();
    const index = Math.max(0, Math.min(step, flow.length - 1));
    draft.step = index;
    const id = flow[index];
    $('onbStep0').hidden = id !== 'home';
    $('onbFlow').hidden = id === 'home';
    if (id === 'home') {
      $('onbNavRow').hidden = true;
      const state = api.getState();
      const current = state.tracks[state.activeTrackId];
      const ready = !!(state.profile.onboarded && current && current.level);
      $('welcomeBackBtn').hidden = !ready;
      $('welcomeContinueMeta').hidden = !ready;
      $('welcomeStartBtn').className = ready ? 'btn btn-secondary' : 'btn btn-primary';
      $('welcomeBackBtn').className = 'btn btn-primary';
      if (ready) {
        const name = catalog().find((item) => item.id === state.activeTrackId)?.name || 'Trilha';
        let progress = '';
        try {
          const stats = roadmapStats(api.activeView().phases);
          if (stats.required) progress = ` · ${stats.requiredDone} de ${stats.required} tópicos`;
        } catch { /* trilha ainda não carregada */ }
        $('welcomeBackBtn').textContent = 'Continuar trilha';
        $('welcomeContinueMeta').textContent = `${name}${progress}`;
      }
      watchReveals($('onbStep0'));
      return;
    }
    for (const domId of new Set(Object.values(STEP_DOM))) $(domId).hidden = true;
    if (id === 'language') renderLanguages();
    if (id === 'ecosystem') renderEcosystem();
    if (id === 'framework') renderUiFramework();
    if (id === 'path') renderPath();
    if (id === 'companions') renderChoices();
    $(STEP_DOM[id]).hidden = false;
    const [heading, lead] = STEP_COPY[id];
    $('onbHeading').textContent = heading;
    $('onbLead').textContent = draft.mode === 'retake' && id === 'preview'
      ? 'Progresso, anotações e ideias criadas por você continuam. Opcionais e ocultos desta trilha voltam para a recomendação do novo nível.'
      : lead;
    $('onbStepLabel').textContent = `Passo ${index} de ${flow.length - 1}`;
    $('onbSegments').innerHTML = flow.slice(1).map((_, bar) => `<i${bar < index ? ' class="is-done"' : ''}></i>`).join('');
    $('onbBack').hidden = false;
    $('onbNext').hidden = id === 'preview';
    $('onbStart').hidden = id !== 'preview';
    $('onbStart').textContent = draft.mode === 'retake' ? 'Atualizar trilha' : 'Gerar roadmap completo';
    $('autoWrap').hidden = id === 'companions' || id === 'ecosystem' || id === 'preview';
    $('onbNavRow').hidden = false;
    if (id === 'preview') renderPlan();
  }

  function renderPlan() {
    const entry = catalog().find((item) => item.id === draft.trackId);
    if (!entry || !draft.level || !draft.hours || (draft.trackId === FULLSTACK_TRACK_ID && !draft.backendLanguageId) || (careerIncludesFrontend(draft.trackId) && !draft.frontendFrameworkId)) {
      $('planPreview').textContent = 'Faltou uma resposta. Volte um passo.';
      return;
    }
    const names = draft.companionIds.map((id) => catalog().find((item) => item.id === id)?.name).filter(Boolean);
    const language = backendLanguageChoices(catalog()).find((item) => item.id === draft.backendLanguageId);
    const eco = draft.backendEcosystemIds.map((id) => catalog().find((item) => item.id === id)?.name).filter(Boolean);
    const ui = frontendFrameworkChoices(catalog()).find((item) => item.id === draft.frontendFrameworkId);
    const backendLine = draft.trackId === FULLSTACK_TRACK_ID && language
      ? ` Back-end em ${language.name}${eco.length ? `, com ${eco.join(', ')}` : ''}.`
      : '';
    const uiLine = ui ? ` Front-end com ${ui.name}.` : '';
    $('planPreview').innerHTML = `<p style="font:var(--text-title-s)">${escapeHtml(entry.name)} · ${escapeHtml(LEVELS.find((item) => item[0] === draft.level)?.[1] || draft.level)} · ${draft.hours} h por semana</p>
      <p class="muted" style="margin-top:8px">${names.length ? `Junto: ${escapeHtml(names.join(', '))}.` : 'Só a carreira, por enquanto.'}${escapeHtml(backendLine)}${escapeHtml(uiLine)} ${escapeHtml(formatDuration(draft.hours * 8, draft.hours))} dá uma noção do mês, o prazo real sai das etapas.</p>`;
  }

  async function confirm() {
    if (draft.trackId === FULLSTACK_TRACK_ID && !draft.backendLanguageId) {
      toast('Escolha a linguagem do back-end.', 'error');
      const at = steps().indexOf('language');
      if (at >= 0) goToStep(at);
      return;
    }
    if (careerIncludesFrontend(draft.trackId) && !draft.frontendFrameworkId) {
      toast('Escolha o framework de front-end.', 'error');
      const at = steps().indexOf('framework');
      if (at >= 0) goToStep(at);
      return;
    }
    if (careerSplitOptions(draft.trackId, catalog()).length && !draft.careerChoiceId) {
      toast('Escolha um caminho.', 'error');
      const at = steps().indexOf('path');
      if (at >= 0) goToStep(at);
      return;
    }
    const ids = companions().filter((id) => id !== draft.trackId
      && (draft.trackId !== FULLSTACK_TRACK_ID || !blocksFullStackCompanion(id))
      && (!careerIncludesFrontend(draft.trackId) || !FRONTEND_FRAMEWORK_IDS.includes(id)));
    draft.companionIds = ids;
    const languageIds = draft.trackId === FULLSTACK_TRACK_ID
      ? [draft.backendLanguageId, ...draft.backendEcosystemIds]
      : [];
    const frameworkIds = careerIncludesFrontend(draft.trackId) && draft.frontendFrameworkId ? [draft.frontendFrameworkId] : [];
    const pathIds = draft.careerChoiceId ? [draft.careerChoiceId] : [];
    await api.ensureTracks([draft.trackId, ...ids, ...languageIds, ...frameworkIds, ...pathIds]);
    applyStudySelection(api.getState(), {
      trackId: draft.trackId,
      level: draft.level,
      hours: draft.hours,
      companionIds: ids,
      backendLanguageId: draft.trackId === FULLSTACK_TRACK_ID ? draft.backendLanguageId : null,
      backendEcosystemIds: draft.trackId === FULLSTACK_TRACK_ID ? draft.backendEcosystemIds : [],
      frontendFrameworkId: careerIncludesFrontend(draft.trackId) ? draft.frontendFrameworkId : null,
      careerChoiceId: draft.careerChoiceId,
    });
    const primary = api.getState().tracks[draft.trackId];
    if (primary.studyPlan) syncPlanWeeklyHours(primary.studyPlan, draft.hours);
    session.combinedView = ids.length > 0;
    api.persistAll();
    toast(draft.mode === 'retake' ? 'Trilha atualizada. Seu progresso continua.' : 'Roadmap gerado.');
    api.refresh();
  }

  function bind() {
    $('onbBrand').innerHTML = `${brandMark(false)}<span>Rumos</span>`;
    $('onbThemeBtn').innerHTML = icon('sun');
    $('onbThemeBtn').addEventListener('click', () => api.toggleTheme());
    renderChoices();
    document.addEventListener('change', (event) => {
      if (!$('onboarding') || $('onboarding').hidden) return;
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      paint();
      if (input.name === 'track') {
        draft.trackId = input.value;
        document.querySelectorAll('#onboarding input[name="companion"]').forEach((box) => {
          box.disabled = box.value === draft.trackId;
          if (box.disabled) box.checked = false;
        });
        const flow = steps();
        if (flow[draft.step] === 'career' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
      if (input.name === 'backendLanguage') {
        draft.backendLanguageId = input.value;
        draft.backendEcosystemIds = [];
        const flow = steps();
        if (flow[draft.step] === 'language' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
      if (input.name === 'backendEcosystem') draft.backendEcosystemIds = ecosystems();
      if (input.name === 'uiFramework') {
        draft.frontendFrameworkId = input.value;
        const flow = steps();
        if (flow[draft.step] === 'framework' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
      if (input.name === 'careerPath') {
        draft.careerChoiceId = input.value;
        const flow = steps();
        if (flow[draft.step] === 'path' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
      if (input.name === 'companion') draft.companionIds = companions();
      if (input.name === 'level') {
        draft.level = input.value;
        const flow = steps();
        if (flow[draft.step] === 'level' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
      if (input.name === 'hours' && input.value !== 'custom') {
        draft.hours = clampHours(input.value);
        const flow = steps();
        if (flow[draft.step] === 'hours' && draft.hours && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
    });
    $('onbSearch').addEventListener('input', () => { draft.query = $('onbSearch').value; filter(draft.query); });
    $('hoursCustom').addEventListener('input', () => {
      const custom = document.querySelector('#onboarding input[name="hours"][value="custom"]');
      if (custom) custom.checked = true;
      draft.hours = clampHours($('hoursCustom').value);
      paint();
    });
    $('welcomeStartBtn').addEventListener('click', () => goToStep(1));
    $('onbBack').addEventListener('click', () => goToStep(Math.max(0, draft.step - 1)));
    $('onbNext').addEventListener('click', () => {
      const id = steps()[draft.step];
      if (id === 'career' && !selected('track')) return toast('Escolha uma carreira.', 'error');
      if (id === 'career') draft.trackId = selected('track');
      if (id === 'language' && !selected('backendLanguage')) return toast('Escolha a linguagem do back-end.', 'error');
      if (id === 'language') {
        const nextLanguage = selected('backendLanguage');
        if (nextLanguage !== draft.backendLanguageId) draft.backendEcosystemIds = [];
        draft.backendLanguageId = nextLanguage;
      }
      if (id === 'ecosystem') {
        draft.backendEcosystemIds = ecosystems().filter((item) => item !== draft.backendLanguageId);
      }
      if (id === 'framework' && !selected('uiFramework')) return toast('Escolha o framework de front-end.', 'error');
      if (id === 'framework') draft.frontendFrameworkId = selected('uiFramework');
      if (id === 'path' && !selected('careerPath')) return toast('Escolha um caminho.', 'error');
      if (id === 'path') draft.careerChoiceId = selected('careerPath');
      if (id === 'companions') draft.companionIds = companions().filter((item) => item !== draft.trackId && (draft.trackId !== FULLSTACK_TRACK_ID || !blocksFullStackCompanion(item)) && (!careerIncludesFrontend(draft.trackId) || !FRONTEND_FRAMEWORK_IDS.includes(item)));
      if (id === 'level' && !selected('level')) return toast('Escolha um nível.', 'error');
      if (id === 'level') draft.level = selected('level');
      if (id === 'hours') {
        draft.hours = selected('hours') === 'custom' ? clampHours($('hoursCustom').value) : clampHours(selected('hours'));
        if (!draft.hours) return toast('Entre 1 e 60 horas.', 'error');
      }
      goToStep(draft.step + 1);
    });
    $('onbStart').addEventListener('click', () => { confirm().catch(() => toast('Não consegui montar a trilha.', 'error')); });
    $('welcomeBackBtn').addEventListener('click', () => api.refresh());
    $('backendLanguageNoticeBtn').addEventListener('click', () => open('retake'));
    $('frontendFrameworkNoticeBtn').addEventListener('click', () => open('retake'));
  }

  function open(mode, step) {
    draft.mode = mode;
    const state = api.getState();
    const current = state.tracks[state.activeTrackId];
    if (mode === 'retake' && current) {
      draft.trackId = state.activeTrackId;
      draft.level = current.level;
      draft.hours = current.weeklyHours;
      draft.companionIds = [...(state.profile.companionIds || [])];
      draft.backendLanguageId = state.profile.backendLanguageId || null;
      draft.backendEcosystemIds = [...(state.profile.backendEcosystemIds || [])];
      draft.frontendFrameworkId = state.profile.frontendFrameworkId || null;
      draft.careerChoiceId = state.profile.careerChoices?.[state.activeTrackId] || null;
    }
    if (mode === 'create') {
      draft.backendLanguageId = null;
      draft.backendEcosystemIds = [];
      draft.frontendFrameworkId = null;
      draft.careerChoiceId = null;
    }
    renderChoices();
    api.showScreen('onboarding');
    const flow = steps();
    if (step === 0) return goToStep(0);
    if (mode === 'retake' && step == null && state.activeTrackId === FULLSTACK_TRACK_ID && !state.profile.backendLanguageId) {
      const at = flow.indexOf('language');
      return goToStep(at >= 0 ? at : 1);
    }
    if (mode === 'retake' && step == null && careerIncludesFrontend(state.activeTrackId) && !state.profile.frontendFrameworkId) {
      const at = flow.indexOf('framework');
      return goToStep(at >= 0 ? at : 1);
    }
    if (mode === 'retake' && step == null && careerSplitOptions(state.activeTrackId, catalog()).length && !state.profile.careerChoices?.[state.activeTrackId]) {
      const at = flow.indexOf('path');
      return goToStep(at >= 0 ? at : 1);
    }
    if (typeof step === 'number') return goToStep(step);
    goToStep(mode === 'create' ? 0 : 1);
  }

  return { bind, open };
}

export { emptyTrackState, ensureTrack, roadmapStats, projectPlanStats };
