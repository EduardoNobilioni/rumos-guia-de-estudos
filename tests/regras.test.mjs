import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyStudySelection,
  buildCombinedRoadmap,
  buildRoadmap,
  companionOptionsForCareer,
  emptyState,
  emptyTrackState,
  ensureTrack,
  fullstackOnboardingSteps,
  MAX_COMPANION_FUNDAMENTALS,
  MAX_COMPANION_TECHNOLOGIES,
  phaseDeadlines,
  roadmapStats,
} from '../js/model.js';
import { suggestSlot, summarizeSessions, syncPlanWeeklyHours } from '../js/plan.js';

const root = dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(readFileSync(join(root, '../data/tracks/index.json'), 'utf8'));

function phase(id, topics, projects = []) {
  return {
    id,
    number: 1,
    title: id,
    badgeTitle: id,
    topics,
    projects,
    quiz: [],
  };
}

function topic(id, title, level, hours, prerequisites = []) {
  return {
    id,
    title,
    description: title,
    level,
    hours,
    tags: [],
    prerequisites,
    resources: [],
  };
}

test('RN tópicos abaixo do nível escolhido entram como opcionais', () => {
  const track = {
    id: 'web',
    name: 'Web',
    group: 'carreira',
    phases: [phase('p1', [
      topic('base', 'HTML', 'iniciante', 4),
      topic('api', 'HTTP', 'avancado', 8),
    ])],
  };
  const state = { ...emptyTrackState(), level: 'avancado', weeklyHours: 8 };
  const view = buildRoadmap(track, state);
  assert.equal(view.phases[0].topics[0].status, 'optional');
  assert.equal(view.phases[0].topics[1].status, 'required');
  assert.equal(roadmapStats(view.phases).hours, 8);
});

test('RN trajeto combinado junta as trilhas e remove tópico compartilhado', () => {
  const career = {
    id: 'carreira',
    name: 'Carreira',
    group: 'carreira',
    phases: [phase('c1', [
      topic('c-git', 'Git essencial', 'iniciante', 3, []),
      topic('c-only', 'Só da carreira', 'iniciante', 4, ['c-git']),
    ])],
  };
  const tech = {
    id: 'tech',
    name: 'Tech',
    group: 'tecnologia',
    phases: [phase('t1', [
      topic('t-git', 'Git essencial', 'iniciante', 3),
      topic('t-only', 'Só da tecnologia', 'iniciante', 5),
    ])],
  };
  const careerState = { ...emptyTrackState(), level: 'iniciante', weeklyHours: 6 };
  const techState = { ...emptyTrackState(), level: 'iniciante', weeklyHours: 6 };
  techState.completed['t-git'] = true;
  const view = buildCombinedRoadmap([
    { track: career, trackState: careerState },
    { track: tech, trackState: techState },
  ]);
  const flat = view.phases.flatMap((item) => item.topics);
  const shared = flat.filter((item) => item.title === 'Git essencial');
  assert.equal(view.combined, true);
  assert.equal(shared.length, 1);
  assert.equal(shared[0].sourceTrackId, 'carreira');
  assert.equal(shared[0].done, true);
  assert.ok(flat.some((item) => item.id === 'c-only'));
  assert.ok(flat.some((item) => item.id === 't-only'));
  const order = flat.map((item) => item.id);
  assert.ok(order.indexOf('c-git') < order.indexOf('c-only'));
});

test('RN prazo da etapa encolhe quando as horas semanais sobem', () => {
  const phases = [phase('p1', [topic('a', 'A', 'iniciante', 40)])];
  phases[0].topics[0].status = 'required';
  const slow = phaseDeadlines(phases, 4, '2026-01-05');
  const fast = phaseDeadlines(phases, 20, '2026-01-05');
  assert.equal(slow.length, 1);
  assert.ok(slow[0].days > fast[0].days);
  assert.ok(fast[0].end < slow[0].end);
});

