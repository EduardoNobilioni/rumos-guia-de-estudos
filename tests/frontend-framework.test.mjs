import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyStudySelection,
  buildStudyRoadmap,
  emptyState,
  emptyTrackState,
  frontendFrameworkChoices,
  fullstackOnboardingSteps,
  needsFrontendFrameworkChoice,
  normalizeState,
} from '../js/model.js';

const root = dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(readFileSync(join(root, '../data/tracks/index.json'), 'utf8'));

function stateOf(level = 'iniciante') {
  return { ...emptyTrackState(), level, weeklyHours: 8 };
}

test('RN frameworks de front-end são só as trilhas que existem, sem padrão', () => {
  const choices = frontendFrameworkChoices(index.tracks);
  assert.deepEqual(choices.map((item) => item.id), ['angular', 'react', 'vuejs']);
  assert.equal(choices.some((item) => item.id === 'svelte'), false);
  assert.ok(fullstackOnboardingSteps('backend', null, index.tracks).includes('framework') === false);
  assert.ok(fullstackOnboardingSteps('frontend', null, index.tracks).includes('framework'));
  assert.ok(fullstackOnboardingSteps('fullstack', 'python', index.tracks).indexOf('language')
    < fullstackOnboardingSteps('fullstack', 'python', index.tracks).indexOf('framework'));
});

test('RN estado antigo sem framework continua em React e pede a escolha', () => {
  const state = normalizeState({
    version: 2,
    activeTrackId: 'frontend',
    profile: { onboarded: true, primaryTrackId: 'frontend' },
    tracks: {
      frontend: {
        level: 'iniciante',
        weeklyHours: 8,
        completed: { 'fe-react': true },
        notes: { 'fe-html': 'semântica' },
      },
    },
  });
  assert.equal(state.profile.frontendFrameworkId, null);
  assert.equal(state.tracks.frontend.notes['fe-html'], 'semântica');
  assert.equal(state.tracks.frontend.completed['fe-react'], true);
  assert.equal(needsFrontendFrameworkChoice(state, index.tracks), true);
  const frontend = JSON.parse(readFileSync(join(root, '../data/tracks/frontend.json'), 'utf8'));
  const view = buildStudyRoadmap([{ track: frontend, trackState: state.tracks.frontend }]);
  const titles = view.phases.flatMap((phase) => phase.topics.map((topic) => topic.title));
  assert.ok(titles.includes('React: componentes, props e hooks'));
  assert.ok(titles.includes('HTML semântico'));
});

test('RN o framework troca só os nós de interface e preserva HTML, CSS e JavaScript', () => {
  const fullstack = JSON.parse(readFileSync(join(root, '../data/tracks/fullstack.json'), 'utf8'));
  const vue = JSON.parse(readFileSync(join(root, '../data/tracks/vuejs.json'), 'utf8'));
  const fsState = stateOf();
  fsState.notes['f2-html5'] = 'semântica';
  fsState.completed['f2-html5'] = true;
  const view = buildStudyRoadmap(
    [{ track: fullstack, trackState: fsState }],
    [],
    { track: { ...vue, group: 'tecnologia' }, trackState: stateOf() },
  );
  const front = view.phases.find((phase) => phase.id === 'fase-2');
  const titles = front.topics.map((topic) => topic.title);
  assert.equal(titles.includes('Frameworks e Bibliotecas'), false);
  assert.ok(titles.includes('HTML5'));
  assert.ok(titles.includes('CSS3 — Fundamentos'));
  assert.ok(titles.includes('JavaScript (ES6+) — Base da Linguagem'));
  assert.ok(titles.some((title) => title.includes('Composition API')));
  assert.ok(titles.indexOf('HTML5') < titles.findIndex((title) => title.includes('Composition API')));
  assert.equal(front.topics.find((topic) => topic.id === 'f2-html5').done, true);
  assert.equal(front.topics.find((topic) => topic.id === 'f2-html5').note, 'semântica');
  assert.ok(view.phases.find((phase) => phase.id === 'fase-1').topics.some((topic) => topic.title.includes('Git')));
  assert.ok(view.phases.find((phase) => phase.id === 'fase-3').topics.some((topic) => topic.id === 'f3-rest-apis'));
  assert.equal(fsState.notes['f2-html5'], 'semântica');
});

test('RN trocar o framework guarda progresso da trilha e da escolha anterior', () => {
  const state = emptyState();
  assert.throws(() => applyStudySelection(state, {
    trackId: 'frontend',
    level: 'iniciante',
    hours: 8,
  }));
  applyStudySelection(state, {
    trackId: 'frontend',
    level: 'iniciante',
    hours: 8,
    frontendFrameworkId: 'react',
  });
  state.tracks.frontend.notes['fe-html'] = 'semântica';
  state.tracks.react.notes['rc-1'] = 'hooks';
  applyStudySelection(state, {
    trackId: 'frontend',
    level: 'intermediario',
    hours: 10,
    frontendFrameworkId: 'vuejs',
    companionIds: ['react', 'git'],
  });
  assert.equal(state.profile.frontendFrameworkId, 'vuejs');
  assert.deepEqual(state.profile.companionIds, ['git']);
  assert.equal(state.tracks.frontend.notes['fe-html'], 'semântica');
  assert.equal(state.tracks.react.notes['rc-1'], 'hooks');
  assert.equal(state.tracks.vuejs.weeklyHours, 10);
  assert.equal(needsFrontendFrameworkChoice(state, index.tracks), false);
});
