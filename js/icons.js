const SVG_ICONS = {
  frontend: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="15" rx="3" stroke="#2563EB" stroke-width="2" fill="#DBEAFE"/><path d="M3 9h18" stroke="#2563EB" stroke-width="2"/><path d="M8 14l2 2-2 2M13 16h3" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  backend: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="6" rx="2" fill="#E0F2FE" stroke="#0284C7" stroke-width="1.8"/><rect x="4" y="14" width="16" height="6" rx="2" fill="#D1FAE5" stroke="#059669" stroke-width="1.8"/><circle cx="8" cy="7" r="1" fill="#0284C7"/><circle cx="8" cy="17" r="1" fill="#059669"/><path d="M12 10v4" stroke="#64748B" stroke-width="1.8"/></svg>',
  fullstack: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l8 4.5-8 4.5-8-4.5L12 3z" fill="#DBEAFE" stroke="#2563EB" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 12l8 4.5 8-4.5" stroke="#059669" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16.5L12 21l8-4.5" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dados: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="12" width="4" height="8" rx="1" fill="#3B82F6"/><rect x="10" y="7" width="4" height="13" rx="1" fill="#8B5CF6"/><rect x="16" y="4" width="4" height="16" rx="1" fill="#10B981"/></svg>',
  'analista-dados': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="#EDE9FE" stroke="#7C3AED" stroke-width="1.8"/><path d="M11 4v7h7" stroke="#2563EB" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.5 16.5L20 20" stroke="#059669" stroke-width="2" stroke-linecap="round"/></svg>',
  'engenharia-dados': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><ellipse cx="7" cy="7" rx="3.5" ry="2" fill="#DBEAFE" stroke="#2563EB" stroke-width="1.8"/><path d="M3.5 7v5c0 1.1 1.6 2 3.5 2s3.5-.9 3.5-2V7" stroke="#2563EB" stroke-width="1.8"/><path d="M11 10h4l2-3 3 6" stroke="#059669" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="14" y="14" width="7" height="6" rx="1.5" fill="#D1FAE5" stroke="#059669" stroke-width="1.8"/></svg>',
  'machine-learning': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="7" r="2.2" fill="#3B82F6"/><circle cx="6" cy="17" r="2.2" fill="#3B82F6"/><circle cx="12" cy="12" r="2.5" fill="#8B5CF6"/><circle cx="18" cy="7" r="2.2" fill="#10B981"/><circle cx="18" cy="17" r="2.2" fill="#10B981"/><path d="M8 8l2.5 2.5M8 16l2.5-2.5M14 10.5L16.5 8M14 13.5L16.5 16" stroke="#64748B" stroke-width="1.6"/></svg>',
  mobile: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="#E0F2FE" stroke="#0284C7" stroke-width="1.8"/><path d="M10.5 5.5h3M11 18h2" stroke="#0284C7" stroke-width="1.8" stroke-linecap="round"/><rect x="9.5" y="8.5" width="5" height="6" rx="1" fill="#34D399"/></svg>',
  qa: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#D1FAE5" stroke="#059669" stroke-width="1.8"/><path d="M8.5 12.5l2.5 2.5 4.8-5.2" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  devops: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" stroke="#0EA5E9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ciberseguranca: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l7 3v5c0 4.8-3 8.8-7 10-4-1.2-7-5.2-7-10V6l7-3z" fill="#FEE2E2" stroke="#DC2626" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 12l1.8 1.8 3.5-3.6" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7.2 8.7 4.2 4.2 0 0 0 7 18z" fill="#E0F2FE" stroke="#0284C7" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  'arquitetura-software': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="3" width="6" height="4" rx="1" fill="#DBEAFE" stroke="#2563EB" stroke-width="1.8"/><rect x="3" y="16" width="6" height="4" rx="1" fill="#D1FAE5" stroke="#059669" stroke-width="1.8"/><rect x="15" y="16" width="6" height="4" rx="1" fill="#EDE9FE" stroke="#7C3AED" stroke-width="1.8"/><path d="M12 7v4M6 16v-3h12v3" stroke="#64748B" stroke-width="1.8" stroke-linecap="round"/></svg>',
  computacao: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="#E0E7FF" stroke="#4F46E5" stroke-width="1.8"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="#4F46E5"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke="#4F46E5" stroke-width="1.8" stroke-linecap="round"/></svg>',
  algoritmos: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="5" r="2.3" fill="#2563EB"/><circle cx="6" cy="17" r="2.3" fill="#059669"/><circle cx="18" cy="17" r="2.3" fill="#7C3AED"/><path d="M10.8 7L7 14.8M13.2 7L17 14.8M8.3 17h7.4" stroke="#64748B" stroke-width="1.8" stroke-linecap="round"/></svg>',
  'engenharia-software': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z" fill="#FEF3C7" stroke="#D97706" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  network: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#E0F2FE" stroke="#0284C7" stroke-width="1.8"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" stroke="#0284C7" stroke-width="1.6"/></svg>',
  checkpoint: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 20V5" stroke="#2563EB" stroke-width="2" stroke-linecap="round"/><path d="M5 5h11l-2 4 2 4H5" fill="#FEF3C7" stroke="#D97706" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  'ux-ui': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="#FCE7F3" stroke="#DB2777" stroke-width="1.8"/><circle cx="9" cy="10" r="2" fill="#EC4899"/><path d="M13 9h4M13 13h4M7.5 16h9" stroke="#DB2777" stroke-width="1.8" stroke-linecap="round"/></svg>',
  'product-manager': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" fill="#FEF3C7" stroke="#D97706" stroke-width="1.8"/><path d="M8 14v-3M12 14V8M16 14v-5" stroke="#D97706" stroke-width="2" stroke-linecap="round"/></svg>',
  'ai-engineer': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l1.8 4.8L18.5 9.5l-4.7 1.7L12 16l-1.8-4.8L5.5 9.5l4.7-1.7L12 3z" fill="#EDE9FE" stroke="#7C3AED" stroke-width="1.8" stroke-linejoin="round"/><circle cx="18" cy="17.5" r="2.2" fill="#10B981"/></svg>',
  mlops: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="7" cy="12" r="3" fill="#DBEAFE" stroke="#2563EB" stroke-width="1.8"/><circle cx="17" cy="7" r="2.5" fill="#D1FAE5" stroke="#059669" stroke-width="1.8"/><circle cx="17" cy="17" r="2.5" fill="#EDE9FE" stroke="#7C3AED" stroke-width="1.8"/><path d="M9.7 10.7l4.8-2.5M9.7 13.3l4.8 2.5" stroke="#64748B" stroke-width="1.8"/></svg>',
  'game-dev': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="7" width="18" height="11" rx="5" fill="#EDE9FE" stroke="#7C3AED" stroke-width="1.8"/><path d="M8 10.5v4M6 12.5h4" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round"/><circle cx="15.5" cy="11.5" r="1" fill="#10B981"/><circle cx="17.5" cy="13.5" r="1" fill="#EC4899"/></svg>',
  'network-engineer': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="5" r="2.5" fill="#DBEAFE" stroke="#2563EB" stroke-width="1.8"/><circle cx="6" cy="18" r="2.5" fill="#D1FAE5" stroke="#059669" stroke-width="1.8"/><circle cx="18" cy="18" r="2.5" fill="#E0F2FE" stroke="#0284C7" stroke-width="1.8"/><path d="M10.7 7.2L7.2 15.8M13.3 7.2l3.5 8.6M8.5 18h7" stroke="#64748B" stroke-width="1.8"/></svg>',
  devsecops: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l7 3v5c0 4.8-3 8.8-7 10-4-1.2-7-5.2-7-10V6l7-3z" fill="#E0F2FE" stroke="#0284C7" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 12l1.8 1.8 3.5-3.6" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'bi-analyst': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2.5" fill="#FEF3C7" stroke="#D97706" stroke-width="1.8"/><path d="M7.5 16v-4M12 16V9M16.5 16v-6" stroke="#D97706" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

const TRACK_DEVICONS = {
  python: 'devicon-python-plain colored',
  javascript: 'devicon-javascript-plain colored',
  typescript: 'devicon-typescript-plain colored',
  react: 'devicon-react-original colored',
  nodejs: 'devicon-nodejs-plain colored',
  java: 'devicon-java-plain colored',
  sql: 'devicon-postgresql-plain colored',
  'banco-de-dados': 'devicon-postgresql-plain colored',
  git: 'devicon-git-plain colored',
  linux: 'devicon-linux-plain',
  docker: 'devicon-docker-plain colored',
  kubernetes: 'devicon-kubernetes-plain colored',
  'csharp-dotnet': 'devicon-csharp-plain colored',
  go: 'devicon-go-original-wordmark colored',
  rust: 'devicon-rust-original',
  cpp: 'devicon-cplusplus-plain colored',
  csharp: 'devicon-csharp-plain colored',
  php: 'devicon-php-plain colored',
  nextjs: 'devicon-nextjs-plain',
  angular: 'devicon-angular-plain colored',
  vuejs: 'devicon-vuejs-plain colored',
};

const TOPIC_RULES = [
  [/\b(playwright)\b/, { devicon: 'devicon-playwright-plain colored' }],
  [/\b(jest|testing library)\b/, { devicon: 'devicon-jest-plain colored' }],
  [/\b(vitest)\b/, { devicon: 'devicon-vitest-plain colored' }],
  [/\b(next\.?js)\b/, { devicon: 'devicon-nextjs-plain' }],
  [/\b(angular|rxjs|signals|testbed)\b/, { devicon: 'devicon-angular-plain colored' }],
  [/\b(vue\.?js|pinia|composables|vue router)\b/, { devicon: 'devicon-vuejs-plain colored' }],
  [/\b(react)\b/, { devicon: 'devicon-react-original colored' }],
  [/\b(typescript|tsconfig|\.d\.ts|zod)\b/, { devicon: 'devicon-typescript-plain colored' }],
  [/\b(tailwind)\b/, { devicon: 'devicon-tailwindcss-original colored' }],
  [/\b(css3?|flexbox|grid|estilizacao|layout)\b/, { devicon: 'devicon-css3-plain colored' }],
  [/\b(html5?|semantico|seo|acessibilidade|formulario)\b/, { devicon: 'devicon-html5-plain colored' }],
  [/\b(vite)\b/, { devicon: 'devicon-vitejs-plain colored' }],
  [/\b(eslint|prettier)\b/, { devicon: 'devicon-eslint-plain colored' }],
  [/\b(javascript|es6\+?|dom|fetch)\b/, { devicon: 'devicon-javascript-plain colored' }],
  [/\b(node\.?js|npm|express|fastify|event loop|pino)\b/, { devicon: 'devicon-nodejs-plain colored' }],
  [/\b(pandas)\b/, { devicon: 'devicon-pandas-plain colored' }],
  [/\b(numpy)\b/, { devicon: 'devicon-numpy-plain colored' }],
  [/\b(matplotlib)\b/, { devicon: 'devicon-matplotlib-plain colored' }],
  [/\b(jupyter|notebook)\b/, { devicon: 'devicon-jupyter-plain colored' }],
  [/\b(scikit|regressao|classificacao)\b/, { devicon: 'devicon-scikitlearn-plain colored' }],
  [/\b(tensorflow)\b/, { devicon: 'devicon-tensorflow-original colored' }],
  [/\b(pytorch)\b/, { devicon: 'devicon-pytorch-original colored' }],
  [/\b(spark|duckdb)\b/, { devicon: 'devicon-apachespark-original colored' }],
  [/\b(python|venv|unittest|ruff|mypy|pyproject|dataclasses)\b/, { devicon: 'devicon-python-plain colored' }],
  [/\b(spring)\b/, { devicon: 'devicon-spring-original colored' }],
  [/\b(java|jvm|maven|gradle)\b/, { devicon: 'devicon-java-plain colored' }],
  [/\b(golang|goroutines|go test)\b/, { devicon: 'devicon-go-original-wordmark colored' }],
  [/\b(rust|cargo|borrow|ownership|tokio|axum)\b/, { devicon: 'devicon-rust-original' }],
  [/\b(c\+\+|cpp|cmake|raii|stl|ponteiros)\b/, { devicon: 'devicon-cplusplus-plain colored' }],
  [/\b(php|composer|laravel|phpunit|pdo)\b/, { devicon: 'devicon-php-plain colored' }],
  [/\b(c#|csharp|\.net|dotnet|aspnet|ef core|linq|xunit)\b/, { devicon: 'devicon-csharp-plain colored' }],
  [/\b(godot)\b/, { devicon: 'devicon-godot-plain colored' }],
  [/\b(unity)\b/, { devicon: 'devicon-unity-plain' }],
  [/\b(game loop|fsm|jogos)\b/, { svg: 'game-dev' }],
  [/\b(sast|dast|sbom|trivy|opa)\b/, { svg: 'devsecops' }],
  [/\b(flutter|dart)\b/, { devicon: 'devicon-flutter-plain colored' }],
  [/\b(android|kotlin)\b/, { devicon: 'devicon-android-plain colored' }],
  [/\b(swift|ios)\b/, { devicon: 'devicon-swift-plain colored' }],
  [/\b(mongodb|nosql|documento)\b/, { devicon: 'devicon-mongodb-plain colored' }],
  [/\b(redis)\b/, { devicon: 'devicon-redis-plain colored' }],
  [/\b(postgresql|sql|select|join|cte|explain|acid|migrations|orm|relacional|modelagem|indice)\b/, { devicon: 'devicon-postgresql-plain colored' }],
  [/\b(github actions|ci\/cd|ci )\b/, { devicon: 'devicon-githubactions-plain colored' }],
  [/\b(github|pull request|pr)\b/, { devicon: 'devicon-github-original' }],
  [/\b(git|commit|branch|rebase|merge|stash|reflog|worktree)\b/, { devicon: 'devicon-git-plain colored' }],
  [/\b(docker|dockerfile|compose|conteiner|container)\b/, { devicon: 'devicon-docker-plain colored' }],
  [/\b(kubernetes|kubectl|pod|replicaset|deployment|ingress|helm)\b/, { devicon: 'devicon-kubernetes-plain colored' }],
  [/\b(nginx)\b/, { devicon: 'devicon-nginx-original colored' }],
  [/\b(terraform|infraestrutura como codigo)\b/, { devicon: 'devicon-terraform-plain colored' }],
  [/\b(aws|nuvem|cloud)\b/, { devicon: 'devicon-amazonwebservices-plain-wordmark colored' }],
  [/\b(linux|terminal|bash|linha de comando|systemd|ssh|chmod|firewall|servidor)\b/, { devicon: 'devicon-linux-plain' }],
  [/\b(figma|wireframe|heuristica|usabilidade|design system|ux|ui)\b/, { devicon: 'devicon-figma-plain colored' }],
  [/\b(fastapi)\b/, { devicon: 'devicon-fastapi-plain colored' }],
  [/\b(llm|rag|prompt|agentes|embeddings|evals)\b/, { svg: 'ai-engineer' }],
  [/\b(mlflow|mlops|drift|serving)\b/, { svg: 'mlops' }],
  [/\b(produto|discovery|rice|prd|metricas)\b/, { svg: 'product-manager' }],
  [/\b(checkpoint)\b/, { svg: 'checkpoint' }],
  [/\b(owasp|seguranca|cors|csp|https|autenticacao|autorizacao|jwt|lgpd|criptografia)\b/, { svg: 'ciberseguranca' }],
  [/\b(http|rest|restful|api|internet|tempo real|dns|rede)\b/, { svg: 'network' }],
  [/\b(teste|testes|tdd|qualidade|qa|contrato)\b/, { svg: 'qa' }],
  [/\b(estatistica|probabilidade|power bi|dax|planilha|painel|grafico|coorte|funil|inferencia)\b/, { svg: 'analista-dados' }],
  [/\b(algoritmo|grafo|arvore|heap|recursao|ordenar|pilha|fila|dispersao|programacao dinamica)\b/, { svg: 'algoritmos' }],
  [/\b(arquitetura|monolito|servicos|doze fatores|solid|dry|padroes|refatoracao)\b/, { svg: 'arquitetura-software' }],
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function renderIconBadge(spec, size = 'md') {
  const sizeClass = size === 'sm' ? 'is-sm' : (size === 'lg' ? 'is-lg' : 'is-md');
  if (spec?.devicon) {
    return `<span class="rumo-icon-badge ${sizeClass}" aria-hidden="true"><i class="${spec.devicon}"></i></span>`;
  }
  const svg = SVG_ICONS[spec?.svg] || SVG_ICONS.fullstack;
  return `<span class="rumo-icon-badge ${sizeClass}" aria-hidden="true">${svg}</span>`;
}

export function trackIconHtml(trackId, size = 'md') {
  if (TRACK_DEVICONS[trackId]) {
    return renderIconBadge({ devicon: TRACK_DEVICONS[trackId] }, size);
  }
  return renderIconBadge({ svg: SVG_ICONS[trackId] ? trackId : 'fullstack' }, size);
}

export function topicIconHtml(topic, trackId = 'fullstack', size = 'md') {
  const text = normalizeText(`${topic?.title || ''} ${(topic?.tags || []).join(' ')}`);
  for (const [pattern, spec] of TOPIC_RULES) {
    if (pattern.test(text)) return renderIconBadge(spec, size);
  }
  return trackIconHtml(trackId, size);
}
