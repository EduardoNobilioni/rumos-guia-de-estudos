import { ensureTrack } from '../model.js';
import { availableProjectLanguages, buildProjectCatalog, filterProjects } from '../projects.js';
import { buildProjectGuide } from '../project-guides.js';
import { escapeHtml, icon } from '../ui/dom.js';

const PAGE = 12;

export function initProjectsScreen(api) {
  const screen = document.getElementById('projectsScreen');
  const ui = { level: 'all', languages: [], query: '', onlyPending: false, page: 1, moreLangs: false };
  let timer = 0;
  let built = false;

  function shell() {
    screen.innerHTML = `
      <p class="eyebrow">Prática</p>
      <h1 style="font:var(--text-title-l);letter-spacing:-0.02em;margin-top:8px">Ideias de projeto</h1>
      <p class="muted" style="margin-top:8px">Doze por vez. A busca espera você parar de digitar.</p>
      <div class="card card-pad stack" style="margin-top:16px">
        <div class="row">
          <label class="sr-only" for="projSearch">Buscar projetos</label>
          <input id="projSearch" class="field" type="search" placeholder="Título, tecnologia, trilha" style="flex:1" />
          <label class="check"><input id="projPending" type="checkbox" /> Só pendentes</label>
          <button type="button" id="projClear" class="btn btn-ghost btn-small">Limpar</button>
        </div>
        <div id="projLevels" class="row"></div>
        <div id="projLangs" class="row"></div>
        <p id="projCount" class="mono" role="status"></p>
      </div>
      <div id="projGrid" class="project-grid" style="margin-top:16px"></div>
      <div id="projPager" class="pager" style="margin-top:16px"></div>`;
    screen.querySelector('#projSearch').addEventListener('input', (event) => {
      clearTimeout(timer);
      const value = event.target.value;
      timer = setTimeout(() => { ui.query = value; ui.page = 1; paint(); }, 200);
    });
    screen.querySelector('#projPending').addEventListener('change', (event) => { ui.onlyPending = event.target.checked; ui.page = 1; paint(); });
    screen.querySelector('#projClear').addEventListener('click', () => {
      ui.level = 'all'; ui.languages = []; ui.query = ''; ui.onlyPending = false; ui.page = 1;
      screen.querySelector('#projSearch').value = '';
      screen.querySelector('#projPending').checked = false;
      paint();
    });
    built = true;
  }

  function paint() {
    if (!built) shell();
    const catalog = buildProjectCatalog(api.tracks(), api.state());
    const langs = availableProjectLanguages(catalog);
    const shownLangs = ui.moreLangs ? langs : langs.slice(0, 12);
    const filtered = filterProjects(catalog, ui);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
    ui.page = Math.min(ui.page, pages);
    const slice = filtered.slice((ui.page - 1) * PAGE, ui.page * PAGE);
    const levels = [['all', 'Todos'], ['iniciante', 'Iniciante'], ['intermediario', 'Intermediário'], ['avancado', 'Avançado']];
    screen.querySelector('#projLevels').innerHTML = levels.map(([value, label]) => `<button type="button" class="chip" data-proj-level="${value}" aria-pressed="${ui.level === value}">${label}</button>`).join('');
    screen.querySelector('#projLangs').innerHTML = shownLangs.map(({ name, count }) => `<button type="button" class="chip" data-proj-lang="${escapeHtml(name)}" aria-pressed="${ui.languages.includes(name)}">${escapeHtml(name)} <span class="mono">${count}</span></button>`).join('')
      + (langs.length > 12 ? `<button type="button" class="btn btn-ghost btn-small" id="projMore">${ui.moreLangs ? 'Menos' : `Mais tecnologias +${langs.length - 12}`}</button>` : '');
    const from = filtered.length ? (ui.page - 1) * PAGE + 1 : 0;
    const to = Math.min(ui.page * PAGE, filtered.length);
    screen.querySelector('#projCount').textContent = filtered.length ? `Mostrando ${from}–${to} de ${filtered.length}` : 'Nada com esse filtro.';
    screen.querySelector('#projGrid').innerHTML = slice.map((project) => `
      <article class="card card-pad project-card stack${project.done ? ' is-done' : ''}">
        <div class="spread"><div><p class="mono">${escapeHtml(project.level)} · ${project.hours || 0} h</p><h2 style="font:var(--text-title-s);margin-top:4px${project.done ? ';text-decoration:line-through;opacity:.7' : ''}">${escapeHtml(project.title)}</h2></div>
          <label class="check"><input type="checkbox" data-proj-done="${escapeHtml(project.id)}" data-proj-track-id="${escapeHtml(project.trackId)}" ${project.done ? 'checked' : ''} /> ${project.done ? 'Feito' : 'Marcar'}</label>
        </div>
        <p class="muted">${escapeHtml(project.description || '')}</p>
        <div class="row">${(project.languages || []).map((lang) => `<span class="tag">${escapeHtml(lang)}</span>`).join('')}<button type="button" class="btn btn-ghost btn-small" data-proj-track="${escapeHtml(project.trackId)}">${escapeHtml(project.trackName || '')}</button><button type="button" class="btn btn-secondary btn-small" data-proj-guide="${escapeHtml(project.id)}" data-proj-guide-track="${escapeHtml(project.trackId)}">Como começar</button></div>
        ${(project.steps || []).length ? `<details><summary>Roteiro</summary><ol>${project.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></details>` : ''}
      </article>`).join('') || '<p class="muted">Nenhuma ideia nesse recorte.</p>';
    const pager = screen.querySelector('#projPager');
    if (window.matchMedia('(max-width: 700px)').matches) {
      pager.innerHTML = `<button type="button" data-page="${ui.page - 1}" ${ui.page === 1 ? 'disabled' : ''}>Anterior</button><span>Página ${ui.page} de ${pages}</span><button type="button" data-page="${ui.page + 1}" ${ui.page === pages ? 'disabled' : ''}>Próxima</button>`;
    } else {
      pager.innerHTML = Array.from({ length: pages }, (_, index) => `<button type="button" class="btn btn-small ${index + 1 === ui.page ? 'btn-primary' : 'btn-ghost'}" data-page="${index + 1}" ${index + 1 === ui.page ? 'aria-current="page"' : ''}>${index + 1}</button>`).join('');
    }
  }

  screen.addEventListener('click', async (event) => {
    const level = event.target.closest('[data-proj-level]');
    if (level) { ui.level = level.dataset.projLevel; ui.page = 1; return paint(); }
    const lang = event.target.closest('[data-proj-lang]');
    if (lang) {
      const name = lang.dataset.projLang;
      ui.languages = ui.languages.includes(name) ? ui.languages.filter((item) => item !== name) : [...ui.languages, name];
      ui.page = 1;
      return paint();
    }
    if (event.target.id === 'projMore') { ui.moreLangs = !ui.moreLangs; return paint(); }
    const page = event.target.closest('[data-page]');
    if (page && !page.disabled) { ui.page = Number(page.dataset.page); return paint(); }
    const track = event.target.closest('[data-proj-track]');
    if (track) { await api.switchToTrack(track.dataset.projTrack); api.showScreen('roadmap'); return; }
    const guideBtn = event.target.closest('[data-proj-guide]');
    if (guideBtn) { openGuide(guideBtn.dataset.projGuide, guideBtn.dataset.projGuideTrack); }
  });

  function openGuide(projectId, trackId) {
    const track = (api.tracks() || []).find((item) => item.id === trackId);
    const catalog = buildProjectCatalog(track ? [track] : [], api.state());
    const project = catalog.find((item) => item.id === projectId);
    if (!project || !track) return;
    const guide = buildProjectGuide(project, track, api.state().profile || {});
    const dialog = document.getElementById('projectGuideDialog');
    document.getElementById('projectGuideEyebrow').textContent = guide.handwritten ? 'Como começar · guia curto' : 'Como começar';
    document.getElementById('projectGuideTitle').textContent = project.title;
    const topics = guide.topics.map((topic) => `<li><button type="button" class="btn btn-ghost btn-small" data-guide-topic="${escapeHtml(topic.id)}" data-guide-track="${escapeHtml(guide.place.trackId)}">${escapeHtml(topic.title)}</button></li>`).join('');
    const steps = guide.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
    const pitfalls = guide.pitfalls.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const done = guide.done.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    document.getElementById('projectGuideBody').innerHTML = `
      <p><strong>O que você precisa saber antes</strong></p>
      ${topics ? `<ul class="guide-list">${topics}</ul>` : '<p class="muted">Os tópicos desta etapa, na ordem do roadmap.</p>'}
      <p><strong>Onde isso entra no roadmap</strong></p>
      <p class="muted">${escapeHtml(guide.place.trackName)} · Etapa ${guide.place.phaseNumber}: ${escapeHtml(guide.place.phaseTitle)} · ${escapeHtml(guide.typeLabel)}</p>
      <p><strong>Passo a passo</strong></p>
      <ol class="guide-list">${steps}</ol>
      <p class="muted">${escapeHtml(guide.stack)}</p>
      ${pitfalls ? `<p><strong>Onde costuma quebrar</strong></p><ul class="guide-list">${pitfalls}</ul>` : ''}
      ${done ? `<p><strong>Como saber que terminou</strong></p><ul class="guide-list">${done}</ul>` : ''}
    `;
    if (!dialog.open) dialog.showModal();
  }

  document.getElementById('projectGuideClose').innerHTML = icon('x');
  document.getElementById('projectGuideClose').addEventListener('click', () => document.getElementById('projectGuideDialog').close());
  document.getElementById('projectGuideBody').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-guide-topic]');
    if (!button) return;
    document.getElementById('projectGuideDialog').close();
    await api.switchToTrack(button.dataset.guideTrack);
    api.focusTopic(button.dataset.guideTopic, button.dataset.guideTrack);
  });

  screen.addEventListener('change', (event) => {
    if (!event.target.dataset.projDone) return;
    const bucket = ensureTrack(api.state(), event.target.dataset.projTrackId);
    if (event.target.checked) bucket.completedProjects[event.target.dataset.projDone] = true;
    else delete bucket.completedProjects[event.target.dataset.projDone];
    api.persist(event.target.dataset.projTrackId);
    paint();
  });

  return {
    async open() {
      screen.hidden = false;
      if (!built) shell();
      screen.querySelector('#projGrid').innerHTML = '<div class="skeleton" style="height:120px"></div>';
      await api.ensureAllTracks();
      paint();
    },
  };
}
