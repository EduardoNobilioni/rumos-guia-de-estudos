import { icon } from './ui/glyph.js';

const TRACK_ABBR = {
  frontend: 'FE', backend: 'BE', fullstack: 'FS', dados: 'CD', 'analista-dados': 'AD',
  'engenharia-dados': 'ED', 'machine-learning': 'ML', java: 'JV', mobile: 'MB', qa: 'QA',
  devops: 'DO', ciberseguranca: 'CS', cloud: 'CL', 'arquitetura-software': 'AR', computacao: 'FC',
  algoritmos: 'AL', 'engenharia-software': 'ES', python: 'PY', javascript: 'JS', typescript: 'TS',
  react: 'RC', nodejs: 'ND', sql: 'SQL', git: 'GIT', linux: 'LX', docker: 'DK', kubernetes: 'K8',
  'ai-engineer': 'IA', 'ux-ui': 'UX', 'product-manager': 'PM', mlops: 'MO', 'game-dev': 'JG',
  'network-engineer': 'ER', devsecops: 'SC', 'bi-analyst': 'BI', 'csharp-dotnet': 'DN', go: 'GO',
  rust: 'RS', cpp: 'CP', csharp: 'C#', php: 'PHP', nextjs: 'NX', angular: 'NG', vuejs: 'VU',
  graphql: 'QL', mongodb: 'MG', terraform: 'TF', 'power-bi': 'PB', 'redes-internet': 'RI',
  'design-systems': 'DS', 'engenharia-prompt': 'EP',
};

const TOPIC_CODES = [
  [/tailwind/, 'TW'],
  [/html/, 'HTML'],
  [/css|flexbox|grid|layout/, 'CSS'],
  [/typescript/, 'TS'],
  [/react/, 'RC'],
  [/next\.?js/, 'NX'],
  [/angular/, 'NG'],
  [/vue/, 'VU'],
  [/javascript|\bdom\b|fetch/, 'JS'],
  [/node\.?js|express|npm/, 'ND'],
  [/python|pandas|django/, 'PY'],
  [/postgres|postgresql|\bsql\b|select|join/, 'SQL'],
  [/docker|compose|container/, 'DK'],
  [/kubernetes|kubectl|helm/, 'K8'],
  [/git|github|commit/, 'GIT'],
  [/linux|bash|terminal/, 'LX'],
  [/graphql/, 'QL'],
  [/mongo/, 'MG'],
  [/terraform/, 'TF'],
  [/java|spring/, 'JV'],
  [/rust|cargo/, 'RS'],
  [/golang|\bgo\b/, 'GO'],
  [/php|laravel/, 'PHP'],
  [/c#|csharp|\.net/, 'C#'],
];

function fold(value) {
  return String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function trackAbbr(trackId, name = '') {
  if (TRACK_ABBR[trackId]) return TRACK_ABBR[trackId];
  const words = String(name || trackId).split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return String(trackId).slice(0, 2).toUpperCase();
}

function badge(code, size) {
  const kind = size === 'sm' || size === 'lg' ? size : 'md';
  return `<span class="letter-badge is-${kind}" aria-hidden="true">${code}</span>`;
}

export function trackIconHtml(trackId, size = 'md', name = '') {
  return badge(trackAbbr(trackId, name), size);
}

export function topicIconHtml(topic, trackId = '', size = 'md') {
  const text = fold(`${topic?.title || ''} ${(topic?.tags || []).join(' ')}`);
  for (const [pattern, code] of TOPIC_CODES) {
    if (pattern.test(text)) return badge(code, size);
  }
  return `<span class="letter-badge is-${size === 'sm' || size === 'lg' ? size : 'md'}" aria-hidden="true">${icon('topic')}</span>`;
}
