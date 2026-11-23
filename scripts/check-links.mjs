import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'data', 'tracks');
const manifest = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));

const urls = new Map();
for (const entry of manifest.tracks) {
  const data = JSON.parse(readFileSync(join(dir, entry.file), 'utf8'));
  for (const phase of data.phases || []) {
    for (const topic of phase.topics || []) {
      for (const res of topic.resources || []) {
        if (!res?.url) continue;
        const list = urls.get(res.url) || [];
        list.push(`${entry.id}:${topic.id}`);
        urls.set(res.url, list);
      }
    }
  }
}

async function checkUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (response.status === 405 || response.status === 403 || response.status === 400) {
      response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    }
    return { url, status: response.status, ok: response.ok || response.status === 403 };
  } catch (error) {
    return { url, status: 0, ok: false, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

const entries = [...urls.keys()];
const concurrency = 8;
const broken = [];
let cursor = 0;

async function worker() {
  while (cursor < entries.length) {
    const url = entries[cursor];
    cursor += 1;
    const result = await checkUrl(url);
    if (!result.ok) broken.push({ ...result, refs: urls.get(url) });
  }
}

console.log(`Verificando ${entries.length} URLs únicas...`);
await Promise.all(Array.from({ length: concurrency }, worker));

if (!broken.length) {
  console.log('Todos os links responderam com sucesso.');
  process.exit(0);
}

console.error(`\n${broken.length} link(s) com falha:`);
for (const item of broken) {
  console.error(`- [${item.status || item.error}] ${item.url} (${item.refs.join(', ')})`);
}
process.exit(1);
