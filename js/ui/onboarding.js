import { applyStudySelection, buildCombinedRoadmap, clampHours, emptyTrackState, ensureTrack, formatDuration, groupTracks, projectPlanStats, roadmapStats, tracksMatching } from '../model.js';
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

const COPY = [
  ['Qual carreira você quer seguir?', 'Eu me perdi no meio de curso demais. Escolhe uma. Dá pra somar fundamento e linguagem no próximo passo.'],
  ['Leva algum fundamento ou linguagem junto?', 'Opcional. Marca o que você quer estudar em paralelo e segue.'],
  ['Onde você está agora?', 'O que estiver abaixo desse ponto entra como opcional. Continua na lista.'],
  ['Quantas horas sobram na semana, fora da aula?', 'A etapa usa esse ritmo. Você muda depois.'],
  ['Olha se ficou do seu tamanho', 'Carreira, companhia e horas. O progresso que você já marcou continua.'],
];

export function initOnboarding(api) {
  const { $, session, toast } = api;
  const draft = session.onboarding;

  function choice(name, value, title, text, selected, type = 'radio', iconHtml = '') {
    return `<label class="choice-card${selected ? ' is-selected' : ''}" data-value="${escapeHtml(value)}">
      <input type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${selected ? 'checked' : ''} />
      <span class="row" style="align-items:flex-start">${iconHtml}<span><strong>${escapeHtml(title)}</strong><span class="muted" style="display:block;margin-top:4px">${escapeHtml(text)}</span></span></span>
    </label>`;
  }

  function renderChoices() {
    const groups = groupTracks(catalog());
    $('onbTrackGroups').innerHTML = groups.filter((group) => group.id === 'carreira').map((group) => (
      `<div data-track-group="${group.id}">${group.tracks.map((track) => choice('track', track.id, track.name, track.tagline || '', draft.trackId === track.id, 'radio', trackIconHtml(track.id, 'md', track.name)).replace('data-value=', `data-search="${escapeHtml(`${track.name} ${track.tagline || ''} ${(track.keywords || []).join(' ')}`)}" data-value=`)).join('')}</div>`
    )).join('');
    $('onbCompanionList').innerHTML = groups.filter((group) => group.id !== 'carreira').map((group) => (
      `<fieldset class="stack"><legend class="eyebrow">${escapeHtml(group.title)}</legend><p class="muted">${escapeHtml(group.lead)}</p>
        ${group.tracks.map((track) => choice('companion', track.id, track.name, track.tagline || '', draft.companionIds.includes(track.id), 'checkbox', trackIconHtml(track.id, 'sm', track.name))).join('')}
      </fieldset>`
    )).join('');
    $('onbStep3').innerHTML = `<legend class="sr-only">Nível</legend>${LEVELS.map(([id, title, text]) => choice('level', id, title, text, draft.level === id)).join('')}`;
    $('hourChoices').innerHTML = HOURS.map((hours) => choice('hours', String(hours), `${hours} h`, 'por semana', draft.hours === hours)).join('')
      + choice('hours', 'custom', 'Outro', 'eu digo quantas', draft.hours && !HOURS.includes(draft.hours));
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
    root.innerHTML = `
      <div class="compass-wrap">${brandMark(true)}
        <svg class="compass-path" viewBox="0 0 160 28" aria-hidden="true"><path d="M2 20 C 40 20, 50 6, 90 8 S 140 18, 158 6" fill="none" stroke="var(--color-accent-graphic)" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
      <p class="eyebrow">${track ? escapeHtml(track.name) : 'Ainda sem carreira'}</p>
      <p style="font:var(--text-title-s);margin-top:6px">${track ? 'O começo da trilha' : 'Escolhe uma carreira pra eu montar o trajeto.'}</p>
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

  function goToStep(step) {
    draft.step = step;
    for (let index = 1; index <= 5; index += 1) $(`onbStep${index}`).hidden = index !== step;
    const [heading, lead] = COPY[step - 1];
    $('onbHeading').textContent = heading;
    $('onbLead').textContent = draft.mode === 'retake' && step === 5
      ? 'O que você já marcou e anotou fica. O nível novo recoloca o que era opcional.'
      : lead;
    $('onbStepLabel').textContent = `Passo ${step} de 5`;
    document.querySelectorAll('#onbSegments i').forEach((bar, index) => bar.classList.toggle('is-done', index < step));
    $('onbBack').hidden = step === 1;
    $('onbNext').hidden = step === 5;
    $('onbStart').hidden = step !== 5;
    $('onbStart').textContent = draft.mode === 'retake' ? 'Atualizar a trilha' : 'Montar a trilha';
    $('autoWrap').hidden = step === 2 || step === 5;
    $('onbNavRow').hidden = false;
    if (step === 5) renderPlan();
    preview();
  }

  function renderPlan() {
    const entry = catalog().find((item) => item.id === draft.trackId);
    if (!entry || !draft.level || !draft.hours) {
      $('planPreview').textContent = 'Faltou uma resposta. Volta um passo.';
      return;
    }
    const names = draft.companionIds.map((id) => catalog().find((item) => item.id === id)?.name).filter(Boolean);
    $('planPreview').innerHTML = `<p style="font:var(--text-title-s)">${escapeHtml(entry.name)} · ${escapeHtml(LEVELS.find((item) => item[0] === draft.level)?.[1] || draft.level)} · ${draft.hours} h por semana</p>
      <p class="muted" style="margin-top:8px">${names.length ? `Junto: ${escapeHtml(names.join(', '))}.` : 'Só a carreira, por enquanto.'} ${escapeHtml(formatDuration(draft.hours * 8, draft.hours))} dá uma noção do mês, o prazo real sai das etapas.</p>`;
  }

  async function confirm() {
    const ids = companions().filter((id) => id !== draft.trackId);
    draft.companionIds = ids;
    await api.ensureTracks([draft.trackId, ...ids]);
    applyStudySelection(api.getState(), {
      trackId: draft.trackId,
      level: draft.level,
      hours: draft.hours,
      companionIds: ids,
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
        if (draft.step === 1 && $('onbAutoAdvance').checked) setTimeout(() => goToStep(2), 180);
      }
      if (input.name === 'companion') draft.companionIds = companions();
      if (input.name === 'level') {
        draft.level = input.value;
        if (draft.step === 3 && $('onbAutoAdvance').checked) setTimeout(() => goToStep(4), 180);
      }
      if (input.name === 'hours' && input.value !== 'custom') {
        draft.hours = clampHours(input.value);
        preview();
        if (draft.step === 4 && draft.hours && $('onbAutoAdvance').checked) setTimeout(() => goToStep(5), 180);
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
    $('onbBack').addEventListener('click', () => goToStep(Math.max(1, draft.step - 1)));
    $('onbNext').addEventListener('click', () => {
      if (draft.step === 1 && !selected('track')) return toast('Escolhe uma carreira.', 'error');
      if (draft.step === 1) draft.trackId = selected('track');
      if (draft.step === 2) draft.companionIds = companions().filter((id) => id !== draft.trackId);
      if (draft.step === 3 && !selected('level')) return toast('Escolhe onde você está.', 'error');
      if (draft.step === 3) draft.level = selected('level');
      if (draft.step === 4) {
        draft.hours = selected('hours') === 'custom' ? clampHours($('hoursCustom').value) : clampHours(selected('hours'));
        if (!draft.hours) return toast('Entre 1 e 60 horas.', 'error');
      }
      goToStep(draft.step + 1);
    });
    $('onbStart').addEventListener('click', () => { confirm().catch(() => toast('Não consegui montar a trilha.', 'error')); });
    $('welcomeBackBtn').addEventListener('click', () => api.refresh());
  }

  function open(mode) {
    draft.mode = mode;
    const state = api.getState();
    const current = state.tracks[state.activeTrackId];
    if (mode === 'retake' && current) {
      draft.trackId = state.activeTrackId;
      draft.level = current.level;
      draft.hours = current.weeklyHours;
      draft.companionIds = [...(state.profile.companionIds || [])];
    }
    renderChoices();
    $('welcomeBackBtn').hidden = !(state.profile.onboarded && current);
    api.showScreen('onboarding');
    goToStep(1);
  }

  return { bind, open, preview };
}

export { emptyTrackState, ensureTrack, buildCombinedRoadmap, roadmapStats, projectPlanStats };
