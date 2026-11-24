import {
  applyStudySelection, backendEcosystemChoices, backendLanguageChoices, blocksFullStackCompanion, clampHours,
  emptyTrackState, ensureTrack, formatDuration, fullstackOnboardingSteps, FULLSTACK_TRACK_ID, groupTracks,
  projectPlanStats, roadmapStats, tracksMatching,
} from '../model.js';
import { suggestSlot, syncPlanWeeklyHours } from '../plan.js';
import { trackIconHtml } from '../icons.js';
import { catalog, loadTrack } from '../load-tracks.js';
import { brandMark, escapeHtml, icon } from './dom.js';

const LEVELS = [
  ['iniciante', 'Começando', 'Vi pouco disso na faculdade.'],
  ['intermediario', 'Já programo', 'O básico da área eu já uso.'],
  ['avancado', 'Quero o buraco', 'Já fiz projeto e falta o que ainda trava.'],
];
const HOURS = [4, 8, 12, 20];
const SAMPLE = [
  [1, '08:00', '10:00', 'Cálculo'],
  [2, '14:00', '16:00', 'Física'],
  [3, '08:00', '10:00', 'Cálculo'],
  [4, '10:00', '12:00', 'Laboratório'],
];

const STEP_DOM = {
  career: 'onbStep1',
  language: 'onbStepLanguage',
  ecosystem: 'onbStepEcosystem',
  companions: 'onbStep2',
  level: 'onbStep3',
  hours: 'onbStep4',
  preview: 'onbStep5',
};

