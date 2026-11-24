import { normalizeLevel } from './model.js';

const LANGUAGE_RULES = [
  [/\b(html5?|css3?|flexbox|grid|tailwind|acessibilidade|wcag|dom)\b/, 'HTML/CSS'],
  [/\b(typescript|tsconfig|zod)\b/, 'TypeScript'],
  [/\b(react|jsx|hooks|next\.?js|testing library)\b/, 'React'],
  [/\b(javascript|es6\+?|fetch|vite)\b/, 'JavaScript'],
  [/\b(node\.?js|express|fastify|npm)\b/, 'Node.js'],
  [/\b(python|pandas|numpy|matplotlib|jupyter|ruff|mypy|pytest|scikit|pytorch|tensorflow)\b/, 'Python'],
  [/\b(java|spring|maven|gradle|junit)\b/, 'Java'],
  [/\b(sql|postgresql|postgres|mysql|sqlite|select|join|cte|acid|relacional|modelagem)\b/, 'SQL'],
  [/\b(docker|dockerfile|compose|conteiner|container)\b/, 'Docker'],
  [/\b(kubernetes|kubectl|pod|deployment|helm|ingress)\b/, 'Kubernetes'],
  [/\b(linux|bash|shell|terminal|systemd|ssh|chmod)\b/, 'Linux'],
  [/\b(git|github|branch|commit|pull request|ci\/cd)\b/, 'Git'],
  [/\b(power bi|dax|star schema|planilha|excel)\b/, 'Power BI'],
  [/\b(mobile|flutter|dart|android|kotlin|swift|ios|react native)\b/, 'Mobile'],
  [/\b(aws|cloud|nuvem|terraform|iac|nginx)\b/, 'Cloud'],
  [/\b(owasp|seguranca|criptografia|jwt|https|cors|csp|lgpd|pentest)\b/, 'Segurança'],
  [/\b(teste|testes|qa|playwright|jest|tdd|e2e|unitario)\b/, 'QA/Testes'],
  [/\b(machine learning|ml|ia|llm|rag|modelo|regressao|classificacao|spark|duckdb|dbt|etl|mlflow|drift)\b/, 'Dados/ML'],
  [/\b(ux|ui|figma|wireframe|heuristica|usabilidade|design system)\b/, 'UX/UI'],
  [/\b(produto|discovery|rice|prd)\b/, 'Produto'],
  [/\b(c#|csharp|\.net|dotnet|aspnet|xunit|ef core)\b/, 'C# / .NET'],
  [/\b(godot|unity|game loop|jogos|fsm)\b/, 'Jogos'],
];

const TRACK_DEFAULT_LANGS = {
  frontend: ['HTML/CSS', 'JavaScript'],
  backend: ['Node.js', 'SQL'],
  fullstack: ['HTML/CSS', 'JavaScript', 'Node.js', 'SQL'],
  dados: ['Python', 'SQL', 'Dados/ML'],
  'analista-dados': ['SQL', 'Power BI', 'Python'],
  'engenharia-dados': ['Python', 'SQL', 'Dados/ML'],
  'machine-learning': ['Python', 'Dados/ML'],
  java: ['Java', 'SQL'],
  mobile: ['Mobile', 'JavaScript'],
  qa: ['QA/Testes', 'JavaScript'],
  devops: ['Linux', 'Docker', 'Git'],
  ciberseguranca: ['Segurança', 'Linux'],
  cloud: ['Cloud', 'Linux', 'Docker'],
  'arquitetura-software': ['Arquitetura', 'Node.js'],
  'ux-ui': ['UX/UI'],
  'product-manager': ['Produto'],
  'ai-engineer': ['Python', 'Dados/ML'],
  mlops: ['Python', 'Docker', 'Dados/ML'],
  'game-dev': ['Jogos', 'C# / .NET'],
  'network-engineer': ['Linux', 'Segurança'],
  devsecops: ['Segurança', 'Docker', 'Git'],
  'bi-analyst': ['SQL', 'Power BI'],
  'csharp-dotnet': ['C# / .NET', 'SQL'],
  computacao: ['Algoritmos', 'Linux'],
  algoritmos: ['Algoritmos', 'Python'],
  'banco-de-dados': ['SQL'],
  'engenharia-software': ['Git', 'QA/Testes'],
  python: ['Python'],
  javascript: ['JavaScript'],
  typescript: ['TypeScript'],
  react: ['React', 'JavaScript'],
  nodejs: ['Node.js', 'JavaScript'],
  sql: ['SQL'],
  git: ['Git'],
  linux: ['Linux'],
  docker: ['Docker'],
  kubernetes: ['Kubernetes', 'Docker'],
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function inferProjectLanguages(project, track) {
  if (Array.isArray(project?.languages) && project.languages.length) {
    return [...new Set(project.languages.map((item) => String(item).trim()).filter(Boolean))];
  }
  const blob = normalizeText([
    project?.title || '',
    project?.description || '',
    ...(project?.steps || []),
    ...(project?.definitionOfDone || []),
  ].join(' '));

  const found = [];
  for (const [pattern, label] of LANGUAGE_RULES) {
    if (pattern.test(blob) && !found.includes(label)) {
      found.push(label);
    }
  }
  const defaults = TRACK_DEFAULT_LANGS[track?.id] || ['Geral'];
  if (!found.length) return [...defaults];
  return found;
}

export function buildProjectCatalog(tracks, state = null) {
  const catalog = [];
  for (const track of tracks || []) {
    const trackState = state?.tracks?.[track.id] || null;
    const completed = trackState?.completedProjects || {};
    const phaseById = new Map((track.phases || []).map((p, idx) => [p.id, { phase: p, number: idx + 1 }]));

    (track.phases || []).forEach((phase, index) => {
      for (const project of phase.projects || []) {
        catalog.push({
          ...project,
          level: normalizeLevel(project.level) || 'iniciante',
          languages: inferProjectLanguages(project, track),
          trackId: track.id,
          trackName: track.name,
          trackGroup: track.group || 'carreira',
          phaseId: phase.id,
          phaseNumber: index + 1,
          phaseTitle: phase.title,
          done: !!completed[project.id],
          custom: false,
        });
      }
    });

    for (const custom of trackState?.customProjects || []) {
      const match = phaseById.get(custom.phaseId);
      catalog.push({
        ...custom,
        level: normalizeLevel(custom.level) || 'iniciante',
        languages: inferProjectLanguages(custom, track),
        trackId: track.id,
        trackName: track.name,
        trackGroup: track.group || 'carreira',
        phaseId: custom.phaseId || '',
        phaseNumber: match ? match.number : 0,
        phaseTitle: match ? match.phase.title : 'Sem etapa',
        done: !!completed[custom.id],
        custom: true,
      });
    }
  }
  return catalog;
}

export function availableProjectLanguages(catalog) {
  const counts = new Map();
  for (const project of catalog || []) {
    for (const lang of project.languages || []) {
      counts.set(lang, (counts.get(lang) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}

export function filterProjects(catalog, options = {}) {
  const {
    level = 'all',
    languages = [],
    query = '',
    onlyPending = false,
  } = options;
  const activeLangs = new Set((languages || []).filter(Boolean));
  const needle = normalizeText(query).trim();

  return (catalog || []).filter((project) => {
    if (level !== 'all' && project.level !== level) return false;
    if (onlyPending && project.done) return false;
    if (activeLangs.size > 0 && !(project.languages || []).some((lang) => activeLangs.has(lang))) return false;
    if (needle) {
      const hay = normalizeText([
        project.title,
        project.description,
        project.trackName,
        ...(project.languages || []),
      ].join(' '));
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}
