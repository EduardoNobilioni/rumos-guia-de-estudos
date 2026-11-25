import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyStudySelection,
  backendEcosystemChoices,
  backendLanguageChoices,
  buildStudyRoadmap,
  layoutStudyMap,
  emptyState,
  emptyTrackState,
  fullstackOnboardingSteps,
  needsBackendLanguageChoice,
  normalizeState,
} from '../js/model.js';

const root = dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(readFileSync(join(root, '../data/tracks/index.json'), 'utf8'));

function topic(id, title, level = 'iniciante', prerequisites = []) {
  return {
    id,
    title,
    description: title,
    level,
    hours: 2,
    tags: [],
    prerequisites,
    resources: [],
  };
}

function phase(id, title, topics) {
  return { id, number: 1, title, badgeTitle: title, topics, projects: [], quiz: [] };
}

function trackState(extra = {}) {
  return { ...emptyTrackState(), level: 'iniciante', weeklyHours: 8, ...extra };
}

test('RN linguagens de back-end são as trilhas que existem, sem uma padrão', () => {
  const choices = backendLanguageChoices(index.tracks);
  assert.deepEqual(choices.map((item) => item.id), ['csharp', 'go', 'java', 'nodejs', 'php', 'python']);
  assert.deepEqual(
    choices.map((item) => item.name),
    choices.map((item) => item.name).slice().sort((a, b) => a.localeCompare(b, 'pt-BR')),
  );
  const withoutGo = index.tracks.filter((item) => item.id !== 'go');
  assert.ok(!backendLanguageChoices(withoutGo).some((item) => item.id === 'go'));
  assert.deepEqual(backendEcosystemChoices(index.tracks, 'python'), []);
  assert.deepEqual(backendEcosystemChoices(index.tracks, 'nodejs'), []);
  assert.deepEqual(backendEcosystemChoices(index.tracks, 'java'), []);
  assert.deepEqual(backendEcosystemChoices(index.tracks, 'php'), []);
  assert.deepEqual(backendEcosystemChoices(index.tracks, 'go'), []);
  assert.deepEqual(backendEcosystemChoices(index.tracks, 'csharp').map((item) => item.id), ['csharp-dotnet']);
  assert.deepEqual(
    fullstackOnboardingSteps('frontend', null, index.tracks),
    ['career', 'framework', 'fundamentals', 'technologies', 'level', 'hours', 'preview'],
  );
  assert.deepEqual(
    fullstackOnboardingSteps('fullstack', null, index.tracks),
    ['career', 'language', 'framework', 'fundamentals', 'technologies', 'level', 'hours', 'preview'],
  );
  assert.deepEqual(
    fullstackOnboardingSteps('fullstack', 'python', index.tracks),
    ['career', 'language', 'framework', 'fundamentals', 'technologies', 'level', 'hours', 'preview'],
  );
  assert.deepEqual(
    fullstackOnboardingSteps('fullstack', 'csharp', index.tracks),
    ['career', 'language', 'ecosystem', 'framework', 'fundamentals', 'technologies', 'level', 'hours', 'preview'],
  );
});

test('RN estado antigo sem escolha continua na trilha Node e pede a linguagem', () => {
  const state = normalizeState({
    version: 2,
    activeTrackId: 'fullstack',
    profile: { onboarded: true, primaryTrackId: 'fullstack', companionIds: [] },
    tracks: {
      fullstack: {
        level: 'iniciante',
        weeklyHours: 8,
        completed: { 'f3-runtime': true },
        notes: { 'f3-runtime': 'streams' },
      },
    },
  });
  assert.equal(state.profile.backendLanguageId, null);
  assert.deepEqual(state.profile.backendEcosystemIds, []);
  assert.equal(state.tracks.fullstack.completed['f3-runtime'], true);
  assert.equal(state.tracks.fullstack.notes['f3-runtime'], 'streams');
  assert.equal(needsBackendLanguageChoice(state, index.tracks), true);

  const fullstack = {
    id: 'fullstack',
    name: 'Full-Stack',
    group: 'carreira',
    phases: [phase('fase-3', 'Desenvolvimento Backend e APIs', [
      topic('f3-runtime', 'Linguagem e Ambiente de Execução', 'intermediario'),
      topic('f3-rest-apis', 'RESTful APIs', 'intermediario', ['f3-runtime']),
    ])],
  };
  const legacy = buildStudyRoadmap([{ track: fullstack, trackState: state.tracks.fullstack }], []);
  const runtime = legacy.phases.flatMap((item) => item.topics).find((item) => item.id === 'f3-runtime');
  assert.equal(runtime.done, true);
  assert.equal(runtime.note, 'streams');
});

