import assert from 'node:assert/strict';
import test from 'node:test';
import { roadmapLines, roadmapMarkdown, roadmapPdf, textPdf } from '../js/files.js';

test('textPdf gera Uint8Array com bytes WinAnsi corretos para acentuação e xref exato', () => {
  const bytes = textPdf(['Etapa 1: Programação e Ação — Revisão']);
  assert.ok(bytes instanceof Uint8Array);
  const latin1 = Buffer.from(bytes).toString('latin1');
  assert.ok(latin1.startsWith('%PDF-1.4\n'));
  // ã = 0xe3, ç = 0xe7, ó = 0xf3 in WinAnsiEncoding (single byte, not UTF-8 0xc3 0xa3)
  assert.ok(bytes.includes(0xe3));
  assert.ok(bytes.includes(0xe7));
  assert.ok(!latin1.includes('Ã£'));
  assert.match(latin1, /%%EOF$/);
});

test('roadmapLines e roadmapMarkdown incluem o fluxograma das etapas', () => {
  const track = { name: 'Front-end', description: 'Guia web' };
  const view = {
    phases: [
      { number: 1, title: 'Base', badgeTitle: 'Base', progress: { done: 1, total: 2 }, topics: [], projects: [] },
      { number: 2, title: 'Layout', badgeTitle: 'Layout', progress: { done: 0, total: 3 }, topics: [], projects: [] },
    ],
  };
  const lines = roadmapLines(track, view).join('\n');
  const md = roadmapMarkdown(track, view);
  assert.match(lines, /Fluxograma das etapas:/);
  assert.match(lines, /1\. Base \(1\/2\).*->.*2\. Layout \(0\/3\)/);
  assert.match(md, /## Fluxograma das etapas/);
  assert.match(md, /→/);
});

test('roadmapPdf gera árvore visual e caderno de acompanhamento em WinAnsi válido', () => {
  const track = { name: 'Back-end', description: 'API e Programação' };
  const view = {
    phases: [
      {
        number: 1,
        title: 'Lógica e HTTP',
        badgeTitle: 'Base',
        progress: { done: 1, total: 2, complete: false },
        topics: [
          { title: 'Variáveis e Funções', hours: 4, done: true, status: 'required' },
          { title: 'Requisições HTTP', hours: 6, done: false, status: 'required' },
        ],
        projects: [],
      },
      {
        number: 2,
        title: 'Banco de Dados',
        badgeTitle: 'Dados',
        progress: { done: 2, total: 2, complete: true },
        topics: [
          { title: 'Modelagem Relacional', hours: 5, done: true, status: 'required' },
        ],
        projects: [],
      },
    ],
  };
  const bytes = roadmapPdf(track, view);
  assert.ok(bytes instanceof Uint8Array);
  const latin1 = Buffer.from(bytes).toString('latin1');
  assert.ok(latin1.startsWith('%PDF-1.4\n'));
  assert.match(latin1, /Arvore visual do roadmap/);
  assert.match(latin1, /Caderno de acompanhamento/);
  assert.match(latin1, /\[x\] Vari/);
  assert.match(latin1, /\[ \] Requisi/);
  assert.match(latin1, /%%EOF$/);
});
