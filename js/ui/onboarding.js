import {
  applyStudySelection, backendEcosystemChoices, backendLanguageChoices, careerIncludesFrontend,
  careerSplitOptions, clampHours, companionOptionsForCareer, emptyTrackState, ensureTrack,
  filterCompanionSelection, formatDuration, frontendFrameworkChoices, fullstackOnboardingSteps,
  FULLSTACK_TRACK_ID, groupTracks, MAX_COMPANION_FUNDAMENTALS, MAX_COMPANION_TECHNOLOGIES,
  projectPlanStats, roadmapStats, tracksMatching,
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
  fundamentals: 'onbStepFundamentals',
  technologies: 'onbStepTechnologies',
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
  fundamentals: [
    'Quer incluir fundamentos da computação?',
    `Opcional — escolha até ${MAX_COMPANION_FUNDAMENTALS} trilhas de base para reforçar sua carreira. Os mais indicados para seu objetivo aparecem primeiro.`,
  ],
  technologies: [
    'Quais linguagens ou ferramentas quer estudar junto?',
    `Opcional — escolha até ${MAX_COMPANION_TECHNOLOGIES} tecnologias complementares para não inflar seu roadmap. Destacamos as sugeridas para seu objetivo.`,
  ],
  level: ['Qual é o seu nível hoje?', 'Tópicos abaixo desse nível entram como opcionais. Eles continuam visíveis.'],
  hours: ['Quantas horas por semana você consegue estudar?', 'A estimativa de cada etapa usa esse ritmo. Dá para ajustar depois.'],
  preview: ['Seu plano', 'Confira a carreira, os fundamentos e as tecnologias antes de gerar seu roadmap completo.'],
};

