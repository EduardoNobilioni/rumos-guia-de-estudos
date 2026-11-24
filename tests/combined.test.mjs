import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCombinedRoadmap, emptyTrackState } from '../js/model.js';

function loadTrack(file) {
  return JSON.parse(fs.readFileSync(`data/tracks/${file}`, 'utf8'));
}

test('buildCombinedRoadmap preserva comportamento de trilha única com metadados de origem', () => {
  const track = loadTrack('python.json');
  const ts = emptyTrackState();
  ts.level = 'iniciante';
  const view = buildCombinedRoadmap([{ track, trackState: ts }]);
  assert.equal(view.combined, false);
  assert.ok(view.phases.length > 0);
  assert.equal(view.phases[0].topics[0].sourceTrackId, 'python');
  assert.equal(view.phases[0].topics[0].sourceTrackName, track.name);
});

test('buildCombinedRoadmap combina carreira + fundamentos + tecnologia do básico ao avançado respeitando pré-requisitos', () => {
  const frontend = loadTrack('frontend.json');
  const algoritmos = loadTrack('algoritmos.json');
  const python = loadTrack('python.json');

  const tsFront = { ...emptyTrackState(), level: 'iniciante', weeklyHours: 10 };
  const tsAlgo = { ...emptyTrackState(), level: 'iniciante', weeklyHours: 10 };
  const tsPy = { ...emptyTrackState(), level: 'iniciante', weeklyHours: 10 };
  const firstTopicId = frontend.phases[0].topics[0].id;
  tsFront.completed[firstTopicId] = true;

  const view = buildCombinedRoadmap([
    { track: frontend, trackState: tsFront },
    { track: algoritmos, trackState: tsAlgo },
    { track: python, trackState: tsPy },
  ]);

  assert.equal(view.combined, true);
  assert.ok(view.phases.length >= 3);

  const flat = view.phases.flatMap((p, phaseIdx) => p.topics.map((t) => ({ ...t, _phaseIdx: phaseIdx })));
  const rank = { iniciante: 0, intermediario: 1, avancado: 2 };
  const effByKey = new Map();
  let maxPhaseIdx = 0;
  let maxEffectiveRank = 0;
  const seenPos = new Map();
  flat.forEach((t, idx) => {
    assert.ok(t._phaseIdx >= maxPhaseIdx, `etapa regrediu em ${t.title}`);
    maxPhaseIdx = t._phaseIdx;
    const key = `${t.sourceTrackId}::${t.id}`;
    const ownRank = rank[t.level] ?? 0;
    const prereqMax = Math.max(0, ...(t.prerequisites || []).map((pid) => effByKey.get(`${t.sourceTrackId}::${pid}`) ?? 0));
    const effRank = Math.max(ownRank, prereqMax);
    effByKey.set(key, effRank);
    assert.ok(effRank >= maxEffectiveRank, `nível efetivo regrediu em ${t.title} (${t.level})`);
    maxEffectiveRank = effRank;
    seenPos.set(key, idx);
  });

  // Nenhum pré-requisito intra-trilha aparece depois do tópico dependente
  for (const t of flat) {
    const pos = seenPos.get(`${t.sourceTrackId}::${t.id}`);
    for (const pid of t.prerequisites || []) {
      const pPos = seenPos.get(`${t.sourceTrackId}::${pid}`);
      if (pPos !== undefined) {
        assert.ok(pPos < pos, `pré-requisito ${pid} apareceu depois de ${t.id} (${t.sourceTrackId})`);
      }
    }
  }

  // Progresso salvo na trilha original é refletido
  const marked = flat.find((t) => t.sourceTrackId === 'frontend' && t.id === firstTopicId);
  assert.equal(marked.done, true);
});
