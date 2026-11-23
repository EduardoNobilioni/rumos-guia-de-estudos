import { parseCsvSchedule, parseIcs } from './ics.js';
import { addUtcDays, formatISODate, newId, parseISODate } from './model.js';
import {
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  buildWorkItems,
  defaultStudyPlan,
  findSessionConflicts,
  fromMinutes,
  generateSessions,
  interleaveWorkItems,
  localISODate,
  previewRows,
  sessionsToIcs,
  suggestSlot,
  toMinutes,
} from './plan.js';

const field = 'mt-1 w-full rounded-sm border border-line dark:border-sage/60 bg-soft dark:bg-night px-3 py-2';

export function initPlanScreen(api) {
  const root = document.getElementById('planScreen');
  const openButton = document.getElementById('openPlanBtn');
  if (!root || !openButton) return;

  function plan() {
    const trackState = api.trackState();
    if (!trackState.studyPlan) trackState.studyPlan = defaultStudyPlan(trackState.weeklyHours || 10);
    return trackState.studyPlan;
  }

  function save() {
    api.persist();
    render();
  }

  let previewDays = 35;

  function items(skipDone) {
    const track = api.track();
    const trackState = api.trackState();
    const current = plan();
    const primary = buildWorkItems(api.view(), trackState.level, {
      includeOptional: current.includeOptional,
      includeProjects: current.includeProjects,
      includeReviews: current.includeReviews,
      skipDone,
      trackId: track.id,
      trackName: track.name,
    });
    const companions = current.includeCompanions !== false && typeof api.companions === 'function'
      ? api.companions()
      : [];
    if (!companions.length) return primary;
    const companionLists = companions.map((comp) => buildWorkItems(comp.view, comp.trackState.level || trackState.level, {
      includeOptional: current.includeOptional,
      includeProjects: current.includeProjects,
      includeReviews: current.includeReviews,
      skipDone,
      trackId: comp.track.id,
      trackName: comp.track.name,
    }));
    return interleaveWorkItems(primary, companionLists);
  }

  function generate(fromDate) {
    const current = plan();
    current.sessions = generateSessions(current, items(true), {
      fromDate,
      idFactory: () => newId('sessao'),
    });
    save();
    api.toast(fromDate ? 'Sessões restantes foram redistribuídas.' : 'Plano de estudo gerado.');
  }

  function render() {
    const current = plan();
    const university = current.university;
    const companions = typeof api.companions === 'function' ? api.companions() : [];
    const startRef = parseISODate(current.startDate) || new Date();
    const todayRef = new Date();
    const baseRef = todayRef > startRef ? todayRef : startRef;
    const end = new Date(baseRef.getTime());
    end.setDate(end.getDate() + previewDays);
    const until = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    const rows = previewRows(current, current.startDate, until);
    const sessionCount = current.sessions.length;
    const busyCount = university.busy.length + university.manual.length;
    root.innerHTML = `
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4 no-print">
          <div>
            <h1 class="text-2xl font-semibold">Plano de estudo</h1>
            <p class="read mt-3 text-muted">As aulas ocupam a grade. O estudo entra nos vãos. O arquivo .ics leva só as sessões de estudo.</p>
          </div>
          <button type="button" data-plan="close" class="px-3 py-2 rounded-sm border border-line dark:border-sage/60">Voltar à trilha</button>
        </div>
        <section class="rounded-sm border border-line dark:border-sage/50 bg-soft dark:bg-card p-4 mb-4 no-print">
          <h2 class="font-bold">Quando você estuda</h2>
          <div class="grid sm:grid-cols-3 gap-3 mt-3 text-sm">
            <label>Data de início
              <input data-plan="start" type="date" value="${current.startDate}" class="${field}" />
            </label>
            <label>Horas por semana
              <input data-plan="weekly" type="number" min="1" max="60" value="${current.weeklyHours}" class="${field}" />
            </label>
            <div class="flex items-end">
              <button type="button" data-plan="apply-hours" class="px-3 py-2 rounded-sm bg-soft dark:bg-card">Aplicar horas nas janelas</button>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2 text-sm">
            ${WEEKDAY_LABELS.map((label, day) => `
              <label class="inline-flex items-center gap-2 px-2 py-1 rounded-sm border border-line dark:border-sage/60">
                <input type="checkbox" data-plan="weekday" value="${day}" ${current.weekdays.includes(day) ? 'checked' : ''} />
                ${label}
              </label>`).join('')}
          </div>
          <div class="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
            ${current.weekdays.map((day) => {
              const slot = current.slots[day] || suggestSlot(current.weeklyHours, current.weekdays.length);
              return `<label class="flex items-center gap-2">${WEEKDAY_SHORT[day]}
                <input data-plan="slot-start" data-day="${day}" type="time" value="${slot.start}" class="${field}" />
                <input data-plan="slot-end" data-day="${day}" type="time" value="${slot.end}" class="${field}" />
              </label>`;
            }).join('')}
          </div>
          <div class="mt-3 flex flex-wrap gap-3 text-sm">
            <label class="inline-flex gap-2"><input data-plan="optional" type="checkbox" ${current.includeOptional ? 'checked' : ''} /> Incluir tópicos opcionais</label>
            <label class="inline-flex gap-2"><input data-plan="projects" type="checkbox" ${current.includeProjects ? 'checked' : ''} /> Incluir projetos</label>
            <label class="inline-flex gap-2"><input data-plan="reviews" type="checkbox" ${current.includeReviews ? 'checked' : ''} /> Incluir sessões de revisão</label>
            <label class="inline-flex gap-2"><input data-plan="spaced-review" type="checkbox" ${current.spacedReview ? 'checked' : ''} /> Revisão espaçada (+7 dias)</label>
            ${companions.length ? `<label class="inline-flex gap-2"><input data-plan="companions" type="checkbox" ${current.includeCompanions !== false ? 'checked' : ''} /> Incluir tecnologias paralelas (${api.escapeHtml(companions.map((c) => c.track.name).join(', '))})</label>` : ''}
          </div>
          <div class="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
            <label>Bloco mínimo por sessão
              <select data-plan="min-block" class="${field}">
                ${[20, 30, 45, 60].map((m) => `<option value="${m}" ${(current.minBlockMinutes || 30) === m ? 'selected' : ''}>${m} min</option>`).join('')}
              </select>
            </label>
            <label>Bloco máximo por sessão
              <select data-plan="max-block" class="${field}">
                ${[{ v: 60, l: '60 min' }, { v: 90, l: '90 min' }, { v: 120, l: '120 min' }, { v: 0, l: 'Sem limite' }].map((opt) => `<option value="${opt.v}" ${(current.maxBlockMinutes ?? 90) === opt.v ? 'selected' : ''}>${opt.l}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" data-plan="generate" class="px-3 py-2 rounded-sm bg-terra dark:bg-ochre text-paper dark:text-night text-sm font-semibold">Gerar plano</button>
            <button type="button" data-plan="reschedule" class="px-3 py-2 rounded-sm border border-line dark:border-sage/60 text-sm">Recalcular a partir de hoje</button>
            <button type="button" data-plan="ics" class="px-3 py-2 rounded-sm border border-line dark:border-sage/60 text-sm">Baixar .ics</button>
            <button type="button" data-plan="pdf" class="px-3 py-2 rounded-sm border border-line dark:border-sage/60 text-sm">PDF do plano</button>
            <button type="button" data-plan="print" class="px-3 py-2 rounded-sm border border-line dark:border-sage/60 text-sm">Imprimir</button>
          </div>
        </section>
        <section class="rounded-sm border border-ochre bg-soft p-4 mb-4 no-print">
          <h2 class="font-bold">Grade da faculdade</h2>
          <p class="read text-muted dark:text-blush mt-3">Importe o .ics do Google Agenda, Outlook, Apple Calendar ou do sistema da universidade. Esses eventos aparecem como ocupados e não vão no .ics do plano.</p>
          <div class="mt-3 flex flex-wrap gap-2 text-sm">
            <label class="px-3 py-2 rounded-sm border border-line dark:border-sage/60 cursor-pointer">Importar .ics
              <input data-plan="ics-file" type="file" accept=".ics,text/calendar" class="sr-only" />
            </label>
            <button type="button" data-plan="clear-ics" class="px-3 py-2 rounded-sm border border-line dark:border-sage/60">Limpar eventos importados</button>
          </div>
          <div class="grid sm:grid-cols-3 gap-3 mt-3 text-sm">
            <label>Intervalo antes (min)
              <input data-plan="buffer-before" type="number" min="0" max="120" value="${university.bufferBefore}" class="${field}" />
            </label>
            <label>Intervalo depois (min)
              <input data-plan="buffer-after" type="number" min="0" max="120" value="${university.bufferAfter}" class="${field}" />
            </label>
            <label>Carga em semana de prova (%)
              <input data-plan="exam-load" type="number" min="20" max="80" value="${university.examLoadPercent}" class="${field}" />
            </label>
          </div>
          <h3 class="mt-4 font-semibold text-sm">Horário manual semanal</h3>
          <div class="mt-2 grid sm:grid-cols-5 gap-2 text-sm">
            <label class="sr-only" for="manualDay">Dia da aula</label>
            <select id="manualDay" data-plan="manual-day" class="${field}">${WEEKDAY_LABELS.map((label, day) => `<option value="${day}">${label}</option>`).join('')}</select>
            <label class="sr-only" for="manualStart">Início da aula</label>
            <input id="manualStart" data-plan="manual-start" type="time" value="08:00" class="${field}" />
            <label class="sr-only" for="manualEnd">Fim da aula</label>
            <input id="manualEnd" data-plan="manual-end" type="time" value="10:00" class="${field}" />
            <label class="sr-only" for="manualTitle">Nome da disciplina</label>
            <input id="manualTitle" data-plan="manual-title" placeholder="Disciplina" class="${field}" />
            <button type="button" data-plan="add-manual" class="px-3 py-2 rounded-sm bg-soft dark:bg-card">Adicionar</button>
          </div>
          <ul class="mt-2 text-sm">
            ${university.manual.map((row) => `<li class="flex justify-between gap-2 py-1"><span>${WEEKDAY_SHORT[row.weekday]} ${row.start}–${row.end} ${api.escapeHtml(row.title)}</span><button type="button" data-plan="del-manual" data-id="${row.id}" class="text-terra">Remover</button></li>`).join('')}
          </ul>
          <h3 class="mt-4 font-semibold text-sm">Colar CSV</h3>
          <p class="text-xs text-muted">Use <code>seg,08:00,10:00,Cálculo</code> ou <code>2026-11-20,14:00,16:00,Monitoria</code>.</p>
          <textarea data-plan="csv" rows="3" class="${field}" placeholder="seg,08:00,10:00,Cálculo"></textarea>
          <button type="button" data-plan="import-csv" class="mt-2 px-3 py-2 rounded-sm border border-line dark:border-sage/60 text-sm">Importar CSV</button>
          <h3 class="mt-4 font-semibold text-sm">Semana de prova</h3>
          <div class="mt-2 flex flex-wrap gap-2 text-sm">
            <label class="sr-only" for="examStart">Início da semana de prova</label>
            <input id="examStart" data-plan="exam-start" type="date" class="${field}" />
            <label class="sr-only" for="examEnd">Fim da semana de prova</label>
            <input id="examEnd" data-plan="exam-end" type="date" class="${field}" />
            <label class="sr-only" for="examLabel">Nome da semana de prova</label>
            <input id="examLabel" data-plan="exam-label" placeholder="P1, finais..." class="${field}" />
            <button type="button" data-plan="add-exam" class="px-3 py-2 rounded-sm bg-soft dark:bg-card">Marcar</button>
          </div>
          <ul class="mt-2 text-sm">
            ${university.examRanges.map((range) => `<li class="flex justify-between gap-2 py-1"><span>${range.start} a ${range.end} · ${api.escapeHtml(range.label)} · ${range.percent}%</span><button type="button" data-plan="del-exam" data-id="${range.id}" class="text-terra">Remover</button></li>`).join('')}
          </ul>
          <p class="mt-3 text-xs text-muted">${busyCount} blocos de grade guardados neste navegador. ${university.busy.length} vieram de arquivo.</p>
          <label class="block mt-3 text-sm">Pular datas (feriado ou prova, uma por linha)
            <textarea data-plan="skipped" rows="2" class="${field}">${current.skippedDates.join('\n')}</textarea>
          </label>
        </section>
        <p class="text-sm mb-3">${sessionCount} sessões de estudo neste plano.</p>
        <div id="planWeeks" class="space-y-4">
          ${rows.map((row) => `
            <section class="rounded-sm border border-line dark:border-sage/50 bg-soft dark:bg-card p-4">
              <h2 class="font-bold">${WEEKDAY_LABELS[row.weekday]} ${api.escapeHtml(row.date)}${row.exam ? ' · semana de prova' : ''}</h2>
              <ul class="mt-2 space-y-2">
                ${row.busy.map((block) => `
                  <li class="busy-block rounded-sm px-3 py-2 text-sm">
                    <span class="font-mono">${block.allDay ? 'Dia inteiro' : `${block.startLabel}–${block.endLabel}`}</span>
                    <span class="ml-2">Ocupado · ${api.escapeHtml(block.title)}</span>
                  </li>`).join('')}
                ${row.sessions.map((session) => {
                  const conflicts = findSessionConflicts(current, session);
                  const canComplete = (session.kind === 'topic' || session.kind === 'project') && session.refId && typeof api.isDone === 'function';
                  const done = canComplete ? api.isDone(session.kind, session.refId, session.trackId) : false;
                  return `
                  <li class="study-block rounded-sm px-3 py-2 text-sm ${conflicts.length ? 'border-terra' : ''}">
                    <div class="flex flex-wrap gap-2 items-center">
                      <input aria-label="Data de ${api.escapeHtml(session.title)}" data-plan="edit-date" data-id="${session.id}" type="date" value="${session.date}" class="rounded-sm border border-line dark:border-sage/60 bg-transparent px-2 py-1" />
                      <input aria-label="Início de ${api.escapeHtml(session.title)}" data-plan="edit-start" data-id="${session.id}" type="time" value="${session.start}" class="rounded-sm border border-line dark:border-sage/60 bg-transparent px-2 py-1" />
                      <input aria-label="Fim de ${api.escapeHtml(session.title)}" data-plan="edit-end" data-id="${session.id}" type="time" value="${session.end}" class="rounded-sm border border-line dark:border-sage/60 bg-transparent px-2 py-1" />
                      <input aria-label="Nome da sessão" data-plan="edit-title" data-id="${session.id}" value="${api.escapeHtml(session.title)}" class="w-full sm:flex-1 sm:min-w-0 rounded-sm border border-line dark:border-sage/60 bg-transparent px-2 py-1 ${done ? 'line-through opacity-75' : ''}" />
                      ${canComplete ? `<button type="button" data-plan="complete-ref" data-id="${session.id}" aria-pressed="${done}" class="px-2 py-1 rounded-sm border ${done ? 'border-terra dark:border-ochre text-terra dark:text-ochre font-semibold' : 'border-line'}">${done ? 'Concluído' : 'Concluir'}</button>` : ''}
                      <button type="button" data-plan="shift-day" data-dir="-1" data-id="${session.id}" class="px-2 py-1 rounded-sm border border-line">Dia anterior</button>
                      <button type="button" data-plan="shift-day" data-dir="1" data-id="${session.id}" class="px-2 py-1 rounded-sm border border-line">Dia seguinte</button>
                      <button type="button" data-plan="resize" data-dir="-15" data-id="${session.id}" class="px-2 py-1 rounded-sm border border-line">−15 min</button>
                      <button type="button" data-plan="resize" data-dir="15" data-id="${session.id}" class="px-2 py-1 rounded-sm border border-line">+15 min</button>
                      <button type="button" data-plan="lock" data-id="${session.id}" aria-pressed="${session.locked}" class="px-2 py-1 rounded-sm border ${session.locked ? 'border-terra dark:border-ochre text-terra dark:text-ochre' : 'border-line'}">${session.locked ? 'Travada' : 'Travar'}</button>
                      <button type="button" data-plan="delete" data-id="${session.id}" class="px-2 py-1 rounded-sm text-terra dark:text-warn">Apagar</button>
                    </div>
                    <p class="mt-1 text-xs text-muted">${labelKind(session.kind)}${session.trackName ? ` · ${api.escapeHtml(session.trackName)}` : ''}${session.summary ? ` · ${api.escapeHtml(session.summary)}` : ''}</p>
                    ${conflicts.length ? `<p class="mt-1 text-xs text-terra font-semibold">${conflicts.map((c) => api.escapeHtml(c)).join(' · ')}</p>` : ''}
                    ${renderSessionLinks(session.links, api.escapeHtml)}
                  </li>`;
                }).join('')}
              </ul>
            </section>`).join('') || '<p class="read text-muted">Gere o plano para ver as semanas.</p>'}
        </div>
        <section class="mt-6" aria-label="Lista de todas as sessões">
          <h2 class="font-bold">Lista de sessões</h2>
          <ol class="mt-2 space-y-1 text-sm">
            ${current.sessions.map((session) => `<li>${api.escapeHtml(session.date)} ${session.start}–${session.end} · ${api.escapeHtml(session.title)} · ${labelKind(session.kind)}</li>`).join('') || '<li>Nenhuma sessão gerada.</li>'}
          </ol>
        </section>
        <div class="mt-4 flex flex-wrap gap-2 no-print">
          <button type="button" data-plan="more-days" class="px-3 py-2 rounded-sm border border-line dark:border-sage/60 text-sm">Ver mais 35 dias</button>
          <button type="button" data-plan="add" class="px-3 py-2 rounded-sm border border-terra/70 dark:border-ochre/70 text-terra dark:text-ochre text-sm">Adicionar sessão</button>
        </div>
      </div>`;
  }

  function sessionById(id) {
    return plan().sessions.find((session) => session.id === id);
  }

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-plan]');
    if (!target) return;
    const action = target.dataset.plan;
    const current = plan();
    if (action === 'close') {
      root.hidden = true;
      api.showApp();
    }
    if (action === 'apply-hours') {
      const slot = suggestSlot(current.weeklyHours, current.weekdays.length);
      current.weekdays.forEach((day) => { current.slots[day] = { ...slot }; });
      save();
    }
    if (action === 'generate') generate();
    if (action === 'reschedule') generate(localISODate());
    if (action === 'ics') {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      api.download(`rumo-plano-${api.track().id}.ics`, sessionsToIcs(current.sessions, `Rumo — ${api.track().name}`, zone), 'text/calendar');
    }
    if (action === 'pdf') api.downloadPdf(current.sessions);
    if (action === 'print') {
      document.body.classList.add('printing-plan');
      window.print();
      document.body.classList.remove('printing-plan');
    }
    if (action === 'clear-ics') {
      current.university.busy = current.university.busy.filter((event) => event.source !== 'ics');
      save();
      api.toast('Eventos do .ics removidos. O horário manual continua.');
    }
    if (action === 'add-manual') {
      const title = root.querySelector('[data-plan="manual-title"]').value.trim();
      const start = root.querySelector('[data-plan="manual-start"]').value;
      const end = root.querySelector('[data-plan="manual-end"]').value;
      if (title.length < 2 || !start || !end || end <= start) {
        api.toast('Preencha disciplina, início e fim.', 'error');
        return;
      }
      current.university.manual.push({
        id: newId('aula'),
        weekday: Number(root.querySelector('[data-plan="manual-day"]').value),
        start,
        end,
        title,
      });
      save();
    }
    if (action === 'del-manual') {
      current.university.manual = current.university.manual.filter((row) => row.id !== target.dataset.id);
      save();
    }
    if (action === 'import-csv') {
      const parsed = parseCsvSchedule(root.querySelector('[data-plan="csv"]').value);
      parsed.manual.forEach((row) => current.university.manual.push({ ...row, id: newId('aula') }));
      current.university.busy.push(...parsed.dated);
      save();
      api.toast(`${parsed.manual.length + parsed.dated.length} horários lidos do CSV.`);
    }
    if (action === 'add-exam') {
      const start = root.querySelector('[data-plan="exam-start"]').value;
      const end = root.querySelector('[data-plan="exam-end"]').value || start;
      if (!start || end < start) {
        api.toast('Informe o intervalo da semana de prova.', 'error');
        return;
      }
      current.university.examRanges.push({
        id: newId('prova'),
        start,
        end,
        label: root.querySelector('[data-plan="exam-label"]').value.trim() || 'Provas',
        percent: Number(current.university.examLoadPercent) || 50,
      });
      save();
    }
    if (action === 'del-exam') {
      current.university.examRanges = current.university.examRanges.filter((range) => range.id !== target.dataset.id);
      save();
    }
    if (action === 'complete-ref') {
      const session = sessionById(target.dataset.id);
      if (session && session.refId && typeof api.toggleDone === 'function') {
        api.toggleDone(session.kind, session.refId, session.trackId);
        render();
      }
      return;
    }
    if (action === 'more-days') {
      previewDays += 35;
      render();
      return;
    }
    if (action === 'shift-day') {
      const session = sessionById(target.dataset.id);
      const next = addUtcDays(parseISODate(session.date), Number(target.dataset.dir));
      session.date = formatISODate(next);
      session.locked = true;
      const conflicts = findSessionConflicts(current, session);
      if (conflicts.length) api.toast(conflicts[0], 'error');
      save();
      return;
    }
    if (action === 'resize') {
      const session = sessionById(target.dataset.id);
      const start = toMinutes(session.start);
      let end = toMinutes(session.end) + Number(target.dataset.dir);
      if (end - start < 20) end = start + 20;
      if (end > 23 * 60 + 45) end = 23 * 60 + 45;
      session.end = fromMinutes(end);
      session.locked = true;
      const conflicts = findSessionConflicts(current, session);
      if (conflicts.length) api.toast(conflicts[0], 'error');
      save();
      return;
    }
    if (action === 'lock') {
      const session = sessionById(target.dataset.id);
      if (session) session.locked = !session.locked;
      save();
    }
    if (action === 'delete') {
      current.sessions = current.sessions.filter((session) => session.id !== target.dataset.id);
      save();
    }
    if (action === 'add') {
      current.sessions.push({
        id: newId('sessao'),
        date: current.startDate,
        start: '19:00',
        end: '20:00',
        title: 'Sessão extra',
        kind: 'custom',
        refId: '',
        phaseId: '',
        locked: true,
        detail: '',
        summary: '',
        links: [],
      });
      save();
    }
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    const current = plan();
    if (target.dataset.plan === 'start') current.startDate = target.value || current.startDate;
    if (target.dataset.plan === 'weekly') current.weeklyHours = Math.min(60, Math.max(1, Number(target.value) || current.weeklyHours));
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
    if (target.dataset.plan === 'skipped') {
      current.skippedDates = target.value.split(/\s+/).map((item) => item.trim()).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
    }
    if (target.dataset.plan === 'ics-file' && target.files?.[0]) {
      const file = target.files[0];
      target.value = '';
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          const from = current.startDate;
          const untilDate = new Date();
          untilDate.setFullYear(untilDate.getFullYear() + 1);
          const until = untilDate.toISOString().slice(0, 10);
          const imported = parseIcs(String(reader.result), { timeZone: zone, from, until });
          current.university.busy = current.university.busy.filter((event) => event.source !== 'ics').concat(imported);
          api.persist();
          render();
          api.toast(`${imported.length} horários importados. Eles bloqueiam o estudo e não entram no .ics.`);
        } catch (error) {
          api.toast('Não consegui ler esse .ics.', 'error');
        }
      };
      reader.readAsText(file);
      return;
    }
    const session = target.dataset.id ? sessionById(target.dataset.id) : null;
    if (session && target.dataset.plan === 'edit-date') {
      session.date = target.value || session.date;
      session.locked = true;
    }
    if (session && target.dataset.plan === 'edit-start') {
      session.start = target.value || session.start;
      session.locked = true;
    }
    if (session && target.dataset.plan === 'edit-end') {
      session.end = target.value || session.end;
      session.locked = true;
    }
    if (session && target.dataset.plan === 'edit-title') session.title = target.value.slice(0, 140) || session.title;
    api.persist();
    if (session && ['edit-date', 'edit-start', 'edit-end'].includes(target.dataset.plan)) {
      const conflicts = findSessionConflicts(current, session);
      if (conflicts.length) api.toast(conflicts[0], 'error');
      render();
      return;
    }
    if (['weekday', 'start', 'slot-start', 'slot-end'].includes(target.dataset.plan)) render();
  });

  openButton.addEventListener('click', () => {
    api.hideApp();
    root.hidden = false;
    plan();
    render();
    api.persist();
    root.scrollIntoView({ block: 'start' });
  });
}

function labelKind(kind) {
  if (kind === 'project') return 'Projeto';
  if (kind === 'review') return 'Revisão da autoavaliação';
  if (kind === 'custom') return 'Sessão sua';
  return 'Estudo do tópico';
}

function renderSessionLinks(links, escapeHtml) {
  const valid = (links || []).filter((link) => link && /^https?:\/\//i.test(link.url || ''));
  if (!valid.length) return '';
  return `<ul class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">${valid.map((link) => `<li><a class="underline decoration-terra underline-offset-2" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title || link.url)}</a></li>`).join('')}</ul>`;
}
