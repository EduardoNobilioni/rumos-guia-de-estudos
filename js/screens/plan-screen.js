import { parseCsvSchedule, parseIcs } from '../ics.js';
import { newId } from '../model.js';
import {
  WEEKDAY_LABELS, WEEKDAY_SHORT, buildWorkItems, defaultStudyPlan, generateSessions,
  interleaveWorkItems, localISODate, planMarkdown, sessionsToIcs, suggestSlot, summarizeSessions, syncPlanWeeklyHours,
} from '../plan.js';
import { textPdf } from '../files.js';

const field = 'field';

export function initPlanScreen(api) {
  const root = document.getElementById('planScreen');

  function plan() {
    const trackState = api.trackState();
    if (!trackState.studyPlan) trackState.studyPlan = defaultStudyPlan(trackState.weeklyHours || 8);
    return trackState.studyPlan;
  }

  function items(skipDone) {
    const track = api.track();
    const trackState = api.trackState();
    const current = plan();
    const primary = buildWorkItems(api.view(), trackState.level, {
      includeOptional: current.includeOptional,
      includeProjects: current.includeProjects,
      includeReviews: current.includeReviews,
      skipDone,
      quizAnswers: trackState.quizAnswers,
      trackId: track.id,
      trackName: track.name,
    });
    const companions = current.includeCompanions !== false && api.companions ? api.companions() : [];
    if (!companions.length) return primary;
    const lists = companions.map((comp) => buildWorkItems(comp.view, comp.trackState.level || trackState.level, {
      includeOptional: current.includeOptional,
      includeProjects: current.includeProjects,
      includeReviews: current.includeReviews,
      skipDone,
      quizAnswers: comp.trackState.quizAnswers,
      trackId: comp.track.id,
      trackName: comp.track.name,
    }));
    return interleaveWorkItems(primary, lists);
  }

  function downloadAll(sessions) {
    const track = api.track();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    api.download(`rumos-plano-${track.id}.ics`, sessionsToIcs(sessions, `Rumos — ${track.name}`, zone), 'text/calendar');
    const markdown = planMarkdown(track.name, sessions);
    api.download(`rumos-plano-${track.id}.md`, markdown, 'text/markdown');
    api.download(`rumos-plano-${track.id}.pdf`, textPdf(markdown.split('\n')), 'application/pdf');
  }

  function generate(fromDate) {
    const current = plan();
    current.sessions = generateSessions(current, items(true), { fromDate, idFactory: () => newId('sessao') });
    api.persist(api.track().id);
    downloadAll(current.sessions);
    render();
    api.toast(fromDate ? 'Recalculei o que ainda não passou e baixei de novo.' : 'Plano gerado. O arquivo já baixou.');
  }

  function summaryText(current) {
    const summary = summarizeSessions(current.sessions);
    if (!summary.count) return 'Ainda não gerei as sessões. Quando gerar, o .ics, o PDF e o Markdown baixam juntos.';
    const hours = Number.isInteger(summary.hours) ? String(summary.hours) : String(summary.hours).replace('.', ',');
    return `${summary.count} sessões · ${summary.from} a ${summary.to} · ${hours} h`;
  }

  function render() {
    const current = plan();
    const university = current.university;
    const companions = api.companions ? api.companions() : [];
    const busyCount = university.busy.length + university.manual.length;
    const hasSessions = (current.sessions || []).length > 0;
    root.innerHTML = `
      <h1 style="font:var(--text-title-l);letter-spacing:-0.02em">Plano de estudo</h1>
      <p class="muted read" style="margin-top:8px">A aula ocupa a grade. O estudo entra no vão. A lista de cada dia vai no arquivo, não nesta página.</p>
      <section class="card card-pad stack" style="margin-top:16px">
        <h2 style="font:var(--text-title-s)">Quando você estuda</h2>
        <div class="row">
          <label>Começo <input data-plan="start" class="${field}" type="date" value="${current.startDate}" /></label>
          <label>Horas na semana <input data-plan="weekly" class="${field}" type="number" min="1" max="60" value="${current.weeklyHours}" /></label>
          <button type="button" data-plan="apply-hours" class="btn btn-secondary">Encaixar nas janelas</button>
        </div>
        <div class="row">${WEEKDAY_LABELS.map((label, day) => `<label class="chip"><input type="checkbox" data-plan="weekday" value="${day}" ${current.weekdays.includes(day) ? 'checked' : ''} /> ${label}</label>`).join('')}</div>
        <div class="stack">${current.weekdays.map((day) => {
          const slot = current.slots[day] || suggestSlot(current.weeklyHours, current.weekdays.length);
          return `<label class="row">${WEEKDAY_SHORT[day]} <input data-plan="slot-start" data-day="${day}" class="${field}" type="time" value="${slot.start}" /><input data-plan="slot-end" data-day="${day}" class="${field}" type="time" value="${slot.end}" /></label>`;
        }).join('')}</div>
        <div class="row">
          <label class="check"><input data-plan="optional" type="checkbox" ${current.includeOptional ? 'checked' : ''} /> Incluir opcionais</label>
          <label class="check"><input data-plan="projects" type="checkbox" ${current.includeProjects ? 'checked' : ''} /> Incluir projetos</label>
          <label class="check"><input data-plan="reviews" type="checkbox" ${current.includeReviews ? 'checked' : ''} /> Incluir revisão</label>
          <label class="check"><input data-plan="spaced-review" type="checkbox" ${current.spacedReview ? 'checked' : ''} /> Revisão +7 dias</label>
          ${companions.length ? `<label class="check"><input data-plan="companions" type="checkbox" ${current.includeCompanions !== false ? 'checked' : ''} /> Levar ${api.escapeHtml(companions.map((item) => item.track.name).join(', '))}</label>` : ''}
        </div>
        <div class="row">
          <label>Bloco mínimo <select data-plan="min-block" class="${field}">${[20, 30, 45, 60].map((minutes) => `<option value="${minutes}" ${(current.minBlockMinutes || 30) === minutes ? 'selected' : ''}>${minutes} min</option>`).join('')}</select></label>
          <label>Bloco máximo <select data-plan="max-block" class="${field}">${[{ v: 60, l: '60 min' }, { v: 90, l: '90 min' }, { v: 120, l: '120 min' }, { v: 0, l: 'Sem limite' }].map((option) => `<option value="${option.v}" ${(current.maxBlockMinutes ?? 90) === option.v ? 'selected' : ''}>${option.l}</option>`).join('')}</select></label>
        </div>
        <div class="row">
          <button type="button" data-plan="generate" class="btn btn-primary">${hasSessions ? 'Gerar novo plano e baixar' : 'Gerar e baixar'}</button>
          ${hasSessions ? '<button type="button" data-plan="reschedule" class="btn btn-secondary">Recalcular de hoje</button>' : ''}
          ${hasSessions ? '<button type="button" data-plan="again" class="btn btn-ghost">Baixar de novo</button>' : ''}
          <button type="button" data-plan="reset" class="btn btn-ghost">Resetar plano</button>
        </div>
        <p data-plan-summary class="mono">${summaryText(current)}</p>
      </section>
      <section class="card card-pad stack" style="margin-top:16px">
        <h2 style="font:var(--text-title-s)">Grade da faculdade</h2>
        <p class="muted">Importa o .ics ou cola a aula. Ela aparece como ocupada e não entra no arquivo de estudo.</p>
        <div class="row">
          <label class="btn btn-secondary">Importar .ics <input data-plan="ics-file" type="file" accept=".ics,text/calendar" class="sr-only" /></label>
          <button type="button" data-plan="clear-ics" class="btn btn-ghost">Limpar o que veio de arquivo</button>
        </div>
        <div class="row">
          <label>Intervalo antes <input data-plan="buffer-before" class="${field}" type="number" min="0" max="120" value="${university.bufferBefore}" /></label>
          <label>Intervalo depois <input data-plan="buffer-after" class="${field}" type="number" min="0" max="120" value="${university.bufferAfter}" /></label>
          <label>Semana de prova (%) <input data-plan="exam-load" class="${field}" type="number" min="20" max="80" value="${university.examLoadPercent}" /></label>
        </div>
        <div class="row">
          <select data-plan="manual-day" class="${field}">${WEEKDAY_LABELS.map((label, day) => `<option value="${day}">${label}</option>`).join('')}</select>
          <input data-plan="manual-start" class="${field}" type="time" value="08:00" aria-label="Início da aula" />
          <input data-plan="manual-end" class="${field}" type="time" value="10:00" aria-label="Fim da aula" />
          <input data-plan="manual-title" class="${field}" placeholder="Disciplina" aria-label="Disciplina" />
          <button type="button" data-plan="add-manual" class="btn btn-primary">Adicionar aula</button>
        </div>
        <ul>${university.manual.map((row) => `<li class="spread"><span>${WEEKDAY_SHORT[row.weekday]} ${row.start}–${row.end} ${api.escapeHtml(row.title)}</span><button type="button" data-plan="del-manual" data-id="${row.id}">Remover</button></li>`).join('')}</ul>
        <label>Colar CSV <textarea data-plan="csv" class="${field}" rows="3" placeholder="seg,08:00,10:00,Cálculo"></textarea></label>
        <button type="button" data-plan="import-csv" class="btn btn-secondary">Ler CSV</button>
        <div class="row">
          <input data-plan="exam-start" class="${field}" type="date" aria-label="Início da prova" />
          <input data-plan="exam-end" class="${field}" type="date" aria-label="Fim da prova" />
          <input data-plan="exam-label" class="${field}" placeholder="P1" aria-label="Nome da prova" />
          <button type="button" data-plan="add-exam" class="btn btn-secondary">Marcar prova</button>
        </div>
        <ul>${university.examRanges.map((range) => `<li class="spread"><span>${range.start} a ${range.end} · ${api.escapeHtml(range.label)}</span><button type="button" data-plan="del-exam" data-id="${range.id}">Remover</button></li>`).join('')}</ul>
        <p class="mono">${busyCount} blocos de grade neste navegador.</p>
        <label>Pular datas, uma por linha <textarea data-plan="skipped" class="${field}" rows="2">${current.skippedDates.join('\n')}</textarea></label>
      </section>`;
  }

  function save() { api.persist(api.track().id); render(); }

  root.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-plan]');
    if (!target) return;
    const current = plan();
    const action = target.dataset.plan;
    if (action === 'apply-hours') { syncPlanWeeklyHours(current, current.weeklyHours); save(); }
    if (action === 'generate') generate();
    if (action === 'reschedule') generate(localISODate());
    if (action === 'again') downloadAll(current.sessions);
    if (action === 'reset') {
      const hasGenerated = (current.sessions || []).length > 0
        || current.university.busy.length > 0
        || current.university.manual.length > 0
        || current.university.examRanges.length > 0;
      if (hasGenerated && api.askConfirm) {
        const ok = await api.askConfirm({
          title: 'Resetar plano de estudo?',
          body: 'As sessões geradas e a grade cadastrada nesta trilha serão apagadas para você montar um novo plano do zero.',
          confirmLabel: 'Resetar plano',
        });
        if (!ok) return;
      }
      const trackState = api.trackState();
      trackState.studyPlan = defaultStudyPlan(trackState.weeklyHours || 8);
      save();
      api.toast('Plano de estudo resetado. Ajuste os dias e clique em Gerar e baixar.');
    }
    if (action === 'clear-ics') { current.university.busy = current.university.busy.filter((item) => item.source !== 'ics'); save(); }
    if (action === 'add-manual') {
      const title = root.querySelector('[data-plan="manual-title"]').value.trim();
      const start = root.querySelector('[data-plan="manual-start"]').value;
      const end = root.querySelector('[data-plan="manual-end"]').value;
      if (title.length < 2 || !start || !end || end <= start) return api.toast('Disciplina, início e fim.', 'error');
      current.university.manual.push({ id: newId('aula'), weekday: Number(root.querySelector('[data-plan="manual-day"]').value), start, end, title });
      save();
    }
    if (action === 'del-manual') { current.university.manual = current.university.manual.filter((row) => row.id !== target.dataset.id); save(); }
    if (action === 'import-csv') {
      const parsed = parseCsvSchedule(root.querySelector('[data-plan="csv"]').value);
      parsed.manual.forEach((row) => current.university.manual.push({ ...row, id: newId('aula') }));
      current.university.busy.push(...parsed.dated);
      save();
    }
    if (action === 'add-exam') {
      const start = root.querySelector('[data-plan="exam-start"]').value;
      const end = root.querySelector('[data-plan="exam-end"]').value || start;
      if (!start || end < start) return api.toast('Intervalo da prova.', 'error');
      current.university.examRanges.push({ id: newId('prova'), start, end, label: root.querySelector('[data-plan="exam-label"]').value.trim() || 'Provas', percent: Number(current.university.examLoadPercent) || 50 });
      save();
    }
    if (action === 'del-exam') { current.university.examRanges = current.university.examRanges.filter((range) => range.id !== target.dataset.id); save(); }
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    const current = plan();
    if (target.dataset.plan === 'start') current.startDate = target.value || current.startDate;
    if (target.dataset.plan === 'weekly') {
      current.weeklyHours = Math.min(60, Math.max(1, Number(target.value) || current.weeklyHours));
      api.trackState().weeklyHours = current.weeklyHours;
    }
    if (target.dataset.plan === 'weekday') {
      const day = Number(target.value);
      if (target.checked) {
        if (!current.weekdays.includes(day)) current.weekdays.push(day);
        current.weekdays.sort((a, b) => a - b);
        if (!current.slots[day]) current.slots[day] = suggestSlot(current.weeklyHours, current.weekdays.length);
      } else {
        current.weekdays = current.weekdays.filter((item) => item !== day);
        delete current.slots[day];
      }
      render();
    }
    if (target.dataset.plan === 'slot-start' || target.dataset.plan === 'slot-end') {
      const day = Number(target.dataset.day);
      current.slots[day] = current.slots[day] || { start: '19:00', end: '21:00' };
      if (target.dataset.plan === 'slot-start') current.slots[day].start = target.value;
      else current.slots[day].end = target.value;
    }
    if (target.dataset.plan === 'optional') current.includeOptional = target.checked;
    if (target.dataset.plan === 'projects') current.includeProjects = target.checked;
    if (target.dataset.plan === 'reviews') current.includeReviews = target.checked;
    if (target.dataset.plan === 'spaced-review') current.spacedReview = target.checked;
    if (target.dataset.plan === 'companions') current.includeCompanions = target.checked;
    if (target.dataset.plan === 'min-block') current.minBlockMinutes = Number(target.value) || 30;
    if (target.dataset.plan === 'max-block') current.maxBlockMinutes = Number(target.value) || 0;
    if (target.dataset.plan === 'buffer-before') current.university.bufferBefore = Number(target.value) || 0;
    if (target.dataset.plan === 'buffer-after') current.university.bufferAfter = Number(target.value) || 0;
    if (target.dataset.plan === 'exam-load') current.university.examLoadPercent = Number(target.value) || 50;
    if (target.dataset.plan === 'skipped') current.skippedDates = target.value.split(/\s+/).map((item) => item.trim()).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
    if (target.dataset.plan === 'ics-file' && target.files?.[0]) {
      const file = target.files[0];
      target.value = '';
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          const untilDate = new Date();
          untilDate.setFullYear(untilDate.getFullYear() + 1);
          const imported = parseIcs(String(reader.result), { timeZone: zone, from: current.startDate, until: untilDate.toISOString().slice(0, 10) });
          current.university.busy = current.university.busy.filter((item) => item.source !== 'ics').concat(imported);
          api.persist(api.track().id);
          render();
          api.toast(`${imported.length} horários. Eles bloqueiam o estudo e não entram no .ics.`);
        } catch { api.toast('Não li esse .ics.', 'error'); }
      };
      reader.readAsText(file);
      return;
    }
    api.persist(api.track().id);
  });

  return { render, open() { root.hidden = false; render(); } };
}
