import { WEEKDAY_SHORT } from '../plan.js';
import { escapeHtml } from '../ui/dom.js';
import { summarizeSessions } from '../plan.js';

export function initDashboardScreen(api) {
  const root = document.getElementById('dashboardScreen');

  function render() {
    const track = api.track();
    const trackState = api.trackState();
    const view = api.view();
    let required = 0; let done = 0; let hours = 0; let hoursDone = 0; let projects = 0; let projectsDone = 0;
    for (const phase of view.phases) {
      for (const topic of phase.topics) {
        if (topic.status !== 'required') continue;
        required += 1;
        hours += Number(topic.hours) || 0;
        if (topic.done) { done += 1; hoursDone += Number(topic.hours) || 0; }
      }
      for (const project of phase.projects || []) {
        if (project.level !== trackState.level && !trackState.showAllProjectLevels) continue;
        projects += 1;
        if (project.done) projectsDone += 1;
      }
    }
    const summary = summarizeSessions(trackState.studyPlan?.sessions || []);
    const seen = Object.keys(trackState.doneResources || {}).length;
    root.innerHTML = `
      <p class="eyebrow">Painel</p>
      <h1 style="font:var(--text-title-l);letter-spacing:-0.02em;margin-top:8px">${escapeHtml(track.name)}</h1>
      <p class="muted" style="margin-top:8px">O que já andou, sem transformar isso em medalha.</p>
      <div class="stat-grid" style="margin-top:20px">
        <article class="card card-pad"><p class="mono">Do plano</p><p class="kpi-value">${required ? Math.round((done / required) * 100) : 0}%</p><p class="mono">${done} de ${required}</p></article>
        <article class="card card-pad"><p class="mono">Horas feitas</p><p class="kpi-value">${hoursDone} h</p><p class="mono">de ${hours} h</p></article>
        <article class="card card-pad"><p class="mono">Prática</p><p class="kpi-value">${projectsDone}/${projects}</p><p class="mono">${escapeHtml(trackState.level || '')}</p></article>
        <article class="card card-pad"><p class="mono">Links vistos</p><p class="kpi-value">${seen}</p></article>
      </div>
      <section class="card card-pad" style="margin-top:16px">
        <h2 style="font:var(--text-title-s)">Etapas</h2>
        <div class="stack" style="margin-top:12px">${view.phases.map((phase) => `<div><div class="spread"><span>${escapeHtml(phase.title)}</span><span class="mono">${phase.progress.done}/${phase.progress.total}</span></div><div class="bar" style="margin-top:6px"><span style="transform:scaleX(${(phase.progress.percent || 0) / 100})"></span></div></div>`).join('')}</div>
      </section>
      <section class="card card-pad" style="margin-top:16px">
        <h2 style="font:var(--text-title-s)">Plano</h2>
        <p style="margin-top:8px">${summary.count ? `${summary.count} sessões, ${summary.from} a ${summary.to}, ${summary.hours} h no arquivo.` : 'Ainda sem sessões. Gera o plano quando a grade estiver certa.'}</p>
        <p class="mono" style="margin-top:8px">${(trackState.studyPlan?.weekdays || []).map((day) => WEEKDAY_SHORT[day]).join(' · ') || 'Dias ainda não escolhidos.'}</p>
        <button type="button" id="dashPlan" class="btn btn-primary" style="margin-top:12px">Abrir o plano</button>
      </section>`;
    root.querySelector('#dashPlan')?.addEventListener('click', () => api.showScreen('plan'));
  }

  return { render };
}
