import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsvSchedule, parseIcs } from '../js/ics.js';
import { buildWorkItems, defaultStudyPlan, findSessionConflicts, generateSessions, interleaveWorkItems, sessionsToIcs } from '../js/plan.js';
import { sanitizeTrackState } from '../js/model.js';

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:aula-calc
DTSTART;TZID=UTC:20260302T080000
DTEND;TZID=UTC:20260302T100000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4
EXDATE;TZID=UTC:20260309T080000
SUMMARY:Cálculo I
END:VEVENT
BEGIN:VEVENT
UID:feriado
DTSTART;VALUE=DATE:20260318
DTEND;VALUE=DATE:20260319
SUMMARY:Feriado
END:VEVENT
END:VCALENDAR`;

test('ics semanal respeita BYDAY, COUNT e EXDATE e marca dia inteiro', () => {
  const busy = parseIcs(ICS, { timeZone: 'UTC', from: '2026-03-01', until: '2026-04-01' });
  const classes = busy.filter((event) => event.title === 'Cálculo I').map((event) => event.start.slice(0, 10));
  assert.deepEqual(classes, ['2026-03-02', '2026-03-04', '2026-03-11']);
  const holiday = busy.find((event) => event.allDay);
  assert.equal(holiday.start.slice(0, 10), '2026-03-18');
});

test('csv aceita dia da semana e data', () => {
  const parsed = parseCsvSchedule('seg,08:00,10:00,Cálculo\n2026-04-02,14:00,16:00,Monitoria\n');
  assert.equal(parsed.manual[0].weekday, 1);
  assert.equal(parsed.manual[0].title, 'Cálculo');
  assert.equal(parsed.dated[0].start, '2026-04-02T14:00');
});

test('o plano não marca estudo em cima da aula e reserva o intervalo', () => {
  const plan = defaultStudyPlan(2);
  plan.startDate = '2026-03-02';
  plan.weekdays = [1];
  plan.slots = { 1: { start: '08:00', end: '12:00' } };
  plan.university.bufferAfter = 30;
  plan.university.busy = parseIcs(ICS, { timeZone: 'UTC', from: '2026-03-01', until: '2026-03-31' })
    .filter((event) => !event.allDay);
  const items = [{
    kind: 'topic', refId: 'topico-a', phaseId: 'fase-1', title: 'HTTP',
    minutes: 120, summary: 'Protocolos', links: [{ title: 'MDN', url: 'https://developer.mozilla.org' }],
  }];
  const sessions = generateSessions(plan, items, { idFactory: sequence() });
  const first = sessions.find((session) => session.date === '2026-03-02');
  assert.ok(first);
  assert.ok(first.start >= '10:30', first.start);
  const ics = sessionsToIcs(sessions, 'Plano');
  assert.match(ics, /BEGIN:VEVENT/);
  assert.equal(ics.includes('Cálculo'), false);
  assert.match(ics, /developer\.mozilla\.org/);
});

test('semana de prova encurta a janela e sessão travada permanece', () => {
  const plan = defaultStudyPlan(2);
  plan.startDate = '2026-03-02';
  plan.weekdays = [1];
  plan.slots = { 1: { start: '19:00', end: '21:00' } };
  plan.university.examRanges = [{ id: 'prova-1', start: '2026-03-02', end: '2026-03-08', label: 'Provas', percent: 50 }];
  plan.sessions = [{
    id: 'sessao-fixa',
    date: '2026-03-09',
    start: '19:00',
    end: '20:00',
    title: 'Revisão travada',
    kind: 'custom',
    refId: '',
    phaseId: '',
    locked: true,
    detail: '',
    summary: '',
    links: [],
  }];
  const items = [{
    kind: 'topic', refId: 'topico-b', phaseId: 'fase-1', title: 'CSS',
    minutes: 180, summary: 'Layout', links: [],
  }];
  const sessions = generateSessions(plan, items, { idFactory: sequence() });
  const examDay = sessions.find((session) => session.date === '2026-03-02' && session.kind === 'topic');
  assert.ok(examDay);
  assert.equal(examDay.end <= '20:00', true);
  assert.ok(sessions.some((session) => session.id === 'sessao-fixa' && session.locked));
});

test('recalcular a partir de hoje guarda o passado e não repete tópico concluído', () => {
  const view = {
    phases: [{
      id: 'fase-1',
      title: 'Base',
      quiz: [{ id: 'q1' }, { id: 'q2' }],
      topics: [
        { id: 'feito', title: 'Feito', description: 'Já estudei', hours: 2, status: 'required', done: true, prerequisites: [], resources: [] },
        { id: 'falta', title: 'Falta', description: 'Ainda não', hours: 1, status: 'required', done: false, prerequisites: ['feito'], resources: [] },
      ],
      projects: [],
    }],
  };
  const items = buildWorkItems(view, 'iniciante', {
    includeOptional: false, includeProjects: false, includeReviews: true, skipDone: true,
  });
  assert.equal(items.some((item) => item.refId === 'feito'), false);
  assert.equal(items[0].refId, 'falta');
  assert.equal(items.some((item) => item.kind === 'review'), true);
  const plan = defaultStudyPlan(2);
  plan.startDate = '2026-03-02';
  plan.sessions = [{
    id: 'sessao-passado', date: '2026-03-02', start: '19:00', end: '20:00',
    title: 'Antiga', kind: 'topic', refId: 'feito', phaseId: 'fase-1', locked: false,
    detail: '', summary: '', links: [],
  }];
  const next = generateSessions(plan, items, { fromDate: '2026-03-04', idFactory: sequence() });
  assert.ok(next.some((session) => session.id === 'sessao-passado'));
  assert.ok(next.some((session) => session.refId === 'falta' && session.date >= '2026-03-04'));
});

test('backup guarda a grade e o plano', () => {
  const state = sanitizeTrackState({
    level: 'iniciante',
    weeklyHours: 8,
    studyPlan: defaultStudyPlan(8),
  });
  state.studyPlan.university.manual.push({ id: 'aula-1', weekday: 2, start: '08:00', end: '10:00', title: 'Física' });
  const again = sanitizeTrackState(state);
  assert.equal(again.studyPlan.university.manual[0].title, 'Física');
  assert.equal(again.studyPlan.weekdays.includes(1), true);
});

test('interleaveWorkItems mistura trilha principal e tecnologias paralelas', () => {
  const primary = [{ refId: 'p1' }, { refId: 'p2' }, { refId: 'p3' }];
  const comp = [{ refId: 'c1' }, { refId: 'c2' }];
  const merged = interleaveWorkItems(primary, [comp]);
  assert.deepEqual(merged.map((x) => x.refId), ['p1', 'p2', 'c1', 'p3', 'c2']);
});

test('findSessionConflicts detecta horário inválido, aula e sobreposição', () => {
  const plan = defaultStudyPlan(4);
  plan.university.manual.push({ id: 'a1', weekday: 1, start: '08:00', end: '10:00', title: 'Cálculo' });
  plan.sessions = [
    { id: 's1', date: '2026-03-02', start: '19:00', end: '20:00', title: 'HTTP' },
  ];
  assert.ok(findSessionConflicts(plan, { id: 's2', date: '2026-03-02', start: '20:00', end: '19:00' }).length > 0);
  assert.match(findSessionConflicts(plan, { id: 's2', date: '2026-03-02', start: '09:00', end: '10:30' })[0], /Cálculo/);
  assert.match(findSessionConflicts(plan, { id: 's2', date: '2026-03-02', start: '19:30', end: '20:30' })[0], /HTTP/);
  assert.equal(findSessionConflicts(plan, { id: 's2', date: '2026-03-02', start: '20:00', end: '21:00' }).length, 0);
});

test('maxBlockMinutes limita duração da sessão e spacedReview agenda revisão +7 dias', () => {
  const plan = defaultStudyPlan(6);
  plan.startDate = '2026-03-02';
  plan.weekdays = [1];
  plan.slots = { 1: { start: '18:00', end: '22:00' } };
  plan.maxBlockMinutes = 60;
  plan.spacedReview = true;
  const items = [{
    kind: 'topic', refId: 't1', phaseId: 'f1', title: 'HTML', minutes: 120, summary: 'Base', links: [],
  }];
  const sessions = generateSessions(plan, items, { idFactory: sequence() });
  const study = sessions.filter((s) => s.kind === 'topic');
  assert.equal(study.length, 2);
  assert.equal(study[0].start, '18:00');
  assert.equal(study[0].end, '19:00');
  const spaced = sessions.find((s) => s.kind === 'review' && s.date >= '2026-03-09');
  assert.ok(spaced);
  const ics = sessionsToIcs(sessions, 'Plano', 'America/Sao_Paulo');
  assert.match(ics, /DTSTART;TZID=America\/Sao_Paulo:/);
});

test('buildWorkItems inclui sessão de reforço para tópicos com erro no quiz', () => {
  const view = {
    phases: [{
      id: 'f1',
      title: 'Base',
      quiz: [{
        id: 'q1',
        reviewTopicId: 't1',
        choices: [
          { id: 'a', correct: true },
          { id: 'b', correct: false },
        ],
      }],
      topics: [
        { id: 't1', title: 'DNS', description: '', hours: 1, status: 'required', done: true, prerequisites: [], resources: [] },
      ],
      projects: [],
    }],
  };
  const items = buildWorkItems(view, 'iniciante', {
    includeOptional: false, includeProjects: false, includeReviews: true, skipDone: true, quizAnswers: { q1: 'b' },
  });
  assert.ok(items.some((i) => i.kind === 'review' && i.refId === 't1' && i.title.includes('Reforço')));
});

function sequence() {
  let n = 0;
  return () => `sessao-${n++}`;
}