test('RN a etapa de back-end troca a linguagem e mantém REST, auth e o progresso', () => {
  const fullstack = {
    id: 'fullstack',
    name: 'Full-Stack',
    group: 'carreira',
    phases: [phase('fase-3', 'Desenvolvimento Backend e APIs', [
      topic('f3-runtime', 'Linguagem e Ambiente de Execução', 'intermediario'),
      topic('f3-frameworks-web', 'Frameworks Web', 'intermediario', ['f3-runtime']),
      topic('f3-rest-apis', 'RESTful APIs', 'intermediario', ['f3-runtime']),
      topic('f3-auth', 'Autenticação', 'intermediario', ['f3-rest-apis']),
    ])],
  };
  const python = {
    id: 'python',
    name: 'Python',
    group: 'tecnologia',
    phases: [phase('py-1', 'Valores', [
      topic('py-tipo', 'Tipo, nome e expressão'),
      topic('py-rest', 'RESTful APIs'),
    ])],
  };
  const fsState = trackState();
  fsState.completed['f3-rest-apis'] = true;
  fsState.notes['f3-rest-apis'] = 'verbos';
  fsState.completed['f3-runtime'] = true;
  fsState.notes['f3-runtime'] = 'streams';
  const pyState = trackState();
  pyState.completed['py-rest'] = true;
  pyState.notes['py-tipo'] = 'int';

  const view = buildStudyRoadmap(
    [{ track: fullstack, trackState: fsState }],
    [{ track: python, trackState: pyState }],
  );
  const host = view.phases.find((item) => item.topics.some((topic) => topic.id === 'f3-rest-apis'));
  const titles = host.topics.map((item) => item.title);
  assert.equal(titles.filter((item) => item === 'RESTful APIs').length, 1);
  assert.ok(!titles.includes('Linguagem e Ambiente de Execução'));
  assert.ok(!titles.includes('Frameworks Web'));
  assert.ok(titles.includes('Autenticação'));
  assert.ok(titles.includes('Tipo, nome e expressão'));
  assert.ok(titles.indexOf('Tipo, nome e expressão') < titles.indexOf('RESTful APIs'));
  const rest = host.topics.find((item) => item.id === 'f3-rest-apis');
  assert.equal(rest.done, true);
  assert.equal(rest.note, 'verbos');
  assert.equal(rest.prerequisites.includes('f3-runtime'), false);
  const tipo = host.topics.find((item) => item.id === 'py-tipo');
  assert.equal(tipo.note, 'int');
  assert.equal(tipo.sourceTrackId, 'python');
  assert.equal(view.backendLanguageName, 'Python');
  assert.equal(fsState.notes['f3-runtime'], 'streams');
  assert.equal(fsState.completed['f3-runtime'], true);
});

