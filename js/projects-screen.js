import {
  availableProjectLanguages,
  buildProjectCatalog,
  filterProjects,
} from './projects.js';
import { ensureTrack } from './model.js';

export function initProjectsScreen(api) {
  const screen = document.getElementById('projectsScreen');
  if (!screen) return;

  const ui = {
    level: 'all',
    languages: [],
    query: '',
    onlyPending: false,
  };

  const closeScreen = () => {
    screen.hidden = true;
    document.getElementById('app').hidden = false;
    api.refresh();
  };

  const openScreen = () => {
    document.getElementById('app').hidden = true;
    const dash = document.getElementById('dashboardScreen');
    if (dash) dash.hidden = true;
    const plan = document.getElementById('planScreen');
    if (plan) plan.hidden = true;
    screen.hidden = false;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function render() {
    const catalog = buildProjectCatalog(api.tracks(), api.state());
    const langs = availableProjectLanguages(catalog);
    const filtered = filterProjects(catalog, ui);
    const esc = api.escapeHtml;
    const levels = [
      ['all', 'Todos os níveis'],
      ['iniciante', api.levelLabels.iniciante || 'Iniciante'],
      ['intermediario', api.levelLabels.intermediario || 'Intermediário'],
      ['avancado', api.levelLabels.avancado || 'Avançado'],
    ];

    const levelButtons = levels.map(([val, label]) => `
      <button type="button" data-proj-level="${val}" aria-pressed="${ui.level === val}"
        class="sidebar-chip text-xs font-medium">${esc(label)}</button>`).join('');

    const langButtons = langs.map(({ name, count }) => {
      const active = ui.languages.includes(name);
      return `<button type="button" data-proj-lang="${esc(name)}" aria-pressed="${active}"
        class="sidebar-chip text-xs">${esc(name)} <span class="font-mono opacity-75">(${count})</span></button>`;
    }).join('');

    const cards = filtered.length
      ? filtered.map((p) => {
        const badges = (p.languages || []).map((l) => (
          `<span class="px-2 py-0.5 rounded-sm bg-terra/10 dark:bg-ochre/15 text-terra dark:text-ochre text-[11px] font-mono">${esc(l)}</span>`
        )).join('');
        const steps = (p.steps || []).length
          ? `<ol class="mt-2 list-decimal pl-5 space-y-1 text-xs text-muted dark:text-blush">${p.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`
          : '';
        const criteria = (p.definitionOfDone || []).length
          ? `<p class="mt-3 text-[11px] font-mono text-muted">Definição de pronto</p><ul class="mt-1 list-disc pl-5 space-y-1 text-xs text-muted dark:text-blush">${p.definitionOfDone.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
          : '';
        return `
          <article class="kpi-card rounded-xl bg-soft dark:bg-card border ${p.done ? 'border-emerald dark:border-emerald-400' : 'border-line/40 dark:border-sage/50'} p-5 flex flex-col gap-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted">
                  <span>${esc(api.levelLabels[p.level] || p.level)}</span>
                  <span>·</span>
                  <span>${Number(p.hours) || 0} h</span>
                  <span>·</span>
                  <button type="button" data-proj-track="${esc(p.trackId)}" class="underline text-terra dark:text-ochre">${esc(p.trackName)}</button>
                </div>
                <h2 class="mt-1 text-base font-bold ${p.done ? 'line-through opacity-75' : ''}">${esc(p.title)}</h2>
              </div>
              <label class="inline-flex items-center gap-1.5 text-xs font-medium shrink-0 px-2.5 py-1 rounded-sm border border-line/60 dark:border-sage/60">
                <input type="checkbox" data-proj-done="${esc(p.id)}" data-proj-track-id="${esc(p.trackId)}" ${p.done ? 'checked' : ''} />
                <span>${p.done ? 'Concluído' : 'Concluir'}</span>
              </label>
            </div>
            <p class="text-sm text-muted dark:text-blush leading-relaxed">${esc(p.description)}</p>
            <div class="flex flex-wrap gap-1.5">${badges}</div>
            ${(steps || criteria) ? `
              <details class="pt-2 border-t border-line/30 dark:border-sage/40">
                <summary class="text-xs font-semibold">Roteiro e definição de pronto</summary>
                ${steps}
                ${criteria}
              </details>` : ''}
          </article>`;
      }).join('')
      : '<div class="col-span-full rounded-xl bg-soft dark:bg-card border border-line/40 dark:border-sage/50 p-8 text-center text-sm text-muted">Nenhum projeto encontrado com os filtros selecionados.</div>';

    const hasFilters = ui.level !== 'all' || ui.languages.length > 0 || ui.query.trim() !== '' || ui.onlyPending;
    screen.innerHTML = `
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p class="text-xs font-mono text-terra dark:text-ochre font-semibold uppercase tracking-wider">Prática e portfólio</p>
            <h1 class="mt-1 text-2xl sm:text-3xl font-bold">Ideias de projeto</h1>
            <p class="mt-1 text-sm text-muted dark:text-blush">Filtre por nível e linguagem para escolher o que construir agora.</p>
          </div>
          <button type="button" data-proj="close" class="px-4 py-2 rounded-sm text-sm font-medium border border-line dark:border-sage/60 bg-soft dark:bg-card self-start">Voltar ao roadmap</button>
        </header>

        <section class="rounded-xl bg-soft dark:bg-card border border-line/40 dark:border-sage/50 p-5 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <div class="flex-1">
              <label class="sr-only" for="projSearch">Buscar projetos</label>
              <input id="projSearch" data-proj="search" type="search" value="${esc(ui.query)}" placeholder="Buscar por título, tecnologia ou trilha" class="w-full rounded-sm border border-line dark:border-sage/60 bg-paper dark:bg-night px-3 py-2 text-sm" />
            </div>
            <label class="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-sm border border-line/60 dark:border-sage/60">
              <input type="checkbox" data-proj="only-pending" ${ui.onlyPending ? 'checked' : ''} />
              <span>Mostrar apenas pendentes</span>
            </label>
            ${hasFilters ? '<button type="button" data-proj="clear" class="px-3 py-2 rounded-sm text-xs font-medium border border-line dark:border-sage/60">Limpar filtros</button>' : ''}
          </div>
          <div>
            <p class="text-xs font-mono text-muted mb-2">Nível</p>
            <div class="flex flex-wrap gap-2">${levelButtons}</div>
          </div>
          <div>
            <p class="text-xs font-mono text-muted mb-2">Linguagens e tecnologias</p>
            <div class="flex flex-wrap gap-1.5">${langButtons}</div>
          </div>
          <p class="text-xs font-mono text-muted" role="status" aria-live="polite">${filtered.length} ${filtered.length === 1 ? 'projeto encontrado' : 'projetos encontrados'}</p>
        </section>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${cards}</div>
      </div>`;
  }

  document.getElementById('openProjectsBtn')?.addEventListener('click', openScreen);

  screen.addEventListener('click', (event) => {
    const close = event.target.closest('[data-proj="close"]');
    if (close) return closeScreen();

    const clear = event.target.closest('[data-proj="clear"]');
    if (clear) {
      ui.level = 'all';
      ui.languages = [];
      ui.query = '';
      ui.onlyPending = false;
      return render();
    }

    const lvlBtn = event.target.closest('[data-proj-level]');
    if (lvlBtn) {
      ui.level = lvlBtn.dataset.projLevel;
      return render();
    }

    const langBtn = event.target.closest('[data-proj-lang]');
    if (langBtn) {
      const lang = langBtn.dataset.projLang;
      ui.languages = ui.languages.includes(lang)
        ? ui.languages.filter((l) => l !== lang)
        : [...ui.languages, lang];
      return render();
    }

    const trackBtn = event.target.closest('[data-proj-track]');
    if (trackBtn) {
      screen.hidden = true;
      document.getElementById('app').hidden = false;
      api.openTrack(trackBtn.dataset.projTrack);
    }
  });

  screen.addEventListener('input', (event) => {
    if (event.target.dataset.proj === 'search') {
      ui.query = event.target.value;
      const start = event.target.selectionStart;
      render();
      const input = document.getElementById('projSearch');
      if (input) {
        input.focus();
        if (typeof start === 'number') input.setSelectionRange(start, start);
      }
    }
  });

  screen.addEventListener('change', (event) => {
    if (event.target.dataset.proj === 'only-pending') {
      ui.onlyPending = event.target.checked;
      return render();
    }
    if (event.target.dataset.projDone) {
      const id = event.target.dataset.projDone;
      const trackId = event.target.dataset.projTrackId;
      const st = api.state();
      const ts = ensureTrack(st, trackId);
      if (event.target.checked) ts.completedProjects[id] = true;
      else delete ts.completedProjects[id];
      api.persist();
      render();
    }
  });
}
