import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyImport,
  applySharePlan,
  CIENCIA_DE_DADOS_ID,
  buildExport,
  buildRoadmap,
  effectiveStatus,
  emptyState,
  emptyTrackState,
  ensureTrack,
  formatDuration,
  isLegacyExport,
  moveId,
  projectPlanStats,
  groupTracks,
  normalizeState,
  PREVIOUS_STORAGE_KEY,
  readStoredJson,
  roadmapStats,
  STORAGE_KEY,
  setTopicStatus,
  tracksMatching,
  sharePlanFromTrack,
  stateFromLegacyStorage,
  validateTrack,
  visibleProjects,
} from '../js/model.js';
import { decodePlan, encodePlan, planFromHash } from '../js/share.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FULLSTACK_IDS = [
  'f1-internet', 'f1-terminal', 'f1-git-local', 'f1-git-branch', 'f1-github',
  'f2-html5', 'f2-css-fundamentos', 'f2-css-layouts', 'f2-css-moderno', 'f2-js-base',
  'f2-js-estruturas', 'f2-js-dom', 'f2-typescript', 'f2-build-tools', 'f2-frameworks', 'f2-estado-estilo',
  'f3-runtime', 'f3-frameworks-web', 'f3-rest-apis', 'f3-realtime', 'f3-docs-testes', 'f3-auth', 'f3-authz', 'f3-seguranca',
  'f4-sql', 'f4-modelagem', 'f4-consultas', 'f4-orms', 'f4-nosql', 'f4-cache',
  'f5-boas-praticas', 'f5-padroes', 'f5-unitarios', 'f5-integracao', 'f5-e2e', 'f5-padronizacao',
  'f6-linux', 'f6-docker', 'f6-compose', 'f6-cicd', 'f6-paas', 'f6-aws', 'f6-iac-monitor',
  'f7-checkpoint-1', 'f7-checkpoint-2', 'f7-checkpoint-3',
];

function sampleTrack() {
  return {
    id: 'demo',
    name: 'Demo',
    tagline: 'Teste',
    description: 'Trilha de teste.',
    phases: [
      {
        id: 'fase-1',
        number: 1,
        badgeTitle: 'Base',
        title: 'Base',
        topics: [
          {
            id: 'top-ini',
            title: 'Começo',
            description: 'Base.',
            level: 'iniciante',
            hours: 4,
            tags: ['A'],
            prerequisites: [],
            resources: [{ title: 'MDN', url: 'https://developer.mozilla.org', lang: 'pt', kind: 'leitura' }],
          },
          {
            id: 'top-adv',
            title: 'Fundo',
            description: 'Avanço.',
            level: 'avancado',
            hours: 10,
            tags: [],
            prerequisites: ['top-ini'],
            resources: [{ title: 'Docs', url: 'https://example.com', lang: 'en', kind: 'documentacao' }],
          },
        ],
        projects: [
          { id: 'proj-ini', title: 'Projeto inicial', description: 'Faça o básico.', level: 'iniciante', hours: 4 },
          { id: 'proj-mid', title: 'Projeto médio', description: 'Aprofunde.', level: 'intermediario', hours: 8 },
          { id: 'proj-adv', title: 'Projeto final', description: 'Feche o ciclo.', level: 'avancado', hours: 12 },
        ],
      },
    ],
  };
}

test('migração do localStorage antigo preserva progresso do Full-Stack', () => {
  const state = stateFromLegacyStorage({
    theme: 'light',
    strikethrough: false,
    completed: { 'f1-internet': true },
    notes: { 'f1-internet': 'DNS' },
    collapsedPhases: { 'fase-1': true },
  });
  assert.equal(state.theme, 'light');
  assert.equal(state.activeTrackId, 'fullstack');
  assert.equal(state.profile.onboarded, true);
  assert.equal(state.tracks.fullstack.level, 'iniciante');
  assert.equal(state.tracks.fullstack.completed['f1-internet'], true);
  assert.equal(state.tracks.fullstack.notes['f1-internet'], 'DNS');
  assert.equal(state.tracks.fullstack.collapsedPhases['fase-1'], true);
});

