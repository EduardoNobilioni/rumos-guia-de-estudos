import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProjectCatalog } from '../js/projects.js';
import {
  HAND_GUIDE_IDS,
  buildProjectGuide,
  detectProjectType,
  prerequisiteTopics,
  suggestedStack,
} from '../js/project-guides.js';

const root = dirname(fileURLToPath(import.meta.url));
const tracks = readdirSync(join(root, '../data/tracks'))
  .filter((file) => file.endsWith('.json') && file !== 'index.json')
  .map((file) => JSON.parse(readFileSync(join(root, '../data/tracks', file), 'utf8')));

function projectById(id) {
  for (const track of tracks) {
    for (const phase of track.phases || []) {
      const project = (phase.projects || []).find((item) => item.id === id);
      if (project) {
        return {
          project: {
            ...project,
            trackId: track.id,
            trackName: track.name,
            phaseId: phase.id,
            phaseNumber: phase.number,
            phaseTitle: phase.title,
          },
          track,
        };
      }
    }
  }
  return null;
}

test('RN o tipo do projeto sai do título e da trilha', () => {
  assert.equal(detectProjectType({ title: 'API de tarefas com login', trackId: 'fullstack' }), 'auth');
  assert.equal(detectProjectType({ title: 'Página de apresentação', trackId: 'frontend' }), 'frontend');
  assert.equal(detectProjectType({ title: 'Mini jogo estilo Pong', trackId: 'game-dev' }), 'game');
  assert.equal(detectProjectType({ title: 'Contador de palavras CLI', trackId: 'go' }), 'cli');
  assert.equal(detectProjectType({ title: 'Um painel, uma decisão', trackId: 'analista-dados' }), 'data');
  assert.equal(detectProjectType({ title: 'Navegação e formulário', trackId: 'mobile' }), 'mobile');
  assert.equal(detectProjectType({ title: 'API em um contêiner', trackId: 'fullstack' }), 'api');
  assert.equal(detectProjectType({ title: 'Pipeline no GitHub Actions', trackId: 'devops' }), 'automation');
});

test('RN o guia aponta tópicos que existem na trilha e todo projeto tem passo', () => {
  const catalog = buildProjectCatalog(tracks);
  assert.ok(catalog.length >= 390);
  let generated = 0;
  for (const project of catalog) {
    const track = tracks.find((item) => item.id === project.trackId);
    const guide = buildProjectGuide(project, track, {});
    generated += 1;
    assert.ok(guide.steps.length >= 3, project.id);
    assert.equal(guide.place.trackId, project.trackId);
    const ids = new Set((track.phases || []).flatMap((phase) => (phase.topics || []).map((topic) => topic.id)));
    for (const topic of guide.topics) assert.equal(ids.has(topic.id), true, `${project.id} ${topic.id}`);
  }
  assert.equal(generated, catalog.length);
});

test('RN vinte projetos têm texto extra e a pilha segue a escolha', () => {
  assert.equal(HAND_GUIDE_IDS.length, 20);
  for (const id of HAND_GUIDE_IDS) assert.ok(projectById(id), id);
  const found = projectById('f3-projeto-intermediario');
  const guide = buildProjectGuide(found.project, found.track, { backendLanguageId: 'python', frontendFrameworkId: 'vuejs' });
  assert.equal(guide.handwritten, true);
  assert.match(guide.stack, /Python/);
  const page = projectById('fe1-projeto-iniciante');
  const front = buildProjectGuide(page.project, page.track, { frontendFrameworkId: 'react' });
  assert.match(front.stack, /React/);
  const before = prerequisiteTopics(found.project, found.track);
  assert.ok(before.length > 0);
  assert.ok(before.every((topic) => topic.id));
});

test('RN a sugestão genérica não inventa ferramenta', () => {
  assert.match(suggestedStack({ title: 'API', trackId: 'backend', type: 'api' }, {}), /linguagem de back-end/);
  assert.match(suggestedStack({ title: 'API', trackId: 'backend', type: 'api' }, { backendLanguageId: 'go' }), /Go/);
});