test('RN trocar a linguagem no onboarding guarda progresso e anotação', () => {
  const state = emptyState();
  assert.throws(() => applyStudySelection(state, {
    trackId: 'fullstack',
    level: 'iniciante',
    hours: 8,
  }));
  applyStudySelection(state, {
    trackId: 'fullstack',
    level: 'iniciante',
    hours: 8,
    backendLanguageId: 'python',
    frontendFrameworkId: 'react',
    companionIds: [],
  });
  state.tracks.fullstack.completed['f3-rest-apis'] = true;
  state.tracks.fullstack.notes['f3-rest-apis'] = 'verbos';
  state.tracks.python.completed['py-1'] = true;
  state.tracks.python.notes['py-1'] = 'venv';

  applyStudySelection(state, {
    trackId: 'fullstack',
    level: 'intermediario',
    hours: 10,
    backendLanguageId: 'go',
    frontendFrameworkId: 'vuejs',
    backendEcosystemIds: ['csharp-dotnet', 'php'],
    companionIds: ['git', 'nodejs', 'python'],
  });

  assert.equal(state.profile.backendLanguageId, 'go');
  assert.deepEqual(state.profile.backendEcosystemIds, ['csharp-dotnet']);
  assert.deepEqual(state.profile.companionIds, ['git']);
  assert.equal(state.tracks.fullstack.level, 'intermediario');
  assert.equal(state.tracks.fullstack.completed['f3-rest-apis'], true);
  assert.equal(state.tracks.fullstack.notes['f3-rest-apis'], 'verbos');
  assert.equal(state.tracks.python.completed['py-1'], true);
  assert.equal(state.tracks.python.notes['py-1'], 'venv');
  assert.equal(state.tracks.go.weeklyHours, 10);
  assert.equal(needsBackendLanguageChoice(state, index.tracks), false);
});

test('RN o mapa põe o obrigatório na espinha e o opcional na ramificação', () => {
  const phases = [phase('fase-2', 'Desenvolvimento Frontend', [
    topic('html', 'HTML5'),
    { ...topic('extra', 'Atalho'), status: 'optional' },
    topic('css', 'CSS3 — Fundamentos', 'iniciante', ['html']),
  ])];
  phases[0].topics[1].status = 'optional';
  const [stop] = layoutStudyMap(phases);
  assert.deepEqual(stop.spine.map((item) => item.id), ['html', 'css']);
  assert.deepEqual(stop.branches.map((item) => item.id), ['extra']);
});

test('RN a trilha publicada de Full-Stack e de Python entra na etapa de back-end', () => {
  const fullstack = JSON.parse(readFileSync(join(root, '../data/tracks/fullstack.json'), 'utf8'));
  const python = JSON.parse(readFileSync(join(root, '../data/tracks/python.json'), 'utf8'));
  const view = buildStudyRoadmap(
    [{ track: fullstack, trackState: trackState() }],
    [{ track: { ...python, group: 'tecnologia' }, trackState: trackState() }],
  );
  assert.equal(view.phases.length, fullstack.phases.length);
  const titlesOf = (id) => view.phases.find((item) => item.id === id).topics.map((topic) => topic.title);
  assert.ok(titlesOf('fase-1').includes('Como a Internet Funciona'));
  assert.ok(titlesOf('fase-1').includes('Git — Fluxo Local'));
  assert.ok(titlesOf('fase-2').includes('HTML5'));
  assert.ok(titlesOf('fase-2').includes('JavaScript (ES6+) — Base da Linguagem'));
  const backend = titlesOf('fase-3');
  assert.equal(backend.includes('Linguagem e Ambiente de Execução'), false);
  assert.equal(backend.includes('Frameworks Web'), false);
  assert.ok(backend.includes('Tipo, nome e expressão'));
  assert.ok(backend.includes('RESTful APIs'));
  assert.ok(backend.includes('Autenticação'));
  assert.ok(backend.indexOf('Tipo, nome e expressão') < backend.indexOf('RESTful APIs'));
  assert.ok(titlesOf('fase-4').includes('Bancos Relacionais (SQL)'));
  assert.ok(titlesOf('fase-5').includes('Testes Unitários'));
  assert.ok(titlesOf('fase-6').includes('Docker'));
  const map = layoutStudyMap(view.phases);
  const spine = map.flatMap((stop) => stop.spine.map((topic) => topic.title));
  assert.ok(spine.indexOf('HTML5') < spine.indexOf('Tipo, nome e expressão'));
  assert.ok(spine.indexOf('Tipo, nome e expressão') < spine.indexOf('RESTful APIs'));
  assert.ok(spine.indexOf('RESTful APIs') < spine.indexOf('Docker'));
});