test('importação legada restaura o Full-Stack e não apaga observações já salvas', () => {
  const legacy = JSON.parse(readFileSync(join(root, 'examples', 'backup-legado.json'), 'utf8'));
  assert.equal(isLegacyExport(legacy), true);
  const state = emptyState();
  const track = ensureTrack(state, 'fullstack');
  track.level = 'avancado';
  track.weeklyHours = 8;
  track.phaseNotes['fase-1'] = 'Observação que o backup antigo não conhece';
  const result = applyImport(state, legacy);
  assert.equal(result.kind, 'legacy');
  assert.equal(state.activeTrackId, 'fullstack');
  assert.equal(state.tracks.fullstack.completed['f1-internet'], true);
  assert.equal(state.tracks.fullstack.completed['f1-terminal'], true);
  assert.match(state.tracks.fullstack.notes['f1-internet'], /DNS/);
  assert.equal(state.tracks.fullstack.phaseNotes['fase-1'], 'Observação que o backup antigo não conhece');
  assert.equal(state.tracks.fullstack.level, 'avancado');
});

test('exportação nova inclui observações e projetos e ainda é reconhecida como versão 2', () => {
  const state = emptyState();
  state.activeTrackId = 'dados';
  state.profile.onboarded = true;
  const track = ensureTrack(state, 'dados');
  track.level = 'intermediario';
  track.weeklyHours = 6;
  track.phaseNotes['ds-fase-1'] = 'Rever mediana';
  track.completedProjects['ds-proj'] = true;
  track.customProjects.push({
    id: 'meu-proj',
    phaseId: 'ds-fase-1',
    title: 'Análise da cantina',
    description: 'Olhar o cardápio',
    level: 'intermediario',
    hours: 5,
    custom: true,
  });
  const exported = buildExport(state, '2026-11-17T00:00:00.000Z');
  assert.equal(exported.version, 2);
  assert.equal(exported.phaseNotes['ds-fase-1'], 'Rever mediana');
  assert.equal(isLegacyExport(exported), false);
  const restored = emptyState();
  assert.equal(applyImport(restored, exported).kind, 'v2');
  assert.equal(restored.tracks.dados.phaseNotes['ds-fase-1'], 'Rever mediana');
  assert.equal(restored.tracks.dados.completedProjects['ds-proj'], true);
  assert.equal(restored.tracks.dados.customProjects[0].title, 'Análise da cantina');
});

test('tópicos abaixo do nível ficam opcionais e não entram no progresso', () => {
  const track = sampleTrack();
  const trackState = emptyTrackState();
  trackState.level = 'avancado';
  trackState.weeklyHours = 10;
  const view = buildRoadmap(track, trackState);
  const [beginner, advanced] = view.phases[0].topics;
  assert.equal(beginner.status, 'optional');
  assert.equal(advanced.status, 'required');
  const stats = roadmapStats(view.phases);
  assert.equal(stats.required, 1);
  assert.equal(stats.optional, 1);
  assert.equal(stats.percent, 0);
  assert.equal(stats.hours, 10);
});

test('incluir tópicos abaixo do nível e marcar projeto não mistura as contas', () => {
  const track = sampleTrack();
  const trackState = emptyTrackState();
  trackState.level = 'avancado';
  trackState.weeklyHours = 5;
  trackState.includeBelowLevel = true;
  trackState.completedProjects['proj-adv'] = true;
  const view = buildRoadmap(track, trackState);
  assert.equal(view.phases[0].topics[0].status, 'required');
  const stats = roadmapStats(view.phases);
  assert.equal(stats.required, 2);
  assert.equal(stats.percent, 0);
  const projects = projectPlanStats(view.phases, 'avancado');
  assert.equal(projects.total, 1);
  assert.equal(projects.done, 1);
  assert.equal(visibleProjects(view.phases[0].projects, 'avancado', false).length, 1);
  assert.equal(visibleProjects(view.phases[0].projects, 'avancado', true).length, 3);
});

