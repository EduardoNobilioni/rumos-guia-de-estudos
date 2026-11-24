import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { trackIconHtml, topicIconHtml } from '../js/icons.js';

test('todas as trilhas publicadas possuem monograma', () => {
  const index = JSON.parse(fs.readFileSync('data/tracks/index.json', 'utf8'));
  for (const track of index.tracks) {
    const html = trackIconHtml(track.id, 'md', track.name || '');
    assert.match(html, /letter-badge/, `trilha ${track.id} sem monograma`);
    assert.doesNotMatch(html, /devicon-/);
  }
});

test('topicIconHtml escolhe monogramas coerentes e um livro genérico', () => {
  assert.match(topicIconHtml({ title: 'Python essencial', tags: [] }, 'dados'), />PY</);
  assert.match(topicIconHtml({ title: 'React: componentes, props e hooks', tags: [] }, 'frontend'), />RC</);
  assert.match(topicIconHtml({ title: 'Docker Compose', tags: [] }, 'fullstack'), />DK</);
  assert.match(topicIconHtml({ title: 'Consultas SQL e Performance', tags: [] }, 'backend'), />SQL</);
  assert.match(topicIconHtml({ title: 'Segurança Web (OWASP)', tags: [] }, 'fullstack'), /<svg/);
});
