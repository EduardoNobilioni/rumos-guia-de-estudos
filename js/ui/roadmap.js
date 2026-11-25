import {
  LEVEL_LABELS, clampHours, currentPhase, effectiveStatus, formatDuration, layoutStudyMap, moveId,
  naturalStatus, phaseDeadlines, projectPlanStats, quizScore, roadmapStats, setTopicStatus, visibleProjects,
} from '../model.js';
import { checkbox, escapeHtml, icon, openMenu, safeUrl, watchReveals } from './dom.js';

const KIND = { leitura: 'Leitura', curso: 'Curso', documentacao: 'Documentação', pratica: 'Prática', video: 'Vídeo' };

export function initRoadmap(api) {
  const { $, session, toast, persist } = api;

  function topicNode(topic, titleById, doneIds, index, nextId) {
    const optional = topic.status === 'optional';
    const strike = topic.done && api.getState().strikethrough ? ' is-strike' : '';
    const source = topic.sourceTrackId || api.activeTrack()?.id || '';
    const pending = (topic.prerequisites || []).filter((id) => !doneIds.has(id) && titleById.has(id));
    const next = topic.id === nextId;
    return `<article class="topic-node${topic.done ? ' is-done' : ''}${optional ? ' is-optional' : ''}${next ? ' is-next' : ''}" data-node-id="${topic.id}">
      ${checkbox(topic.done, `data-action="toggle-item" data-item-id="${topic.id}" data-source-track="${escapeHtml(source)}"`, `${topic.done ? 'Desmarcar' : 'Concluir'} ${topic.title}`)}
      <button type="button" class="stack" style="flex:1;border:0;background:transparent;text-align:left;padding:0" data-action="open-topic-detail" data-item-id="${topic.id}" data-source-track="${escapeHtml(source)}" ${next ? 'id="comece-aqui"' : ''}>
        ${next ? '<span class="map-kicker">Comece aqui</span>' : ''}
        <span class="topic-title${strike}" style="font:var(--text-label-m)">${escapeHtml(topic.title)}</span>
        <span class="mono">${escapeHtml(LEVEL_LABELS[topic.level] || topic.level)}${optional ? ' · Opcional' : ''}</span>
        ${pending.length ? `<span class="faint">Antes: ${escapeHtml(pending.map((id) => titleById.get(id)).join(', '))}</span>` : ''}
      </button>
    </article>`;
  }

  function mapNode(topic, nextId, branch) {
    const source = topic.sourceTrackId || api.activeTrack()?.id || '';
    const done = !!topic.done;
    const optional = branch || topic.status === 'optional';
    const next = topic.id === nextId;
    const strike = done && api.getState().strikethrough ? ' is-strike' : '';
    const cls = ['map-node', done ? 'is-done' : '', optional ? 'is-optional' : '', next ? 'is-next' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}">
      ${checkbox(done, `data-action="toggle-item" data-item-id="${topic.id}" data-source-track="${escapeHtml(source)}"`, `${done ? 'Desmarcar' : 'Concluir'} ${topic.title}`)}
      <button type="button" class="map-open" data-action="open-topic-detail" data-item-id="${topic.id}" data-source-track="${escapeHtml(source)}" ${next ? 'id="comece-aqui"' : ''}>
        ${next ? '<span class="map-kicker">Comece aqui</span>' : ''}
        <span class="topic-title${strike}">${escapeHtml(topic.title)}</span>
      </button>
    </div>`;
  }

  function mapWing(topics, side, nextId) {
    if (!topics.length) return '<div class="map-wing"></div>';
    const list = `<div class="map-branch-list">${topics.map((topic) => {
      const optional = topic.status === 'optional';
      const arm = '<span class="map-arm" aria-hidden="true"></span>';
      const node = mapNode(topic, nextId, true);
      return `<div class="map-link${optional ? ' is-optional' : ''}">${side === 'right' ? arm : ''}${node}${side === 'left' ? arm : ''}</div>`;
    }).join('')}</div>`;
    const trunk = '<span class="map-trunk" aria-hidden="true"></span>';
    return `<div class="map-wing map-wing-${side}">${side === 'right' ? trunk : ''}${list}${side === 'left' ? trunk : ''}</div>`;
  }

  function visibleTopics(phase, query, phaseHit) {
    return phase.topics.filter((topic) => {
      if (session.filter === 'hidden') return topic.status === 'hidden' && (phaseHit || matches(topic, query));
      if (topic.status === 'hidden') return false;
      if (session.filter === 'pending' && topic.done) return false;
      if (session.filter === 'completed' && !topic.done) return false;
      if (session.filter === 'optional' && topic.status !== 'optional') return false;
      if (query && !phaseHit && !matches(topic, query)) return false;
      return true;
    });
  }

  function renderMap(view, query) {
    const state = api.getState();
    const branchTrackIds = (state.profile.companionIds || []).filter((id) => id !== state.activeTrackId);
    const filtered = view.phases.map((phase) => {
      const phaseHit = query && `${phase.title} ${phase.badgeTitle} ${phase.note}`.toLowerCase().includes(query);
      return { ...phase, topics: visibleTopics(phase, query, phaseHit) };
    });
    const stops = layoutStudyMap(filtered, { branchTrackIds });
    const next = currentPhase(filtered)?.topics.find((topic) => topic.status === 'required' && !topic.done);
    const nextId = next?.id;
    const stats = roadmapStats(view.phases);
    const rows = [`<div class="map-row"><div></div><div class="map-core"><p class="map-flag">Começo</p><span class="map-stem" aria-hidden="true"></span></div><div></div></div>`];
    rows.push(`<div class="map-row"><div></div><div class="map-core"><p class="map-progress">${stats.requiredDone} de ${stats.required} tópicos</p><div class="bar" aria-hidden="true"><span style="transform:scaleX(${stats.required ? stats.requiredDone / stats.required : 0})"></span></div></div><div></div></div>`);
    for (const stop of stops) {
      const phase = stop.phase;
      const here = next && phase.topics.some((topic) => topic.id === nextId);
      rows.push(`<div class="map-row map-stage-row"><div></div><div class="map-core"><span class="map-stem" aria-hidden="true"></span><div class="map-stage${here ? ' is-current' : ''}"><p class="eyebrow">Etapa ${phase.number}${here ? ' · Próximo passo' : ''}</p><h3>${escapeHtml(phase.title)}</h3><p class="mono">${phase.progress.requiredDone} de ${phase.progress.requiredTotal || phase.progress.total}</p></div></div><div></div></div>`);
      const spineSet = new Set(stop.spine);
      const slots = stop.spine.map((topic) => ({ topic, left: [], right: [] }));
      const slotByTopicId = new Map(slots.map((slot) => [slot.topic.id, slot]));
      let lastSeenSlot = slots[0] || null;
      const pushToSlot = (slot, topic) => {
        if (!slot) return;
        if (slot.left.length <= slot.right.length) slot.left.push(topic);
        else slot.right.push(topic);
        slotByTopicId.set(topic.id, slot);
      };
      for (const topic of stop.phase.topics) {
        if (topic.status === 'hidden') continue;
        if (spineSet.has(topic)) {
          lastSeenSlot = slotByTopicId.get(topic.id) || lastSeenSlot;
          continue;
        }
        if (!stop.branches.includes(topic) || !slots.length) continue;
        const prereqSlot = (topic.prerequisites || []).map((id) => slotByTopicId.get(id)).find(Boolean);
        const sameTrackSlot = topic.sourceTrackId
          ? [...slots].reverse().find((slot) => slot.topic.sourceTrackId === topic.sourceTrackId)
          : null;
        const hostSlot = prereqSlot || sameTrackSlot || lastSeenSlot || slots[0];
        pushToSlot(hostSlot, topic);
      }
      for (const slot of slots) {
        rows.push(`<div class="map-row">${mapWing(slot.left, 'left', nextId)}<div class="map-core"><span class="map-stem" aria-hidden="true"></span>${mapNode(slot.topic, nextId, false)}<span class="map-stem" aria-hidden="true"></span></div>${mapWing(slot.right, 'right', nextId)}</div>`);
      }
    }
    rows.push(`<div class="map-row"><div></div><div class="map-core"><span class="map-stem" aria-hidden="true"></span><p class="map-flag">Fim da trilha</p></div><div></div></div>`);
    return `<div class="study-map" aria-label="Mapa da trilha, do começo ao fim">${rows.join('')}</div>`;
  }

  function detail(topic, phase, index, total, titleById, doneIds) {
    const source = topic.sourceTrackId || api.activeTrack()?.id || '';
    const trackState = api.getState().tracks[source] || api.activeTrackState();
    const strike = topic.done && api.getState().strikethrough ? ' is-strike' : '';
    const noteOpen = !!session.openNotes[topic.id];
    const linkOpen = !!session.openLinkForms[topic.id];
    const resources = (topic.resources || []).filter((resource) => {
      if (session.resourceLang !== 'all' && (resource.lang || 'pt') !== session.resourceLang) return false;
      if (session.resourceKind !== 'all' && (resource.kind || 'leitura') !== session.resourceKind) return false;
      return true;
    }).map((resource) => {
      const href = safeUrl(resource.url);
      if (!href) return '';
      const key = `${topic.id}::${href}`;
      const seen = !!(trackState.doneResources && trackState.doneResources[key]);
      return `<li class="row" style="align-items:flex-start"><input type="checkbox" data-action="toggle-resource" data-item-id="${topic.id}" data-url="${escapeHtml(href)}" ${seen ? 'checked' : ''} aria-label="Marcar ${escapeHtml(resource.title)} como visto" /><span><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(resource.title)}</a> <span class="mono">${resource.lang === 'en' ? 'EN' : 'PT'} · ${KIND[resource.kind] || 'Leitura'}</span>${resource.custom ? `<button type="button" class="btn btn-ghost btn-small" data-action="remove-topic-link" data-item-id="${topic.id}" data-url="${escapeHtml(href)}">Remover</button>` : ''}</span></li>`;
    }).join('');
    const buttons = [
      `<button type="button" class="btn btn-ghost btn-small" data-action="toggle-optional" data-item-id="${topic.id}" data-source-track="${escapeHtml(source)}">${topic.status === 'optional' ? 'Tornar obrigatório' : 'Deixar opcional'}</button>`,
      `<button type="button" class="btn btn-ghost btn-small" data-action="hide-topic" data-item-id="${topic.id}" data-source-track="${escapeHtml(source)}">Ocultar</button>`,
      `<button type="button" class="btn btn-ghost btn-small" data-action="move-topic" data-item-id="${topic.id}" data-phase-id="${phase.id}" data-dir="-1" ${index === 0 ? 'disabled' : ''}>Subir</button>`,
      `<button type="button" class="btn btn-ghost btn-small" data-action="move-topic" data-item-id="${topic.id}" data-phase-id="${phase.id}" data-dir="1" ${index === total - 1 ? 'disabled' : ''}>Descer</button>`,
      topic.custom ? `<button type="button" class="btn btn-ghost btn-small" data-action="edit-topic" data-item-id="${topic.id}">Editar</button>` : '',
      topic.custom ? `<button type="button" class="btn btn-ghost btn-small" data-action="delete-topic" data-item-id="${topic.id}">Excluir</button>` : '',
      (topic.quiz || []).length ? `<button type="button" class="btn btn-ghost btn-small" data-action="open-quiz" data-quiz-scope="topic" data-item-id="${topic.id}">${quizScore(topic.quiz, trackState.quizAnswers).needsReview ? 'Revisar' : 'Quiz'}</button>` : '',
      `<button type="button" class="btn btn-ghost btn-small" data-action="toggle-link-form" data-item-id="${topic.id}">+ Link</button>`,
      `<button type="button" class="btn btn-ghost btn-small" data-action="toggle-note" data-item-id="${topic.id}">${topic.note ? 'Anotações' : 'Anotar'}</button>`,
    ].join('');
    return `<div class="stack">
      <div class="row">${checkbox(topic.done, `data-action="toggle-item" data-item-id="${topic.id}" data-source-track="${escapeHtml(source)}"`, topic.title)}<h3 class="${strike}" style="font:var(--text-title-s)">${escapeHtml(topic.title)}</h3></div>
      <p class="read">${escapeHtml(topic.description)}</p>
      ${resources ? `<ul class="stack">${resources}</ul>` : ''}
      <div class="row">${buttons}</div>
      ${linkOpen ? `<div class="stack"><input id="link-title-${topic.id}" class="field" placeholder="Título" /><input id="link-url-${topic.id}" class="field" placeholder="https://" /><div class="row"><select id="link-lang-${topic.id}" class="field"><option value="pt">PT</option><option value="en">EN</option></select><select id="link-kind-${topic.id}" class="field"><option value="leitura">Leitura</option><option value="documentacao">Documentação</option><option value="curso">Curso</option><option value="pratica">Prática</option><option value="video">Vídeo</option></select><button type="button" class="btn btn-primary btn-small" data-action="add-topic-link" data-item-id="${topic.id}" data-source-track="${escapeHtml(source)}">Salvar link</button></div></div>` : ''}
      ${noteOpen ? `<textarea id="note-${topic.id}" class="field" data-action="edit-note" data-item-id="${topic.id}" data-source-track="${escapeHtml(source)}" rows="3">${escapeHtml(topic.note || '')}</textarea>` : ''}
    </div>`;
  }

  function projectItem(project) {
    const source = project.sourceTrackId || api.activeTrack()?.id || '';
    return `<li class="row" style="align-items:flex-start">${checkbox(project.done, `data-action="toggle-project" data-project-id="${project.id}" data-source-track="${escapeHtml(source)}"`, project.title)}<div><p style="font:var(--text-label-m)">${escapeHtml(project.title)}</p><p class="muted">${escapeHtml(project.description || '')}</p><p class="mono">${LEVEL_LABELS[project.level] || ''} · ${project.hours || 0} h${project.sourceTrackName && session.combinedView ? ` · ${escapeHtml(project.sourceTrackName)}` : ''}</p>${project.custom ? `<button type="button" class="btn btn-ghost btn-small" data-action="edit-project" data-project-id="${project.id}">Editar</button><button type="button" class="btn btn-ghost btn-small" data-action="delete-project" data-project-id="${project.id}">Excluir</button>` : ''}</div></li>`;
  }

  function renderPhase(phase, query, phaseHit, maps, deadlines, nextId) {
    const trackState = api.activeTrackState();
    const collapsed = !!trackState.collapsedPhases[phase.id];
    const topics = visibleTopics(phase, query, phaseHit);
    const projects = visibleProjects(phase.projects, trackState.level, trackState.showAllProjectLevels).filter((project) => {
      if (session.filter === 'hidden' || session.filter === 'optional') return false;
      if (session.filter === 'pending' && project.done) return false;
      if (session.filter === 'completed' && !project.done) return false;
      if (query && !phaseHit && !`${project.title} ${project.description}`.toLowerCase().includes(query)) return false;
      return true;
    });
    if (!topics.length && !projects.length && query) return '';
    const current = currentPhase(api.activeView().phases);
    const due = deadlines.find((item) => item.phaseId === phase.id);
    const hours = phase.topics.filter((topic) => topic.status === 'required').reduce((sum, topic) => sum + (Number(topic.hours) || 0), 0);
    return `<section class="phase reveal${current && current.id === phase.id ? ' is-current' : ''}" id="etapa-${phase.number}">
      <div class="phase-head spread">
        <button type="button" class="row" data-action="toggle-phase" data-phase-id="${phase.id}" aria-expanded="${!collapsed}" style="border:0;background:transparent;text-align:left">
          <span class="dot${phase.progress.complete ? ' is-done' : ''}${current && current.id === phase.id ? ' is-current' : ''}"></span>
          <span><span class="eyebrow">Etapa ${phase.number}</span><span style="display:block;font:var(--text-title-s)">${escapeHtml(phase.title)}</span></span>
        </button>
        <span class="row"><span class="mono">${phase.progress.done}/${phase.progress.total} · ${escapeHtml(formatDuration(hours, trackState.weeklyHours))}${due ? ` · até ${due.end}` : ''}</span>
          <button type="button" class="btn-icon" data-action="phase-menu" data-phase-id="${phase.id}" aria-haspopup="menu" aria-label="Ações da etapa">${icon('more')}</button>
          <button type="button" class="btn-icon" data-action="toggle-phase" data-phase-id="${phase.id}" aria-label="${collapsed ? 'Abrir etapa' : 'Fechar etapa'}">${icon(collapsed ? 'chevronRight' : 'chevronDown')}</button>
        </span>
      </div>
      <div class="bar" style="margin:0 16px 12px"><span style="transform:scaleX(${(phase.progress.percent || 0) / 100})"></span></div>
      ${collapsed ? '' : `<div class="topic-grid is-list">${topics.map((topic, index) => topicNode(topic, maps.titles, maps.done, index, nextId)).join('')}</div>
        <div class="phase-foot"><div class="spread"><p style="font:var(--text-title-s)">Ideia de projeto</p><button type="button" class="btn btn-ghost btn-small" data-action="add-project" data-phase-id="${phase.id}">Adicionar ideia</button></div>
          ${projects.length ? `<ul class="stack" style="margin-top:8px">${projects.map(projectItem).join('')}</ul>` : '<p class="muted">Nada neste nível nesta etapa.</p>'}
          <label class="stack" style="margin-top:8px">Nota da etapa<textarea id="obs-${phase.id}" class="field" data-action="edit-phase-note" data-phase-id="${phase.id}" rows="2">${escapeHtml(phase.note || '')}</textarea></label>
        </div>`}
    </section>`;
  }

  function matches(topic, query) {
    if (!query) return true;
    return `${topic.title} ${topic.description} ${topic.note || ''} ${(topic.tags || []).join(' ')}`.toLowerCase().includes(query);
  }

  function mapsOf(view) {
    const titles = new Map();
    const done = new Set();
    view.phases.forEach((phase) => phase.topics.forEach((topic) => {
      titles.set(topic.id, topic.title);
      if (topic.done) done.add(topic.id);
    }));
    return { titles, done };
  }

  function render() {
    const track = api.activeTrack();
    const trackState = api.activeTrackState();
    const view = api.activeView();
    if (!track || !view) return;
    const stats = roadmapStats(view.phases);
    const projects = projectPlanStats(view.phases, trackState.level);
    const focus = currentPhase(view.phases);
    const names = session.combinedView ? api.activeEntries().map((entry) => entry.track.name).join(' + ') : track.name;
    $('trackTitle').textContent = names;
    $('trackTagline').textContent = session.combinedView ? 'Trajeto único, do mais básico ao que pede prática.' : (track.description || track.tagline || '');
    const stack = !session.combinedView && view.backendStackNames?.length ? `Back-end · ${view.backendStackNames.join(' + ')}` : '';
    $('trackMeta').innerHTML = `<span class="tag">${escapeHtml(track.group === 'carreira' ? 'Carreira' : track.group === 'fundamentos' ? 'Fundamento' : 'Tecnologia')}</span><span class="tag tag-highlight" id="focusTagLive">${stats.percent === 100 ? 'Trilha fechada' : stats.percent === 0 ? 'Começando' : 'No meio'}</span>${stack ? `<span class="tag">${escapeHtml(stack)}</span>` : ''}<span class="tag">${escapeHtml(LEVEL_LABELS[trackState.level] || '')}</span><span class="tag">${trackState.weeklyHours} h/semana</span><button type="button" id="trackSwitchBtn" class="btn btn-ghost btn-small">${icon('chevronDown')} Trocar</button>`;
    $('trackSwitchBtn').addEventListener('click', () => {
      if (window.matchMedia('(max-width: 1023px)').matches) api.openSheet();
      else $('sidebarSearch').focus();
    }, { once: true });
    document.title = `Rumos — ${names}`;
    $('overallPercent').textContent = `${stats.percent}%`;
    $('overallCounter').textContent = `${stats.requiredDone} de ${stats.required} tópicos`;
    $('planEstimate').textContent = stats.hours ? `${formatDuration(stats.hoursLeft, trackState.weeklyHours)} ainda pela frente.` : 'Nada obrigatório neste nível.';
    $('overallStatusTag').textContent = stats.percent === 100 ? 'Fechada' : 'Do plano';
    $('progressRing').innerHTML = api.ring(stats.percent);
    $('currentPhaseName').textContent = focus ? `Etapa ${focus.number}: ${focus.title}` : 'Os obrigatórios desta trilha acabaram.';
    $('currentPhaseSub').textContent = focus ? `${focus.progress.requiredDone}/${focus.progress.requiredTotal} obrigatórios aqui` : 'A prática e os opcionais continuam.';
    $('projectCounter').textContent = `${projects.done}/${projects.total}${projects.hours ? ` · cerca de ${projects.hours} h` : ''}`;
    $('paceLine').textContent = formatDuration(stats.hours, trackState.weeklyHours);
    $('levelLabel').textContent = '';
    $('optionalHint').textContent = stats.optional ? `${stats.optional} ficaram de fora.` : 'Nada abaixo do seu nível ficou de fora.';
    if (document.activeElement !== $('weeklyHoursInput')) $('weeklyHoursInput').value = trackState.weeklyHours;
    $('includeBelowLevel').checked = !!trackState.includeBelowLevel;
    $('allProjectLevels').checked = !!trackState.showAllProjectLevels;
    $('strikethroughToggle').checked = api.getState().strikethrough !== false;
    $('badgesUnlockedCounter').textContent = `${stats.badges} de ${view.phases.length} fechadas`;
    $('badgesContainer').innerHTML = view.phases.map((phase) => `<span class="tag${phase.progress.complete ? ' tag-done' : ''}">${phase.number}</span>`).join('');
    $('footerStats').textContent = `${view.phases.length} etapas · ${stats.required} no plano · ${projects.total} ideias neste nível`;
    const deadlines = phaseDeadlines(view.phases, trackState.weeklyHours, trackState.studyPlan?.startDate || '');
    $('phaseFlowchart').innerHTML = `<div class="spread"><p class="eyebrow">As etapas</p><p class="mono">Clique para ir até a etapa</p></div><div class="flow" style="margin-top:12px">${view.phases.map((phase, index) => {
      const cls = phase.progress.complete ? 'is-done' : (focus && focus.id === phase.id ? 'is-current' : '');
      return `<button type="button" class="flow-step" data-flow-phase="${phase.id}" ${focus && focus.id === phase.id ? 'aria-current="step"' : ''}><span class="dot ${cls}"></span><span class="eyebrow">Etapa ${phase.number}</span><span>${escapeHtml(phase.badgeTitle || phase.title)}</span></button>${index < view.phases.length - 1 ? '<span class="mono" aria-hidden="true">—</span>' : ''}`;
    }).join('')}</div>`;
    const query = session.search.trim().toLowerCase();
    const maps = mapsOf(view);
    const nextId = focus?.topics.find((topic) => topic.status === 'required' && !topic.done)?.id;
    const html = session.viewMode === 'list'
      ? view.phases.map((phase) => renderPhase(phase, query, query && `${phase.title} ${phase.badgeTitle} ${phase.note}`.toLowerCase().includes(query), maps, deadlines, nextId)).join('')
      : renderMap(view, query);
    $('conteudo').innerHTML = html;
    $('phaseFlowchart').hidden = session.viewMode !== 'list';
    $('stageBadges').hidden = session.viewMode !== 'list';
    $('emptyState').hidden = !!html.trim() || !query;
    const focusTag = document.getElementById('focusTag');
    if (focusTag && !session.focusPulsed) { focusTag.classList.add('tag-pulse'); session.focusPulsed = true; }
    watchReveals($('conteudo'));
    if ($('topicDetailDialog').open && session.detailTopicId) paintDetail();
    document.querySelectorAll('.filter-btn').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === session.filter)));
    const allCollapsed = view.phases.every((phase) => trackState.collapsedPhases[phase.id]);
    $('toggleAllPhasesLabel').textContent = allCollapsed ? 'Abrir todas' : 'Recolher todas';
  }

  function paintDetail() {
    const located = api.findTopic(session.detailTopicId, session.detailSourceTrackId);
    if (!located) { $('topicDetailDialog').close(); return; }
    const view = api.activeView();
    const maps = mapsOf(view);
    const phase = view.phases.find((item) => item.topics.some((topic) => topic.id === located.topic.id)) || located.phase;
    const index = phase.topics.findIndex((topic) => topic.id === located.topic.id);
    $('topicDetailEyebrow').textContent = `Etapa ${phase.number} · ${phase.title}`;
    $('topicDetailTitle').textContent = located.topic.title;
    $('topicDetailBody').innerHTML = detail(phase.topics[index] || located.topic, phase, Math.max(0, index), phase.topics.length, maps.titles, maps.done);
  }

  function onClick(event) {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const state = api.getState();
    const trackState = api.activeTrackState();
    const source = el.dataset.sourceTrack;
    const target = (source && state.tracks[source]) || trackState;
    if (action === 'open-topic-detail') {
      session.detailTopicId = el.dataset.itemId;
      session.detailSourceTrackId = source || null;
      paintDetail();
      $('topicDetailDialog').showModal();
      return;
    }
    if (action === 'toggle-phase') {
      const id = el.dataset.phaseId;
      if (trackState.collapsedPhases[id]) delete trackState.collapsedPhases[id];
      else trackState.collapsedPhases[id] = true;
      persist(state.activeTrackId);
      render();
      return;
    }
    if (action === 'phase-menu') {
      const id = el.dataset.phaseId;
      const phase = api.activeView().phases.find((item) => item.id === id);
      openMenu(el, [
        { label: 'Autoavaliação', run: () => api.openQuiz('phase', id) },
        { label: phase?.progress.complete ? 'Desmarcar etapa' : 'Marcar etapa', run: () => togglePhase(id) },
        { label: 'Subir etapa', run: () => movePhase(id, -1) },
        { label: 'Descer etapa', run: () => movePhase(id, 1) },
        { label: 'Nota da etapa', run: () => { delete trackState.collapsedPhases[id]; render(); document.getElementById(`obs-${id}`)?.focus(); } },
        { label: 'Ideia nesta etapa', run: () => api.openProjectDialog(id) },
      ]);
      return;
    }
    if (action === 'toggle-item') return toggleTopic(el.dataset.itemId, source);
    if (action === 'toggle-phase-done') return togglePhase(el.dataset.phaseId);
    if (action === 'toggle-optional' || action === 'hide-topic' || action === 'restore-topic') {
      const located = api.findTopic(el.dataset.itemId, source);
      if (!located) return;
      const bucket = state.tracks[located.topic.sourceTrackId] || trackState;
      if (action === 'hide-topic') setTopicStatus(bucket, located.topic, 'hidden');
      else if (action === 'restore-topic') setTopicStatus(bucket, located.topic, naturalStatus(located.topic, bucket));
      else setTopicStatus(bucket, located.topic, located.topic.status === 'optional' ? 'required' : 'optional');
      persist(located.topic.sourceTrackId || state.activeTrackId);
      render();
      return;
    }
    if (action === 'move-topic') {
      const phase = api.activeView().phases.find((item) => item.id === el.dataset.phaseId);
      trackState.topicOrder[phase.id] = moveId(phase.topics.map((topic) => topic.id), el.dataset.itemId, Number(el.dataset.dir));
      persist(state.activeTrackId);
      render();
      return;
    }
    if (action === 'move-phase') return movePhase(el.dataset.phaseId, Number(el.dataset.dir));
    if (action === 'toggle-note' || action === 'toggle-link-form') {
      const bag = action === 'toggle-note' ? session.openNotes : session.openLinkForms;
      if (bag[el.dataset.itemId]) delete bag[el.dataset.itemId];
      else bag[el.dataset.itemId] = true;
      render();
      return;
    }
    if (action === 'add-topic-link') return addLink(el.dataset.itemId, source);
    if (action === 'remove-topic-link') {
      const id = el.dataset.itemId;
      const bucket = topicBucket(id, source);
      bucket.state.customLinks[id] = (bucket.state.customLinks[id] || []).filter((item) => item.url !== el.dataset.url);
      persist(bucket.id);
      render();
      return;
    }
    if (action === 'toggle-resource') {
      const key = `${el.dataset.itemId}::${el.dataset.url}`;
      const bucket = topicBucket(el.dataset.itemId, el.dataset.sourceTrack || source);
      bucket.state.doneResources = bucket.state.doneResources || {};
      if (bucket.state.doneResources[key]) delete bucket.state.doneResources[key];
      else bucket.state.doneResources[key] = true;
      persist(bucket.id);
      return;
    }
    if (action === 'toggle-project') {
      const id = el.dataset.projectId;
      if (target.completedProjects[id]) delete target.completedProjects[id];
      else target.completedProjects[id] = true;
      persist(source || state.activeTrackId);
      render();
      return;
    }
    if (action === 'add-project') return api.openProjectDialog(el.dataset.phaseId);
    if (action === 'edit-project') {
      const project = trackState.customProjects.find((item) => item.id === el.dataset.projectId);
      if (project) api.openProjectDialog(project.phaseId, project);
      return;
    }
    if (action === 'delete-project') return api.confirmRemove('project', el.dataset.projectId);
    if (action === 'edit-topic') {
      const custom = trackState.customTopics.find((topic) => topic.id === el.dataset.itemId);
      if (custom) api.openTopicDialog(custom);
      return;
    }
    if (action === 'delete-topic') return api.confirmRemove('topic', el.dataset.itemId);
    if (action === 'open-quiz') api.openQuiz(el.dataset.quizScope, el.dataset.quizScope === 'phase' ? el.dataset.phaseId : el.dataset.itemId);
  }

  function toggleTopic(id, source) {
    const located = api.findTopic(id, source);
    if (!located) return;
    const bucket = api.getState().tracks[located.topic.sourceTrackId] || api.activeTrackState();
    if (located.topic.done) delete bucket.completed[located.topic.id];
    else bucket.completed[located.topic.id] = true;
    persist(located.topic.sourceTrackId || api.getState().activeTrackId);
    render();
  }

  function togglePhase(id) {
    const phase = api.activeView().phases.find((item) => item.id === id);
    if (!phase) return;
    const pool = phase.topics.filter((topic) => topic.status === 'required');
    const list = pool.length ? pool : phase.topics.filter((topic) => topic.status !== 'hidden');
    const done = list.every((topic) => topic.done);
    const touched = new Set();
    list.forEach((topic) => {
      const bucket = topicBucket(topic.id, topic.sourceTrackId);
      if (done) delete bucket.state.completed[topic.id];
      else bucket.state.completed[topic.id] = true;
      touched.add(bucket.id);
    });
    touched.forEach((id) => persist(id));
    render();
  }

  function movePhase(id, dir) {
    const trackState = api.activeTrackState();
    const view = api.activeView();
    trackState.phaseOrder = moveId(view.phases.map((phase) => phase.id), id, dir);
    persist(api.getState().activeTrackId);
    render();
  }

  function topicBucket(topicId, source) {
    const located = api.findTopic(topicId, source);
    const id = source || located?.topic?.sourceTrackId || api.getState().activeTrackId;
    return { id, state: api.getState().tracks[id] || api.activeTrackState() };
  }

  function addLink(id, source) {
    const title = document.getElementById(`link-title-${id}`)?.value.trim();
    const url = document.getElementById(`link-url-${id}`)?.value.trim();
    if (!title || !safeUrl(url)) return toast('Título e um link http(s).', 'error');
    const bucket = topicBucket(id, source);
    bucket.state.customLinks = bucket.state.customLinks || {};
    const list = bucket.state.customLinks[id] || [];
    if (list.length >= 6) return toast('Seis links seus por tópico.', 'error');
    list.push({ title: title.slice(0, 180), url, lang: document.getElementById(`link-lang-${id}`)?.value === 'en' ? 'en' : 'pt', kind: document.getElementById(`link-kind-${id}`)?.value || 'leitura' });
    bucket.state.customLinks[id] = list;
    delete session.openLinkForms[id];
    persist(bucket.id);
    render();
  }

  function onInput(event) {
    const el = event.target;
    const trackState = api.activeTrackState();
    if (!trackState) return;
    if (el.dataset.action === 'edit-note') {
      const bucket = topicBucket(el.dataset.itemId, el.dataset.sourceTrack);
      if (el.value.trim()) bucket.state.notes[el.dataset.itemId] = el.value.slice(0, 20000);
      else delete bucket.state.notes[el.dataset.itemId];
      persist(bucket.id);
    }
    if (el.dataset.action === 'edit-phase-note') {
      if (el.value.trim()) trackState.phaseNotes[el.dataset.phaseId] = el.value.slice(0, 20000);
      else delete trackState.phaseNotes[el.dataset.phaseId];
      persist(api.getState().activeTrackId);
    }
  }

  function bind() {
    $('conteudo').addEventListener('click', onClick);
    $('conteudo').addEventListener('input', onInput);
    $('topicDetailBody').addEventListener('click', (event) => { onClick(event); if ($('topicDetailDialog').open) paintDetail(); });
    $('topicDetailBody').addEventListener('input', onInput);
    $('phaseFlowchart').addEventListener('click', (event) => {
      const button = event.target.closest('[data-flow-phase]');
      if (!button) return;
      const trackState = api.activeTrackState();
      delete trackState.collapsedPhases[button.dataset.flowPhase];
      persist(api.getState().activeTrackId);
      render();
      document.getElementById(`etapa-${api.activeView().phases.find((phase) => phase.id === button.dataset.flowPhase)?.number}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    let searchTimer = 0;
    $('searchInput').addEventListener('input', (event) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { session.search = event.target.value; render(); }, 200);
    });
    document.querySelectorAll('.filter-btn').forEach((button) => button.addEventListener('click', () => { session.filter = button.dataset.filter; render(); }));
    $('resetFiltersBtn').addEventListener('click', () => {
      session.search = ''; session.filter = 'all'; session.resourceLang = 'all'; session.resourceKind = 'all';
      $('searchInput').value = '';
      $('resourceLangFilter').value = 'all';
      $('resourceKindFilter').value = 'all';
      render();
    });
    $('weeklyHoursInput').addEventListener('change', (event) => {
      const hours = clampHours(event.target.value);
      if (!hours) return toast('Entre 1 e 60 horas.', 'error');
      const trackState = api.activeTrackState();
      trackState.weeklyHours = hours;
      if (trackState.studyPlan) api.syncPlan(trackState.studyPlan, hours);
      persist(api.getState().activeTrackId);
      render();
    });
    $('includeBelowLevel').addEventListener('change', (event) => { api.activeTrackState().includeBelowLevel = event.target.checked; persist(api.getState().activeTrackId); render(); });
    $('strikethroughToggle').addEventListener('change', (event) => { api.getState().strikethrough = event.target.checked; api.persist(); render(); });
    $('allProjectLevels').addEventListener('change', (event) => { api.activeTrackState().showAllProjectLevels = event.target.checked; persist(api.getState().activeTrackId); render(); });
    $('resourceLangFilter').addEventListener('change', (event) => { session.resourceLang = event.target.value; render(); });
    $('resourceKindFilter').addEventListener('change', (event) => { session.resourceKind = event.target.value; render(); });
    $('viewModeBtn').addEventListener('click', () => { session.viewMode = session.viewMode === 'map' ? 'list' : 'map'; $('viewModeBtn').textContent = session.viewMode === 'map' ? 'Modo: mapa' : 'Modo: lista'; render(); });
    $('toggleAllPhasesBtn').addEventListener('click', () => {
      const trackState = api.activeTrackState();
      const view = api.activeView();
      const all = view.phases.every((phase) => trackState.collapsedPhases[phase.id]);
      trackState.collapsedPhases = {};
      if (!all) view.phases.forEach((phase) => { trackState.collapsedPhases[phase.id] = true; });
      persist(api.getState().activeTrackId);
      render();
    });
    $('filtersBtn').addEventListener('click', () => openMenu($('filtersBtn'), [
      { label: 'Idioma: todos / PT / EN', run: () => { const order = ['all', 'pt', 'en']; const next = order[(order.indexOf(session.resourceLang) + 1) % 3]; session.resourceLang = next; $('resourceLangFilter').value = next; render(); } },
      { label: 'Trocar formato dos links', run: () => { const order = ['all', 'leitura', 'documentacao', 'curso', 'pratica', 'video']; session.resourceKind = order[(order.indexOf(session.resourceKind) + 1) % order.length]; $('resourceKindFilter').value = session.resourceKind; render(); } },
      { label: 'Tachar concluídos', run: () => { $('strikethroughToggle').click(); } },
      { label: 'Prática de outros níveis', run: () => { $('allProjectLevels').click(); } },
    ]));
    $('addTopicBtn').addEventListener('click', () => api.openTopicDialog());
    const highlight = (event) => {
      document.querySelectorAll('.is-prereq').forEach((node) => node.classList.remove('is-prereq'));
      const node = event.target.closest('[data-prereqs]');
      if (!node) return;
      node.dataset.prereqs.split(',').filter(Boolean).forEach((id) => document.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.classList.add('is-prereq'));
    };
    $('conteudo').addEventListener('mouseover', highlight);
    $('conteudo').addEventListener('focusin', highlight);
  }

  return { bind, render, paintDetail };
}
