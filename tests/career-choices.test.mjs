import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyStudySelection,
  buildStudyRoadmap,
  careerSplitOptions,
  careerSplitReport,
  emptyState,
  emptyTrackState,
  needsCareerChoice,
  normalizeState,
  resetTrackProgress,
} from '../js/model.js';

const root = dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(readFileSync(join(root, '../data/tracks/index.json'), 'utf8'));

test('RN só oferece caminho quando as duas trilhas existem', () => {
  const report = careerSplitReport(index.tracks);
  const byId = Object.fromEntries(report.map((item) => [item.careerId, item]));
  assert.equal(byId['game-dev'].offered, true);
  assert.deepEqual(byId['game-dev'].present, ['csharp', 'cpp']);
  for (const id of ['mobile', 'dados', 'analista-dados', 'engenharia-dados', 'machine-learning', 'devops', 'cloud']) {
    assert.equal(byId[id].offered, false, id);
    assert.equal(careerSplitOptions(id, index.tracks).length, 0, id);
  }
  assert.ok(byId.mobile.missing.includes('kotlin'));
  assert.ok(byId.dados.missing.includes('r'));
  assert.ok(byId.devops.missing.includes('aws'));
  assert.deepEqual(careerSplitOptions('game-dev', index.tracks).map((item) => item.id), ['csharp', 'cpp']);
});

test('RN Jogos troca só o nó da engine e guarda o resto', () => {
  const games = JSON.parse(readFileSync(join(root, '../data/tracks/game-dev.json'), 'utf8'));
  const csharp = JSON.parse(readFileSync(join(root, '../data/tracks/csharp.json'), 'utf8'));
  const plain = { ...emptyTrackState(), level: 'iniciante', weeklyHours: 8 };
  plain.notes['game-loop'] = 'delta';
  plain.completed['game-loop'] = true;
  const untouched = buildStudyRoadmap([{ track: games, trackState: plain }]);
  assert.ok(untouched.phases.flatMap((phase) => phase.topics).some((topic) => topic.id === 'game-engine'));
  const view = buildStudyRoadmap(
    [{ track: games, trackState: plain }],
    [],
    null,
    { track: { ...csharp, group: 'tecnologia' }, trackState: { ...emptyTrackState(), level: 'iniciante', weeklyHours: 8 } },
  );
  const titles = view.phases.flatMap((phase) => phase.topics.map((topic) => topic.title));
  assert.equal(titles.includes('Cenas, nós/GameObjects e sinais na engine (Godot ou Unity)'), false);
  assert.ok(titles.includes('Game loop, frames por segundo e Delta Time'));
  assert.ok(titles.includes('Colisões, física e Máquinas de Estado (FSM)'));
  assert.ok(titles.some((title) => title.includes('C#')));
  const loop = view.phases.flatMap((phase) => phase.topics).find((topic) => topic.id === 'game-loop');
  assert.equal(loop.done, true);
  assert.equal(loop.note, 'delta');
  assert.equal(plain.notes['game-loop'], 'delta');
});

test('RN estado antigo sem caminho pede a escolha e o reset apaga progresso e anotação', () => {
  const state = normalizeState({
    version: 2,
    activeTrackId: 'game-dev',
    profile: { onboarded: true, primaryTrackId: 'game-dev' },
    tracks: { 'game-dev': { level: 'iniciante', weeklyHours: 6, completed: { 'game-loop': true }, notes: { 'game-loop': 'delta' } } },
  });
  assert.deepEqual(state.profile.careerChoices, {});
  assert.equal(needsCareerChoice(state, index.tracks), true);
  assert.equal(state.tracks['game-dev'].notes['game-loop'], 'delta');
  resetTrackProgress(state.tracks['game-dev']);
  assert.deepEqual(state.tracks['game-dev'].completed, {});
  assert.deepEqual(state.tracks['game-dev'].notes, {});
  applyStudySelection(state, {
    trackId: 'game-dev',
    level: 'iniciante',
    hours: 6,
    careerChoiceId: 'csharp',
  });
  assert.equal(state.profile.careerChoices['game-dev'], 'csharp');
  assert.equal(needsCareerChoice(state, index.tracks), false);
});
