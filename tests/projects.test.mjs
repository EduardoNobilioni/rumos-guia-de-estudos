import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  availableProjectLanguages,
  buildProjectCatalog,
  filterProjects,
} from '../js/projects.js';

function loadAllTracks() {
  const idx = JSON.parse(fs.readFileSync('data/tracks/index.json', 'utf8'));
  return idx.tracks.map((entry) => ({
    ...entry,
    ...JSON.parse(fs.readFileSync(`data/tracks/${entry.file}`, 'utf8')),
  }));
}

test('buildProjectCatalog reúne todos os projetos com linguagens e status salvo', () => {
  const tracks = loadAllTracks();
  const firstFrontendProject = tracks.find((t) => t.id === 'frontend').phases[0].projects[0];
  const state = {
    tracks: {
      frontend: {
        completedProjects: { [firstFrontendProject.id]: true },
        customProjects: [],
      },
    },
  };
  const catalog = buildProjectCatalog(tracks, state);
  assert.ok(catalog.length >= 390);
  for (const project of catalog) {
    assert.ok(Array.isArray(project.languages) && project.languages.length >= 1, `sem linguagem em ${project.title}`);
  }
  const doneItem = catalog.find((p) => p.trackId === 'frontend' && p.id === firstFrontendProject.id);
  assert.equal(doneItem.done, true);
});

test('availableProjectLanguages e filterProjects filtram por nível, linguagem e busca', () => {
  const tracks = loadAllTracks();
  const catalog = buildProjectCatalog(tracks);
  const langs = availableProjectLanguages(catalog);
  assert.ok(langs.some((l) => l.name === 'Python' && l.count > 0));
  assert.ok(langs.some((l) => l.name === 'Java' && l.count > 0));
  assert.ok(langs.some((l) => l.name === 'SQL' && l.count > 0));

  const pythonStarter = filterProjects(catalog, { level: 'iniciante', languages: ['Python'] });
  assert.ok(pythonStarter.length > 0);
  for (const project of pythonStarter) {
    assert.equal(project.level, 'iniciante');
    assert.ok(project.languages.includes('Python'));
  }

  const javaSearch = filterProjects(catalog, { languages: ['Java'], query: 'spring' });
  assert.ok(javaSearch.every((p) => p.languages.includes('Java')));
});
