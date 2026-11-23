import { WEEKDAY_SHORT, localISODate, toMinutes } from './plan.js';

export function initDashboardScreen(api) {
  const root = document.getElementById('dashboardScreen');
  const openBtn = document.getElementById('openDashboardBtn');
  if (!root || !openBtn) return;

  function renderRing(done, total, label, sublabel, accent = 'var(--terra)') {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const r = 24;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return `
      <div class="ring-card rounded-xl bg-soft dark:bg-card border border-line/30 p-4 flex items-center gap-3.5">
        <svg width="60" height="60" viewBox="0 0 60 60" class="shrink-0" aria-hidden="true">
          <circle cx="30" cy="30" r="${r}" fill="none" stroke="currentColor" stroke-opacity="0.14" stroke-width="5" />
          <circle cx="30" cy="30" r="${r}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
            transform="rotate(-90 30 30)" />
          <text x="30" y="34" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" class="font-mono">${done}/${total}</text>
        </svg>
        <div class="min-w-0">
          <p class="text-sm font-semibold truncate">${api.escapeHtml(label)}</p>
          <p class="text-xs text-muted font-mono mt-0.5">${pct}% · ${api.escapeHtml(sublabel)}</p>
        </div>
      </div>`;
  }

  function render() {
    const track = api.track();
    const trackState = api.trackState();
    const view = api.view();
    const companions = typeof api.companions === 'function' ? api.companions() : [];

    let reqTotal = 0;
    let reqDone = 0;
    let hoursDone = 0;
    let hoursTotal = 0;
    let projTotal = 0;
    let projDone = 0;
    for (const phase of view.phases) {
      for (const topic of phase.topics) {
        if (topic.status === 'required') {
          reqTotal += 1;
          hoursTotal += Number(topic.hours) || 0;
          if (topic.done) {
            reqDone += 1;
            hoursDone += Number(topic.hours) || 0;
          }
        }
      }
      for (const proj of phase.projects || []) {
        if (proj.level === trackState.level || trackState.showAllProjectLevels) {
          projTotal += 1;
          if (proj.done) projDone += 1;
        }
      }
    }
    const pct = reqTotal ? Math.round((reqDone / reqTotal) * 100) : 0;
    const resourcesDone = Object.keys(trackState.doneResources || {}).length;

    const plan = trackState.studyPlan;
    const weeklyMins = [0, 0, 0, 0, 0, 0, 0];
    if (plan && plan.slots) {
      for (const day of plan.weekdays || []) {
        const slot = plan.slots[day];
        if (!slot) continue;
        const s = toMinutes(slot.start);
        const e = toMinutes(slot.end);
        if (s != null && e != null && e > s) weeklyMins[day] = e - s;
      }
    }
    const maxMin = Math.max(60, ...weeklyMins);
    const today = localISODate();
    const nextSessions = (plan?.sessions || []).filter((s) => s.date >= today).slice(0, 5);

    root.innerHTML = `
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs font-mono uppercase tracking-wider text-terra dark:text-ochre font-semibold">Painel de acompanhamento</p>
            <h1 class="text-2xl sm:text-3xl font-bold mt-1">${api.escapeHtml(track.name)}</h1>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-dash="open-plan" class="px-3.5 py-2 rounded-sm text-sm font-semibold bg-terra dark:bg-ochre text-paper dark:text-night">Plano de estudo</button>
            <button type="button" data-dash="close" class="px-3.5 py-2 rounded-sm text-sm font-medium border border-line dark:border-sage/60 bg-soft dark:bg-card">Voltar ao roadmap</button>
          </div>
        </div>

        <section aria-label="Indicadores principais" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="kpi-card rounded-xl bg-soft dark:bg-card p-5 border border-line/30">
            <span class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-terra/15 text-terra dark:bg-ochre/20 dark:text-ochre font-mono text-sm font-bold">%</span>
            <p class="mt-3 text-xs font-mono text-muted">Progresso geral</p>
            <p class="mt-1 text-2xl font-bold font-mono">${pct}%</p>
            <p class="mt-1 text-xs text-muted">${reqDone} de ${reqTotal} tópicos</p>
          </div>
          <div class="kpi-card rounded-xl bg-soft dark:bg-card p-5 border border-line/30">
            <span class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald/15 text-emerald dark:text-ochre font-mono text-sm font-bold">h</span>
            <p class="mt-3 text-xs font-mono text-muted">Carga concluída</p>
            <p class="mt-1 text-2xl font-bold font-mono">${hoursDone}h</p>
            <p class="mt-1 text-xs text-muted">de ${hoursTotal}h estimadas</p>
          </div>
          <div class="kpi-card rounded-xl bg-soft dark:bg-card p-5 border border-line/30">
            <span class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-terra/15 text-terra dark:bg-ochre/20 dark:text-ochre font-mono text-sm font-bold">P</span>
            <p class="mt-3 text-xs font-mono text-muted">Projetos feitos</p>
            <p class="mt-1 text-2xl font-bold font-mono">${projDone}/${projTotal}</p>
            <p class="mt-1 text-xs text-muted">Nível ${api.escapeHtml(trackState.level || 'iniciante')}</p>
          </div>
          <div class="kpi-card rounded-xl bg-soft dark:bg-card p-5 border border-line/30">
            <span class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald/15 text-emerald dark:text-ochre font-mono text-sm font-bold">↗</span>
            <p class="mt-3 text-xs font-mono text-muted">Materiais vistos</p>
            <p class="mt-1 text-2xl font-bold font-mono">${resourcesDone}</p>
            <p class="mt-1 text-xs text-muted">links marcados na trilha</p>
          </div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section class="lg:col-span-5 rounded-xl bg-soft dark:bg-card p-5 border border-line/30">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-bold">Ritmo semanal planejado</h2>
              <span class="text-xs font-mono text-muted">${trackState.weeklyHours || 10}h/sem</span>
            </div>
            <div class="mt-5 grid grid-cols-7 gap-2 items-end h-36 pt-4">
              ${weeklyMins.map((mins, day) => {
                const hPct = Math.round((mins / maxMin) * 100);
                const hrs = (mins / 60).toFixed(1).replace('.0', '');
                return `
                  <div class="bar-col flex flex-col items-center gap-1.5 h-full justify-end">
                    <span class="text-[10px] font-mono text-muted">${mins ? `${hrs}h` : '–'}</span>
                    <div class="w-full max-w-[28px] rounded-md bg-terra/85 dark:bg-ochre/85 transition-all" style="height:${Math.max(6, hPct)}%;opacity:${mins ? 1 : 0.18}"></div>
                    <span class="text-[11px] font-mono text-muted">${WEEKDAY_SHORT[day]}</span>
                  </div>`;
              }).join('')}
            </div>
          </section>

          <section class="lg:col-span-7 rounded-xl bg-soft dark:bg-card p-5 border border-line/30">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-base font-bold">Próximas sessões</h2>
              <button type="button" data-dash="open-plan" class="text-xs font-semibold text-terra dark:text-ochre underline">Gerenciar plano</button>
            </div>
            ${nextSessions.length
              ? `<ul class="space-y-2">${nextSessions.map((s) => `
                  <li class="session-row flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-line/30 bg-paper dark:bg-night text-sm">
                    <div class="min-w-0">
                      <p class="font-semibold truncate">${api.escapeHtml(s.title)}</p>
                      <p class="text-xs font-mono text-muted">${api.escapeHtml(s.date)} · ${s.start}–${s.end}</p>
                    </div>
                    <span class="text-xs font-mono px-2 py-0.5 rounded-full border border-line/40 shrink-0">${s.kind === 'project' ? 'Projeto' : s.kind === 'review' ? 'Revisão' : 'Tópico'}</span>
                  </li>`).join('')}</ul>`
              : '<p class="text-sm text-muted">Nenhuma sessão futura gerada ainda. Abra o <strong>Plano de estudo</strong> para distribuir suas horas.</p>'}
          </section>
        </div>

        <section class="rounded-xl bg-soft dark:bg-card p-5 border border-line/30">
          <h2 class="text-base font-bold mb-4">Progresso por etapa</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            ${view.phases.map((p) => renderRing(p.progress.done, p.progress.total, `Etapa ${p.number}: ${p.title}`, p.badgeTitle, p.progress.complete ? 'var(--success)' : 'var(--terra)')).join('')}
          </div>
          ${companions.length ? `
            <h3 class="text-sm font-bold mt-6 mb-3">Tecnologias paralelas</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              ${companions.map((c) => {
                const done = c.view.phases.reduce((s, p) => s + p.progress.done, 0);
                const total = c.view.phases.reduce((s, p) => s + p.progress.total, 0);
                return renderRing(done, total, c.track.name, 'Tecnologia junta', 'var(--success)');
              }).join('')}
            </div>` : ''}
        </section>

        <section class="rounded-xl bg-soft dark:bg-card p-5 border border-line/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-base font-bold">Sincronização e backup</h2>
            <p class="text-sm text-muted mt-1">Seu progresso fica salvo localmente neste navegador. Você pode exportar um backup JSON a qualquer momento — a mesma estrutura já está pronta para sincronização com login no futuro.</p>
          </div>
          <button type="button" data-dash="export-json" class="px-4 py-2 rounded-sm text-sm font-semibold border border-terra dark:border-ochre text-terra dark:text-ochre shrink-0">Exportar backup JSON</button>
        </section>
      </div>`;
  }

  root.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-dash]');
    if (!btn) return;
    const action = btn.dataset.dash;
    if (action === 'close') {
      root.hidden = true;
      api.showApp();
    } else if (action === 'open-plan') {
      root.hidden = true;
      document.getElementById('openPlanBtn')?.click();
    } else if (action === 'export-json') {
      api.exportJson();
    }
  });

  openBtn.addEventListener('click', () => {
    api.hideApp();
    root.hidden = false;
    render();
    root.scrollIntoView({ block: 'start' });
  });
}