test('RN refazer o onboarding re-adapta nível e horas e guarda progresso e anotações', () => {
  const state = emptyState();
  const track = ensureTrack(state, 'frontend');
  track.level = 'iniciante';
  track.weeklyHours = 4;
  track.completed['fe-html'] = true;
  track.notes['fe-html'] = 'lembrar semântica';
  track.phaseNotes['fe-fase-1'] = 'rever forms';
  track.overrides['fe-html'] = 'hidden';
  track.studyPlan = {
    startDate: '2026-03-02',
    weekdays: [1, 2, 3, 4, 5],
    slots: { 1: { start: '19:00', end: '20:00' } },
    weeklyHours: 4,
    sessions: [{ id: 'sessao-1', locked: true }],
    university: { manual: [], busy: [] },
  };
  ensureTrack(state, 'python').notes['py-1'] = 'venv';

  applyStudySelection(state, {
    trackId: 'frontend',
    level: 'avancado',
    hours: 12,
    companionIds: ['python', 'frontend'],
    frontendFrameworkId: 'react',
  });

  assert.equal(state.profile.onboarded, true);
  assert.equal(state.profile.primaryTrackId, 'frontend');
  assert.deepEqual(state.profile.companionIds, ['python']);
  assert.equal(state.tracks.frontend.level, 'avancado');
  assert.equal(state.tracks.frontend.weeklyHours, 12);
  assert.equal(state.tracks.frontend.completed['fe-html'], true);
  assert.equal(state.tracks.frontend.notes['fe-html'], 'lembrar semântica');
  assert.equal(state.tracks.frontend.phaseNotes['fe-fase-1'], 'rever forms');
  assert.deepEqual(state.tracks.frontend.overrides, {});
  assert.equal(state.tracks.frontend.studyPlan.weeklyHours, 12);
  assert.equal(state.tracks.frontend.studyPlan.sessions[0].locked, true);
  assert.equal(state.tracks.python.level, 'avancado');
  assert.equal(state.tracks.python.weeklyHours, 12);
  assert.equal(state.tracks.python.notes['py-1'], 'venv');
});

test('RN a grade semanal acompanha as horas escolhidas', () => {
  const plan = {
    weeklyHours: 4,
    weekdays: [1, 3, 5],
    slots: {
      1: { start: '19:00', end: '19:45' },
      3: { start: '19:00', end: '19:45' },
      5: { start: '19:00', end: '19:45' },
    },
    sessions: [],
  };
  syncPlanWeeklyHours(plan, 15);
  const expected = suggestSlot(15, 3);
  assert.equal(plan.weeklyHours, 15);
  assert.deepEqual(plan.slots[1], expected);
  assert.deepEqual(plan.slots[5], expected);
  assert.notEqual(plan.slots[1].end, '19:45');
});

test('RN o resumo do plano não depende da lista de datas na tela', () => {
  const summary = summarizeSessions([
    { date: '2026-03-02', start: '19:00', end: '20:30' },
    { date: '2026-03-04', start: '19:00', end: '20:00' },
    { date: '2026-04-01', start: '19:00', end: '20:00' },
  ]);
  assert.equal(summary.count, 3);
  assert.equal(summary.from, '2026-03-02');
  assert.equal(summary.to, '2026-04-01');
  assert.equal(summary.minutes, 210);
  assert.equal(summary.hours, 3.5);
});

test('RN fundamentos e tecnologias ficam em etapas separadas com sugestões para todas as 23 carreiras', () => {
  const steps = fullstackOnboardingSteps('backend', null, index.tracks);
  assert.deepEqual(steps, ['career', 'fundamentals', 'technologies', 'level', 'hours', 'preview']);

  const careers = index.tracks.filter((track) => track.group === 'carreira');
  assert.equal(careers.length, 23);
  for (const career of careers) {
    const fund = companionOptionsForCareer(career.id, index.tracks, 'fundamentos');
    const tech = companionOptionsForCareer(career.id, index.tracks, 'tecnologia', {
      backendLanguageId: career.id === 'fullstack' ? 'python' : null,
      frontendFrameworkId: career.id === 'frontend' || career.id === 'fullstack' ? 'react' : null,
      careerChoiceId: career.id === 'game-dev' ? 'csharp' : null,
    });
    assert.ok(fund.suggested.length >= 2, `faltou fundamento sugerido para ${career.id}`);
    assert.ok(tech.suggested.length >= 3, `faltou tecnologia sugerida para ${career.id}`);
    if (career.id === 'game-dev') {
      assert.ok(!tech.suggested.some((item) => item.id === 'csharp'));
      assert.ok(!tech.others.some((item) => item.id === 'csharp'));
    }
  }
});

test('RN limita até 2 fundamentos e até 3 tecnologias para evitar roadmaps gigantes', () => {
  assert.equal(MAX_COMPANION_FUNDAMENTALS, 2);
  assert.equal(MAX_COMPANION_TECHNOLOGIES, 3);
  const state = emptyState();
  applyStudySelection(state, {
    trackId: 'backend',
    level: 'iniciante',
    hours: 10,
    catalog: index.tracks,
    companionIds: [
      'banco-de-dados', 'redes-internet', 'algoritmos', 'computacao',
      'python', 'nodejs', 'sql', 'docker', 'git', 'go',
    ],
  });
  assert.deepEqual(
    state.profile.companionIds,
    ['banco-de-dados', 'redes-internet', 'python', 'nodejs', 'sql'],
  );
});