test('override de oculto sai do progresso e a recomendação volta quando o override some', () => {
  const track = sampleTrack();
  const trackState = emptyTrackState();
  trackState.level = 'iniciante';
  trackState.weeklyHours = 4;
  const advanced = track.phases[0].topics[1];
  setTopicStatus(trackState, advanced, 'hidden');
  assert.equal(effectiveStatus(advanced, trackState), 'hidden');
  let stats = roadmapStats(buildRoadmap(track, trackState).phases);
  assert.equal(stats.hidden, 1);
  assert.equal(stats.required, 1);
  setTopicStatus(trackState, advanced, 'required');
  assert.equal(trackState.overrides[advanced.id], undefined);
  stats = roadmapStats(buildRoadmap(track, trackState).phases);
  assert.equal(stats.required, 2);
});

test('duração em português e reordenação', () => {
  assert.equal(formatDuration(10, 10), '10 h · cerca de 1 semana');
  assert.match(formatDuration(4, 10), /dia/);
  assert.equal(formatDuration(40, 8), '40 h · cerca de 5 semanas');
  assert.deepEqual(moveId(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(moveId(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c']);
});

test('link de compartilhamento não leva anotação nem observação', async () => {
  const state = emptyState();
  state.activeTrackId = 'frontend';
  const track = ensureTrack(state, 'frontend');
  track.level = 'intermediario';
  track.weeklyHours = 8;
  track.notes['fe-html'] = 'segredo';
  track.phaseNotes['fe-fase-1'] = 'observação pessoal';
  track.completed['fe-html'] = true;
  track.overrides['fe-html'] = 'optional';
  track.customProjects.push({
    id: 'ideia-1',
    phaseId: 'fe-fase-1',
    title: 'Minha ideia',
    description: 'Fazer um cartão',
    level: 'intermediario',
    hours: 4,
    custom: true,
  });
  const encoded = await encodePlan(sharePlanFromTrack(state, 'frontend'));
  const plan = await decodePlan(encoded);
  assert.equal(plan.t, 'frontend');
  assert.equal(plan.l, 'intermediario');
  assert.equal(JSON.stringify(plan).includes('segredo'), false);
  assert.equal(JSON.stringify(plan).includes('observação pessoal'), false);
  assert.equal(plan.c, undefined);
  assert.equal(plan.p[0].title, 'Minha ideia');

  const receiver = emptyState();
  const existing = ensureTrack(receiver, 'frontend');
  existing.completed['fe-html'] = true;
  existing.phaseNotes['fe-fase-1'] = 'continua aqui';
  existing.notes['fe-html'] = 'nota local';
  applySharePlan(receiver, plan);
  assert.equal(receiver.tracks.frontend.completed['fe-html'], true);
  assert.equal(receiver.tracks.frontend.phaseNotes['fe-fase-1'], 'continua aqui');
  assert.equal(receiver.tracks.frontend.notes['fe-html'], 'nota local');
  assert.equal(receiver.tracks.frontend.overrides['fe-html'], 'optional');
  assert.equal(receiver.tracks.frontend.customProjects[0].title, 'Minha ideia');
  assert.equal(planFromHash(`#plano=${encoded}`), encoded);
});

test('a trilha Dados continua no id dados ao se chamar Ciência de Dados', () => {
  const raw = {
    version: 2,
    profile: { onboarded: true, companionIds: ['python', 'dados'], primaryTrackId: 'dados' },
    activeTrackId: 'dados',
    tracks: {
      dados: {
        level: 'iniciante',
        weeklyHours: 4,
        completed: { 'ds-python': true },
        notes: { 'ds-python': 'lembrar a média' },
      },
    },
  };
  const state = normalizeState(raw);
  assert.equal(CIENCIA_DE_DADOS_ID, 'dados');
  assert.equal(state.activeTrackId, 'dados');
  assert.equal(state.tracks.dados.completed['ds-python'], true);
  assert.equal(state.tracks.dados.notes['ds-python'], 'lembrar a média');
  assert.deepEqual(state.profile.companionIds, ['python']);
  const dados = JSON.parse(readFileSync(join(root, 'data', 'tracks', 'dados.json'), 'utf8'));
  assert.equal(dados.id, 'dados');
  assert.equal(dados.name, 'Ciência de Dados');
  for (const id of ['ds-python', 'ds-excel', 'ds-bi', 'ds-ab', 'ds-coleta']) {
    assert.ok(dados.phases.some((phase) => phase.topics.some((topic) => topic.id === id)), id);
  }
  const exported = buildExport(state, '2026-11-17T00:00:00.000Z');
  const restored = normalizeState(exported);
  assert.equal(restored.tracks.dados.completed['ds-python'], true);
  assert.deepEqual(restored.profile.companionIds, ['python']);
});

test('a chave nova do Rumos lê o progresso salvo nas chaves antigas', () => {
  const previous = {
    version: 2,
    theme: 'light',
    activeTrackId: 'frontend',
    profile: { onboarded: true },
    tracks: { frontend: { level: 'iniciante', weeklyHours: 4, completed: { 'fe-html': true } } },
  };
  const bag = { [PREVIOUS_STORAGE_KEY]: JSON.stringify(previous) };
  const found = readStoredJson((key) => bag[key] || null);
  assert.equal(found.key, PREVIOUS_STORAGE_KEY);
  const state = normalizeState(found.parsed);
  assert.equal(state.tracks.frontend.completed['fe-html'], true);
  assert.equal(STORAGE_KEY, 'rumo_guia_ptbr_v1');
  bag[STORAGE_KEY] = JSON.stringify({ ...previous, theme: 'dark' });
  assert.equal(readStoredJson((key) => bag[key] || null).key, STORAGE_KEY);
});

test('busca de trilha ignora acento e agrupa por carreira, fundamentos e tecnologia', () => {
  const list = [
    { id: 'dados', name: 'Ciência de Dados', tagline: 'Python', description: '', group: 'carreira', keywords: ['excel'] },
    { id: 'python', name: 'Python', tagline: 'Linguagem', description: '', group: 'tecnologia', keywords: [] },
    { id: 'computacao', name: 'Fundamentos da Computação', tagline: 'Máquina', description: '', group: 'fundamentos', keywords: [] },
  ];
  assert.deepEqual(tracksMatching(list, 'ciencia').map((track) => track.id), ['dados']);
  assert.deepEqual(tracksMatching(list, 'Excel').map((track) => track.id), ['dados']);
  assert.deepEqual(groupTracks(list).map((group) => group.id), ['carreira', 'fundamentos', 'tecnologia']);
});

test('as trilhas publicadas são válidas e o Full-Stack conserva os 46 tópicos', () => {
  const index = JSON.parse(readFileSync(join(root, 'data', 'tracks', 'index.json'), 'utf8'));
  assert.equal(index.tracks.length >= 6, true);
  for (const entry of index.tracks) {
    const data = JSON.parse(readFileSync(join(root, 'data', 'tracks', entry.file), 'utf8'));
    const errors = validateTrack(data);
    assert.deepEqual(errors, [], errors.join('\n'));
  }
  const fullstack = JSON.parse(readFileSync(join(root, 'data', 'tracks', 'fullstack.json'), 'utf8'));
  const ids = fullstack.phases.flatMap((phase) => phase.topics.map((topic) => topic.id));
  const kept = ids.filter((id) => FULLSTACK_IDS.includes(id));
  assert.deepEqual(kept, FULLSTACK_IDS);
  assert.ok(ids.includes('f4-http-cache'));
  assert.equal(
    fullstack.phases[0].topics[0].description,
    'Protocolos HTTP/HTTPS, funcionamento do DNS, nomes de domínio, hospedagem, modelo cliente-servidor e ciclo de renderização dos navegadores.',
  );
});