export function initOnboarding(api) {
  const { $, session, toast } = api;
  const draft = session.onboarding;

  function choice(name, value, title, text, selected, type = 'radio', iconHtml = '', badge = '', disabled = false) {
    const badgeHtml = badge ? ` <span class="tag tag-highlight">${escapeHtml(badge)}</span>` : '';
    return `<label class="choice-card${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}" data-value="${escapeHtml(value)}">
      <input type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${selected ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
      <span class="row" style="align-items:flex-start">${iconHtml}<span style="flex:1;min-width:0"><span class="row" style="gap:8px"><strong>${escapeHtml(title)}</strong>${badgeHtml}</span><span class="muted" style="display:block;margin-top:4px">${escapeHtml(text)}</span></span></span>
    </label>`;
  }

  function companionContext() {
    return {
      backendLanguageId: draft.trackId === FULLSTACK_TRACK_ID ? draft.backendLanguageId : null,
      backendEcosystemIds: draft.trackId === FULLSTACK_TRACK_ID ? draft.backendEcosystemIds : [],
      frontendFrameworkId: careerIncludesFrontend(draft.trackId) ? draft.frontendFrameworkId : null,
      careerChoiceId: draft.careerChoiceId,
    };
  }

  function pruneCompanions() {
    draft.companionIds = filterCompanionSelection(
      draft.companionIds || [],
      draft.trackId,
      catalog(),
      companionContext(),
    );
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

  function syncCompanionLocks(inputName, max, nounPlural) {
    const boxes = [...document.querySelectorAll(`#onboarding input[name="${inputName}"]`)];
    const checkedCount = boxes.filter((box) => box.checked).length;
    const atLimit = checkedCount >= max;
    boxes.forEach((box) => {
      const lock = atLimit && !box.checked;
      box.disabled = lock;
      box.closest('.choice-card')?.classList.toggle('is-disabled', lock);
      box.closest('.choice-card')?.classList.toggle('is-selected', box.checked);
    });
    const counter = document.querySelector(`[data-limit-counter="${inputName}"]`);
    if (counter) {
      counter.textContent = atLimit
        ? `${checkedCount} de ${max} ${nounPlural} (limite atingido)`
        : `${checkedCount} de ${max} ${nounPlural}`;
      counter.className = atLimit ? 'tag tag-highlight' : 'tag';
    }
  }

  function renderCompanionStep(group) {
    pruneCompanions();
    const isFund = group === 'fundamentos';
    const container = $(isFund ? 'onbFundamentalsList' : 'onbTechnologiesList');
    if (!container) return;
    const inputName = isFund ? 'fundamental' : 'technology';
    const max = isFund ? MAX_COMPANION_FUNDAMENTALS : MAX_COMPANION_TECHNOLOGIES;
    const badge = isFund ? 'Sugerido' : 'Sugerida';
    const nounPlural = isFund ? 'selecionados' : 'selecionadas';
    const moreLabel = isFund ? 'Outros fundamentos' : 'Outras tecnologias';
    const careerName = catalog().find((item) => item.id === draft.trackId)?.name || 'seu objetivo';
    const { suggested, others } = companionOptionsForCareer(draft.trackId, catalog(), group, companionContext());
    const chosenSet = new Set(draft.companionIds || []);
    const hasSelectedInOthers = others.some((track) => chosenSet.has(track.id));

    const suggestedHtml = suggested.length
      ? `<div class="choice-list">${suggested.map((track) => choice(
        inputName,
        track.id,
        track.name,
        track.tagline || '',
        chosenSet.has(track.id),
        'checkbox',
        trackIconHtml(track.id, 'sm', track.name),
        badge,
      )).join('')}</div>`
      : '<p class="muted">Nenhuma sugestão específica para esta carreira.</p>';

    const othersHtml = others.length
      ? `<details class="onb-more"${hasSelectedInOthers ? ' open' : ''}>
          <summary>${moreLabel} (${others.length})</summary>
          <div class="choice-list">${others.map((track) => choice(
        inputName,
        track.id,
        track.name,
        track.tagline || '',
        chosenSet.has(track.id),
        'checkbox',
        trackIconHtml(track.id, 'sm', track.name),
      )).join('')}</div>
        </details>`
      : '';

    container.innerHTML = `
      <div class="spread">
        <span class="eyebrow">${isFund ? 'Recomendados' : 'Sugeridas'} para ${escapeHtml(careerName)}</span>
        <span class="tag" data-limit-counter="${inputName}" role="status" aria-live="polite"></span>
      </div>
      ${suggestedHtml}
      ${othersHtml}
    `;
    syncCompanionLocks(inputName, max, nounPlural);
  }

  function updateDraftCompanionsFromGroup(group, inputName) {
    const byId = new Map(catalog().map((item) => [item.id, item]));
    const keptOtherGroup = (draft.companionIds || []).filter((id) => {
      const itemGroup = byId.get(id)?.group;
      return itemGroup && itemGroup !== group;
    });
    const currentGroupIds = [...document.querySelectorAll(`#onboarding input[name="${inputName}"]:checked`)].map((el) => el.value);
    const ordered = group === 'fundamentos'
      ? [...currentGroupIds, ...keptOtherGroup]
      : [...keptOtherGroup, ...currentGroupIds];
    draft.companionIds = filterCompanionSelection(ordered, draft.trackId, catalog(), companionContext());
  }

  function renderChoices() {
    const groups = groupTracks(catalog());
    $('onbTrackGroups').innerHTML = groups.filter((group) => group.id === 'carreira').map((group) => (
      `<div data-track-group="${group.id}">${group.tracks.map((track) => choice('track', track.id, track.name, track.tagline || '', draft.trackId === track.id, 'radio', trackIconHtml(track.id, 'md', track.name)).replace('data-value=', `data-search="${escapeHtml(`${track.name} ${track.tagline || ''} ${(track.keywords || []).join(' ')}`)}" data-value=`)).join('')}</div>`
    )).join('');
    $('onbStep3').innerHTML = `<legend class="sr-only">Nível</legend>${LEVELS.map(([id, title, text]) => choice('level', id, title, text, draft.level === id)).join('')}`;
    $('hourChoices').innerHTML = HOURS.map((hours) => choice('hours', String(hours), `${hours} h`, 'por semana', draft.hours === hours)).join('')
      + choice('hours', 'custom', 'Outro', 'eu digo quantas', draft.hours && !HOURS.includes(draft.hours));
    renderLanguages();
    renderEcosystem();
    renderUiFramework();
    renderPath();
    renderCompanionStep('fundamentos');
    renderCompanionStep('tecnologia');
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
      const input = card.querySelector('input');
      card.classList.toggle('is-selected', !!input?.checked);
      card.classList.toggle('is-disabled', !!input?.disabled);
    });
  }

  function selected(name) {
    return document.querySelector(`#onboarding input[name="${name}"]:checked`)?.value || null;
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
    if (id === 'fundamentals') renderCompanionStep('fundamentos');
    if (id === 'technologies') renderCompanionStep('tecnologia');
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
    $('autoWrap').hidden = id === 'fundamentals' || id === 'technologies' || id === 'ecosystem' || id === 'preview';
    $('onbNavRow').hidden = false;
    if (id === 'preview') renderPlan();
  }

  function renderPlan() {
    const entry = catalog().find((item) => item.id === draft.trackId);
    if (!entry || !draft.level || !draft.hours || (draft.trackId === FULLSTACK_TRACK_ID && !draft.backendLanguageId) || (careerIncludesFrontend(draft.trackId) && !draft.frontendFrameworkId)) {
      $('planPreview').textContent = 'Faltou uma resposta. Volte um passo.';
      return;
    }
    pruneCompanions();
    const byId = new Map(catalog().map((item) => [item.id, item]));
    const fundNames = draft.companionIds.map((id) => byId.get(id)).filter((t) => t?.group === 'fundamentos').map((t) => t.name);
    const techNames = draft.companionIds.map((id) => byId.get(id)).filter((t) => t && t.group !== 'fundamentos').map((t) => t.name);
    const language = backendLanguageChoices(catalog()).find((item) => item.id === draft.backendLanguageId);
    const eco = draft.backendEcosystemIds.map((id) => byId.get(id)?.name).filter(Boolean);
    const ui = frontendFrameworkChoices(catalog()).find((item) => item.id === draft.frontendFrameworkId);
    const backendLine = draft.trackId === FULLSTACK_TRACK_ID && language
      ? ` Back-end em ${language.name}${eco.length ? `, com ${eco.join(', ')}` : ''}.`
      : '';
    const uiLine = ui ? ` Front-end com ${ui.name}.` : '';
    const extraParts = [];
    if (fundNames.length) extraParts.push(`Fundamentos: ${fundNames.join(', ')}.`);
    if (techNames.length) extraParts.push(`Tecnologias: ${techNames.join(', ')}.`);
    const extraText = extraParts.length ? extraParts.join(' ') : 'Só a carreira principal, por enquanto.';
    $('planPreview').innerHTML = `<p style="font:var(--text-title-s)">${escapeHtml(entry.name)} · ${escapeHtml(LEVELS.find((item) => item[0] === draft.level)?.[1] || draft.level)} · ${draft.hours} h por semana</p>
      <p class="muted" style="margin-top:8px">${escapeHtml(extraText)}${escapeHtml(backendLine)}${escapeHtml(uiLine)} ${escapeHtml(formatDuration(draft.hours * 8, draft.hours))} dá uma noção do mês, o prazo real sai das etapas.</p>`;
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
    pruneCompanions();
    const ids = [...draft.companionIds];
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
      catalog: catalog(),
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
    const homeTitle = $('homeTitleLockup');
    if (homeTitle && !homeTitle.querySelector('.brand-mark')) homeTitle.insertAdjacentHTML('afterbegin', brandMark(true));
    $('onbThemeBtn').innerHTML = icon('sun');
    $('onbThemeBtn').addEventListener('click', () => api.toggleTheme());
    renderChoices();
    document.addEventListener('change', (event) => {
      if (!$('onboarding') || $('onboarding').hidden) return;
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (input.name === 'fundamental') {
        const checked = document.querySelectorAll('#onboarding input[name="fundamental"]:checked');
        if (checked.length > MAX_COMPANION_FUNDAMENTALS) {
          input.checked = false;
          toast(`Escolha no máximo ${MAX_COMPANION_FUNDAMENTALS} fundamentos.`, 'error');
        }
        updateDraftCompanionsFromGroup('fundamentos', 'fundamental');
        syncCompanionLocks('fundamental', MAX_COMPANION_FUNDAMENTALS, 'selecionados');
        return;
      }
      if (input.name === 'technology') {
        const checked = document.querySelectorAll('#onboarding input[name="technology"]:checked');
        if (checked.length > MAX_COMPANION_TECHNOLOGIES) {
          input.checked = false;
          toast(`Escolha no máximo ${MAX_COMPANION_TECHNOLOGIES} tecnologias.`, 'error');
        }
        updateDraftCompanionsFromGroup('tecnologia', 'technology');
        syncCompanionLocks('technology', MAX_COMPANION_TECHNOLOGIES, 'selecionadas');
        return;
      }
      paint();
      if (input.name === 'track') {
        draft.trackId = input.value;
        pruneCompanions();
        const flow = steps();
        if (flow[draft.step] === 'career' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
      if (input.name === 'backendLanguage') {
        draft.backendLanguageId = input.value;
        draft.backendEcosystemIds = [];
        pruneCompanions();
        const flow = steps();
        if (flow[draft.step] === 'language' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
      if (input.name === 'backendEcosystem') {
        draft.backendEcosystemIds = ecosystems();
        pruneCompanions();
      }
      if (input.name === 'uiFramework') {
        draft.frontendFrameworkId = input.value;
        pruneCompanions();
        const flow = steps();
        if (flow[draft.step] === 'framework' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
      if (input.name === 'careerPath') {
        draft.careerChoiceId = input.value;
        pruneCompanions();
        const flow = steps();
        if (flow[draft.step] === 'path' && $('onbAutoAdvance').checked) setTimeout(() => goToStep(draft.step + 1), 180);
      }
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
      if (id === 'fundamentals') updateDraftCompanionsFromGroup('fundamentos', 'fundamental');
      if (id === 'technologies') updateDraftCompanionsFromGroup('tecnologia', 'technology');
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
      pruneCompanions();
    }
    if (mode === 'create') {
      draft.trackId = null;
      draft.level = null;
      draft.hours = 8;
      draft.companionIds = [];
      draft.query = '';
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