const STEP_COPY = {
  career: ['Qual carreira você quer seguir?', 'Eu me perdi no meio de curso demais. Escolhe uma. Dá pra somar fundamento e linguagem no próximo passo.'],
  language: ['Qual linguagem no back-end?', 'Nenhuma vem marcada. HTTP, REST, banco, auth, teste e deploy continuam.'],
  ecosystem: ['Qual framework?', 'Um só. Entra no lugar do framework de back-end. O resto da trilha fica.'],
  companions: ['Leva algum fundamento ou linguagem junto?', 'Opcional. Marca o que você quer estudar em paralelo e segue.'],
  level: ['Onde você está agora?', 'O que estiver abaixo desse ponto entra como opcional. Continua na lista.'],
  hours: ['Quantas horas sobram na semana, fora da aula?', 'A etapa usa esse ritmo. Você muda depois.'],
  preview: ['Olha se ficou do seu tamanho', 'Carreira, companhia e horas. O progresso que você já marcou continua.'],
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
    return fullstackOnboardingSteps(draft.trackId, draft.backendLanguageId, catalog());
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
        ${group.tracks.filter((track) => draft.trackId !== FULLSTACK_TRACK_ID || !blocksFullStackCompanion(track.id)).map((track) => choice('companion', track.id, track.name, track.tagline || '', draft.companionIds.includes(track.id), 'checkbox', trackIconHtml(track.id, 'sm', track.name))).join('')}
      </fieldset>`
    )).join('');
    $('onbStep3').innerHTML = `<legend class="sr-only">Nível</legend>${LEVELS.map(([id, title, text]) => choice('level', id, title, text, draft.level === id)).join('')}`;
    $('hourChoices').innerHTML = HOURS.map((hours) => choice('hours', String(hours), `${hours} h`, 'por semana', draft.hours === hours)).join('')
      + choice('hours', 'custom', 'Outro', 'eu digo quantas', draft.hours && !HOURS.includes(draft.hours));
    renderLanguages();
    renderEcosystem();
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

  async function preview() {
    const root = $('livePreview');
    const hours = draft.hours || 8;
    const slot = suggestSlot(hours, 4);
    const track = draft.trackId ? await loadTrack(draft.trackId).catch(() => null) : null;
    const phases = track ? track.phases.slice(0, 4) : [];
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const language = backendLanguageChoices(catalog()).find((item) => item.id === draft.backendLanguageId);
    const languageLine = draft.trackId !== FULLSTACK_TRACK_ID
      ? ''
      : `<p class="mono">${language ? `Back-end em ${escapeHtml(language.name)}.` : 'Back-end: escolhe a linguagem. Nenhuma vem marcada.'}</p>`;
    root.innerHTML = `
      <div class="compass-wrap">${brandMark(true)}
        <svg class="compass-path" viewBox="0 0 160 28" aria-hidden="true"><path d="M2 20 C 40 20, 50 6, 90 8 S 140 18, 158 6" fill="none" stroke="var(--color-accent-graphic)" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
      <p class="eyebrow">${track ? escapeHtml(track.name) : 'Ainda sem carreira'}</p>
      <p style="font:var(--text-title-s);margin-top:6px">${track ? 'O começo da trilha' : 'Escolhe uma carreira pra eu montar o trajeto.'}</p>
      ${languageLine}
      <div class="preview-stages">${phases.map((phase) => `<p class="mono">Etapa ${phase.number} · ${escapeHtml(phase.title)}</p>`).join('') || '<div class="skeleton" style="height:64px"></div>'}</div>
      <p class="mono">Semana de exemplo. A aula ocupa o horário. O estudo entra no vão, ${hours} h.</p>
      <div class="week" style="margin-top:8px">${days.map((label, day) => {
        const classes = SAMPLE.filter((item) => item[0] === day).map((item) => `<span class="busy-block">${item[1].slice(0, 5)} ${escapeHtml(item[3])}</span>`).join('');
        const study = [1, 2, 3, 4].includes(day) ? `<span class="study-block">${slot.start} estudo</span>` : '';
        return `<div class="week-col"><strong>${label}</strong>${classes}${study}</div>`;
      }).join('')}</div>`;
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
    for (const domId of new Set(Object.values(STEP_DOM))) $(domId).hidden = true;
    if (id === 'language') renderLanguages();
    if (id === 'ecosystem') renderEcosystem();
    if (id === 'companions') renderChoices();
    $(STEP_DOM[id]).hidden = false;
    const [heading, lead] = STEP_COPY[id];
    $('onbHeading').textContent = heading;
    $('onbLead').textContent = draft.mode === 'retake' && id === 'preview'
      ? 'O que você já marcou e anotou fica. O nível novo recoloca o que era opcional.'
      : lead;
    $('onbStepLabel').textContent = `Passo ${index + 1} de ${flow.length}`;
    $('onbSegments').innerHTML = flow.map((_, bar) => `<i${bar <= index ? ' class="is-done"' : ''}></i>`).join('');
    $('onbBack').hidden = index === 0;
    $('onbNext').hidden = id === 'preview';
    $('onbStart').hidden = id !== 'preview';
    $('onbStart').textContent = draft.mode === 'retake' ? 'Atualizar a trilha' : 'Montar a trilha';
    $('autoWrap').hidden = id === 'companions' || id === 'ecosystem' || id === 'preview';
    $('onbNavRow').hidden = false;
    if (id === 'preview') renderPlan();
    preview();
  }

  function renderPlan() {
    const entry = catalog().find((item) => item.id === draft.trackId);
    if (!entry || !draft.level || !draft.hours || (draft.trackId === FULLSTACK_TRACK_ID && !draft.backendLanguageId)) {
      $('planPreview').textContent = 'Faltou uma resposta. Volta um passo.';
      return;
    }
    const names = draft.companionIds.map((id) => catalog().find((item) => item.id === id)?.name).filter(Boolean);
    const language = backendLanguageChoices(catalog()).find((item) => item.id === draft.backendLanguageId);
    const eco = draft.backendEcosystemIds.map((id) => catalog().find((item) => item.id === id)?.name).filter(Boolean);
    const backendLine = draft.trackId === FULLSTACK_TRACK_ID && language
      ? ` Back-end em ${language.name}${eco.length ? `, com ${eco.join(', ')}` : ''}.`
      : '';
    $('planPreview').innerHTML = `<p style="font:var(--text-title-s)">${escapeHtml(entry.name)} · ${escapeHtml(LEVELS.find((item) => item[0] === draft.level)?.[1] || draft.level)} · ${draft.hours} h por semana</p>
      <p class="muted" style="margin-top:8px">${names.length ? `Junto: ${escapeHtml(names.join(', '))}.` : 'Só a carreira, por enquanto.'}${escapeHtml(backendLine)} ${escapeHtml(formatDuration(draft.hours * 8, draft.hours))} dá uma noção do mês, o prazo real sai das etapas.</p>`;
  }

  async function confirm() {
    if (draft.trackId === FULLSTACK_TRACK_ID && !draft.backendLanguageId) {
      toast('Escolhe a linguagem do back-end.', 'error');
      const at = steps().indexOf('language');
      if (at >= 0) goToStep(at);
      return;
    }
    const ids = companions().filter((id) => id !== draft.trackId && (draft.trackId !== FULLSTACK_TRACK_ID || !blocksFullStackCompanion(id)));
    draft.companionIds = ids;
    const languageIds = draft.trackId === FULLSTACK_TRACK_ID
      ? [draft.backendLanguageId, ...draft.backendEcosystemIds]
      : [];
    await api.ensureTracks([draft.trackId, ...ids, ...languageIds]);
    applyStudySelection(api.getState(), {
      trackId: draft.trackId,
      level: draft.level,
      hours: draft.hours,
      companionIds: ids,
      backendLanguageId: draft.trackId === FULLSTACK_TRACK_ID ? draft.backendLanguageId : null,
      backendEcosystemIds: draft.trackId === FULLSTACK_TRACK_ID ? draft.backendEcosystemIds : [],
    });
    const primary = api.getState().tracks[draft.trackId];
    if (primary.studyPlan) syncPlanWeeklyHours(primary.studyPlan, draft.hours);
    session.combinedView = ids.length > 0;
    api.persistAll();
    toast(draft.mode === 'retake' ? 'Trilha atualizada. O que você já fez continua.' : 'Trilha montada. Bom estudo.');
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
        preview();
        const flow = steps();
        if (flow[draft.step] === 'career' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
      if (input.name === 'backendLanguage') {
        draft.backendLanguageId = input.value;
        draft.backendEcosystemIds = [];
        preview();
        const flow = steps();
        if (flow[draft.step] === 'language' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
      if (input.name === 'backendEcosystem') draft.backendEcosystemIds = ecosystems();
      if (input.name === 'companion') draft.companionIds = companions();
      if (input.name === 'level') {
        draft.level = input.value;
        const flow = steps();
        if (flow[draft.step] === 'level' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
      if (input.name === 'hours' && input.value !== 'custom') {
        draft.hours = clampHours(input.value);
        preview();
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
      preview();
    });
    $('onbBack').addEventListener('click', () => goToStep(draft.step - 1));
    $('onbNext').addEventListener('click', () => {
      const id = steps()[draft.step];
      if (id === 'career' && !selected('track')) return toast('Escolhe uma carreira.', 'error');
      if (id === 'career') draft.trackId = selected('track');
      if (id === 'language' && !selected('backendLanguage')) return toast('Escolhe a linguagem do back-end.', 'error');
      if (id === 'language') {
        const nextLanguage = selected('backendLanguage');
        if (nextLanguage !== draft.backendLanguageId) draft.backendEcosystemIds = [];
        draft.backendLanguageId = nextLanguage;
      }
      if (id === 'ecosystem') {
        draft.backendEcosystemIds = ecosystems().filter((item) => item !== draft.backendLanguageId);
      }
      if (id === 'companions') draft.companionIds = companions().filter((item) => item !== draft.trackId);
      if (id === 'level' && !selected('level')) return toast('Escolhe onde você está.', 'error');
      if (id === 'level') draft.level = selected('level');
      if (id === 'hours') {
        draft.hours = selected('hours') === 'custom' ? clampHours($('hoursCustom').value) : clampHours(selected('hours'));
        if (!draft.hours) return toast('Entre 1 e 60 horas.', 'error');
      }
      goToStep(draft.step + 1);
    });
    $('onbStart').addEventListener('click', () => { confirm().catch(() => toast('Não consegui montar a trilha.', 'error')); });
    $('welcomeBackBtn').addEventListener('click', () => api.refresh());
    $('backendLanguageNoticeBtn').addEventListener('click', () => open('retake', { focus: 'language' }));
  }

  function open(mode, options = {}) {
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
    }
    if (mode === 'create') {
      draft.backendLanguageId = null;
      draft.backendEcosystemIds = [];
    }
    renderChoices();
    $('welcomeBackBtn').hidden = !(state.profile.onboarded && current);
    api.showScreen('onboarding');
    const flow = steps();
    let start = 0;
    if (options.focus) {
      const at = flow.indexOf(options.focus);
      if (at >= 0) start = at;
    } else if (mode === 'retake' && state.activeTrackId === FULLSTACK_TRACK_ID && !state.profile.backendLanguageId) {
      const at = flow.indexOf('language');
      if (at >= 0) start = at;
    }
    goToStep(start);
  }

  return { bind, open, preview };
}

export { emptyTrackState, ensureTrack, roadmapStats, projectPlanStats };
