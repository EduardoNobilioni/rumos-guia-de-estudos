import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { trackIconHtml, topicIconHtml } from '../js/icons.js';

test('todas as trilhas publicadas possuem ícone colorido correspondente', () => {
  const index = JSON.parse(fs.readFileSync('data/tracks/index.json', 'utf8'));
  for (const track of index.tracks) {
    const html = trackIconHtml(track.id, 'md');
    assert.match(html, /rumo-icon-badge/, `trilha ${track.id} sem badge`);
    assert.ok(html.includes('devicon-') || html.includes('<svg'), `trilha ${track.id} sem ícone`);
  }
});

test('topicIconHtml escolhe ícones coerentes com linguagem, tecnologia e conceito', () => {
  assert.match(topicIconHtml({ title: 'Python essencial', tags: [] }, 'dados'), /devicon-python-plain colored/);
  assert.match(topicIconHtml({ title: 'React: componentes, props e hooks', tags: [] }, 'frontend'), /devicon-react-original colored/);
  assert.match(topicIconHtml({ title: 'Docker Compose', tags: [] }, 'fullstack'), /devicon-docker-plain colored/);
  assert.match(topicIconHtml({ title: 'Consultas SQL e Performance', tags: [] }, 'backend'), /devicon-postgresql-plain colored/);
  assert.match(topicIconHtml({ title: 'Segurança Web (OWASP)', tags: [] }, 'fullstack'), /<svg/);
});
