/**
 * Guias de projeto. O passo a passo genérico sai do tipo.
 * Os tópicos anteriores saem da própria trilha. Vinte projetos têm texto extra.
 */

const TYPES = {
  api: {
    label: 'API',
    steps: [
      'Escreva o que a API responde: um recurso, dois métodos e um erro.',
      'Suba um servidor mínimo que devolve JSON e um status HTTP certo.',
      'Valide o corpo da requisição e descreva o erro em uma frase.',
      'Teste o caminho feliz e um caminho de erro com um cliente HTTP.',
    ],
  },
  frontend: {
    label: 'Site ou interface',
    steps: [
      'Desenhe a página em HTML, com títulos e um fluxo que dá para ler sem estilo.',
      'Aplique CSS para caber no celular e no computador.',
      'Só então acrescente JavaScript no que precisa mudar sem recarregar.',
      'Abra no teclado e confira contraste, rótulo e foco.',
    ],
  },
  fullstack: {
    label: 'Aplicação completa',
    steps: [
      'Feche a interface estática antes de ligar o servidor.',
      'Exponha uma API pequena com os dados que a tela precisa.',
      'Conecte a tela à API e mostre carregando e erro.',
      'Suba os dois juntos e anote como repetir o arranque.',
    ],
  },
  cli: {
    label: 'Programa de terminal',
    steps: [
      'Defina a entrada (arquivo ou argumento) e a saída (texto ou arquivo).',
      'Trate o caso vazio e um erro de leitura sem derrubar o processo.',
      'Separe a regra da leitura do terminal, para testar a regra sozinha.',
      'Documente o comando exato no README.',
    ],
  },
  data: {
    label: 'Análise de dados',
    steps: [
      'Escreva a pergunta em uma frase, antes de abrir a ferramenta.',
      'Carregue uma amostra, confira tipo, nulo e unidade.',
      'Faça a conta ou o gráfico que responde a pergunta, e só esse.',
      'Anote a fonte do dado e o que o resultado não prova.',
    ],
  },
  mobile: {
    label: 'App mobile',
    steps: [
      'Monte uma tela que cabe no celular, com um fluxo só.',
      'Separe o estado da tela: carregando, vazio, erro e pronto.',
      'Ligue a tela a um dado local ou a uma API pequena.',
      'Percorra o fluxo com o leitor de tela ou o teclado do emulador.',
    ],
  },
  game: {
    label: 'Jogo',
    steps: [
      'Feche o ciclo: entrada, atualização com delta time e desenho.',
      'Coloque um objetivo visível e uma forma de perder ou terminar.',
      'Separe o estado do jogo (parado, jogando, fim) da renderização.',
      'Jogue três vezes e anote o que quebrou.',
    ],
  },
  automation: {
    label: 'Automação',
    steps: [
      'Escreva o que dispara a tarefa e o que ela produz.',
      'Rode o passo uma vez na mão e guarde o comando.',
      'Coloque o mesmo comando num script ou num pipeline.',
      'Force uma falha e confira se o log diz onde parou.',
    ],
  },
  auth: {
    label: 'Autenticação',
    steps: [
      'Defina quem entra, o que fica guardado e o que nunca vai para o cliente.',
      'Guarde senha só como hash. Não registre a senha em log.',
      'Proteja uma rota e devolva 401 quando faltar o acesso.',
      'Teste login certo, senha errada e acesso sem token.',
    ],
  },
  general: {
    label: 'Projeto',
    steps: [
      'Escreva em uma linha o que o resultado mostra.',
      'Faça a menor versão que outra pessoa abre sozinha.',
      'Trate um erro visível, em vez de só o caminho feliz.',
      'Compare com a definição de pronto e anote o que ficou de fora.',
    ],
  },
};

const TYPE_RULES = [
  [/login|jwt|senha|auth|sessao|sessão|cookie/, 'auth'],
  [/websocket|chat|tempo real/, 'fullstack'],
  [/api|rest|endpoint|rota http|graphql/, 'api'],
  [/\bcli\b|terminal|linha de comando/, 'cli'],
  [/jogo|game|godot|unity|pong|\bfase\b/, 'game'],
  [/flutter|emulador|android|ios/, 'mobile'],
  [/pandas|planilha|power bi|dashboard|painel|grafico|gráfico|csv/, 'data'],
  [/docker|pipeline|github actions|terraform|automat|conteiner|contêiner|container/, 'automation'],
  [/html|css|pagina|página|portfolio|portfólio|interface|formulario|formulário|componente/, 'frontend'],
];

const TRACK_TYPE = {
  mobile: 'mobile',
  'game-dev': 'game',
  dados: 'data',
  'analista-dados': 'data',
  'engenharia-dados': 'data',
  'machine-learning': 'data',
  'bi-analyst': 'data',
  'power-bi': 'data',
  devops: 'automation',
  cloud: 'automation',
  docker: 'automation',
  terraform: 'automation',
  devsecops: 'automation',
  frontend: 'frontend',
  react: 'frontend',
  vuejs: 'frontend',
  angular: 'frontend',
  nextjs: 'frontend',
  backend: 'api',
  nodejs: 'api',
  java: 'api',
  go: 'api',
  php: 'api',
  'csharp-dotnet': 'api',
  graphql: 'api',
  fullstack: 'fullstack',
};

const TITLE_HINTS = [
  { test: /html|página|pagina|semant|apresent/, title: /html|semant/ },
  { test: /css|layout|estilo|visual/, title: /css|layout|flex|estilo/ },
  { test: /javascript|\bdom\b|componente/, title: /javascript|dom|componente/ },
  { test: /api|rest|rota|endpoint|json/, title: /rest|http|api/ },
  { test: /login|auth|jwt|senha|sess/, title: /autentica|jwt|senha|acesso/ },
  { test: /sql|banco|tabela|model/, title: /sql|banco|model/ },
  { test: /docker|container|conteiner|contêiner/, title: /docker|contêiner|container/ },
  { test: /jogo|game|engine|pong/, title: /game loop|engine|jogo/ },
  { test: /flutter|mobile|tela/, title: /flutter|widget|tela/ },
  { test: /python|panda|dado|painel|planilha/, title: /python|panda|sql|bi|planilha/ },
  { test: /git|reposit/, title: /git/ },
  { test: /teste|test/, title: /teste/ },
];

const STACK_NAME = {
  nodejs: 'Node.js',
  python: 'Python',
  java: 'Java',
  go: 'Go',
  php: 'PHP',
  csharp: 'C#',
  cpp: 'C e C++',
  react: 'React',
  vuejs: 'Vue.js',
  angular: 'Angular',
};

export const HAND_GUIDES = {
  'f3-projeto-iniciante': {
    steps: ['Liste dois recursos: um GET que devolve itens e um POST que cria.', 'Responda 201 no criar e 400 quando o corpo vier vazio.', 'Escreva a mensagem de erro em uma frase, sem stack trace.'],
    pitfalls: ['Devolver 200 em todo erro.', 'Aceitar JSON sem olhar o tipo do campo.'],
    done: ['Dá para criar e listar com um cliente HTTP.', 'Um corpo inválido mostra o status e a frase.'],
  },
  'f3-projeto-intermediario': {
    steps: ['Modele a tarefa: título, dono e se está feita.', 'Exija login numa rota e deixe a listagem pública só se isso for o combinado.', 'Paginar a lista e descrever os dois fluxos no OpenAPI ou num README.'],
    pitfalls: ['Guardar a senha em texto.', 'Confiar no id do usuário que veio no corpo, em vez do token.'],
    done: ['Login certo cria tarefa. Senha errada não.', 'A página de tarefas não mistura dados de outra pessoa.'],
  },
  'nd2-projeto-iniciante': {
    steps: ['Suba uma rota de lista e uma de criação, sem banco.', 'Valide o corpo antes de empurrar o item na memória.', 'Separe a função da regra do `listen`, para testar sem porta.'],
    pitfalls: ['Tratar erro assíncrono só com try/catch no lugar errado.', 'Deixar o processo morrer no primeiro JSON inválido.'],
    done: ['Os testes da rota passam sem subir o servidor de verdade, se você separou o app.'],
  },
  'cs-p2-ini': {
    steps: ['Crie duas rotas de tarefas e o documento OpenAPI.', 'Devolva o status certo e um corpo de erro estável.', 'Suba com o comando que você vai repetir amanhã.'],
    pitfalls: ['Esconder o erro atrás de uma página HTML padrão.'],
    done: ['O Swagger ou o README mostra as duas rotas e um exemplo de erro.'],
  },
  'go-p3-ini': {
    steps: ['Registre GET e POST com `net/http`.', 'Decode do JSON com limite de tamanho.', 'Responda erro em JSON, não em texto solto.'],
    pitfalls: ['Ignorar o erro de `json.NewDecoder`.'],
    done: ['Um teste com `httptest` cobre lista, criação e corpo inválido.'],
  },
  'php-p2-int': {
    steps: ['Roteie GET e POST sem framework.', 'Leia o JSON e responda com `Content-Type` certo.', 'Não concatene dado do usuário em SQL se houver banco.'],
    pitfalls: ['Mostrar aviso do PHP na resposta.'],
    done: ['As duas rotas respondem JSON e um caso inválido não vaza caminho de arquivo.'],
  },
  'jv2-projeto-intermediario': {
    steps: ['Modele a reserva e as rotas de criar e listar.', 'Valide data e quantidade antes de salvar.', 'Devolva o erro de validação num formato só.'],
    pitfalls: ['Aceitar reserva no passado.', 'Deixar a entidade JPA vazar direto na resposta.'],
    done: ['Uma reserva válida aparece na lista. Uma inválida explica o campo.'],
  },
  'fe1-projeto-iniciante': {
    steps: ['Escreva a página com título, um parágrafo e um link, sem CSS.', 'Marque o idioma e o título da aba.', 'Estilize só o que ajuda a ler.'],
    pitfalls: ['Começar pelo framework.', 'Usar div para tudo.'],
    done: ['A página faz sentido com o CSS desligado e cabe numa tela estreita.'],
  },
  'fe5-projeto-intermediario': {
    steps: ['Escolha um trabalho já feito e escreva o que ele mostra.', 'Publique num endereço que abre sem o seu computador.', 'Inclua como rodar e o que ficou de fora.'],
    pitfalls: ['Subir segredo no repositório.', 'README que só diz "meu portfólio".'],
    done: ['Outra pessoa abre o link e entende o projeto em um minuto.'],
  },
  'f2-projeto-iniciante': {
    steps: ['Monte a página da disciplina: nome, ementa curta e uma lista.', 'Deixe o HTML semântico antes do visual.', 'Confira no celular.'],
    pitfalls: ['Copiar um template que você não sabe explicar.'],
    done: ['Dá para ler a página só com o teclado e o título da aba está certo.'],
  },
  'js3-projeto-iniciante': {
    steps: ['Mostre a lista a partir de um array.', 'Crie o item com `textContent` ou elemento, não com HTML concatenado.', 'Permita marcar e apagar sem recarregar.'],
    pitfalls: ['`innerHTML` com texto digitado pela pessoa.'],
    done: ['Um texto com `<script>` aparece como texto, não executa.'],
  },
  'ng-p1-ini': {
    steps: ['Liste tarefas a partir de um signal ou array.', 'Adicione e risque uma tarefa.', 'Mantenha o template legível, sem lógica longa no HTML.'],
    pitfalls: ['Mutar o array e esperar a tela adivinhar.'],
    done: ['A lista atualiza ao adicionar e ao concluir, sem recarregar.'],
  },
  'php-p2-ava': {
    steps: ['Crie usuário com `password_hash`.', 'Confira com `password_verify` e regenere o id da sessão no login.', 'Proteja o formulário contra CSRF.'],
    pitfalls: ['Comparar senha com `==`.', 'Guardar a senha no log.'],
    done: ['Senha errada não entra. O formulário sem o token também não.'],
  },
  'cs-p2-ava': {
    steps: ['Emita um JWT curto no login.', 'Exija o token numa rota e diferencie papel.', 'Devolva 401 e 403 com corpo estável.'],
    pitfalls: ['Segredo do token no repositório.', 'Não olhar a expiração.'],
    done: ['Sem token a rota fecha. Com papel errado ela explica a recusa.'],
  },
  'sec2-projeto-intermediario': {
    steps: ['Faça o hash da senha com Argon2 ou bcrypt.', 'Guarde a sessão em cookie `HttpOnly` e `Secure` quando houver HTTPS.', 'Mostre a mesma mensagem para usuário inexistente e senha errada.'],
    pitfalls: ['Dizer "usuário não existe" e facilitar a lista de contas.'],
    done: ['O cookie não aparece para o JavaScript da página e a senha não volta na resposta.'],
  },
  'an3-projeto-intermediario': {
    steps: ['Escreva a decisão que o painel deve apoiar.', 'Escolha um gráfico que responde isso, não três.', 'Coloque a fonte e a data do dado no próprio painel.'],
    pitfalls: ['Eixo cortado que exagera a diferença.', 'Filtro que a pessoa não entende.'],
    done: ['Alguém de fora aponta a decisão em uma frase depois de olhar o painel.'],
  },
  'bi-p2-int': {
    steps: ['Modele a tabela de vendas antes dos visuais.', 'Crie a medida da pergunta (total, margem ou meta).', 'Tire o gráfico que não muda a decisão.'],
    pitfalls: ['Coluna calculada onde uma medida bastava.', 'Dado de teste misturado com o real.'],
    done: ['O painel abre, filtra um período e a conta bate com a planilha de conferência.'],
  },
  'nx-p1-ava': {
    steps: ['Desenhe dois layouts e a rota de cada um.', 'Carregue o miolo sem repetir o menu.', 'Trate a rota inexistente.'],
    pitfalls: ['Buscar dado no cliente quando a página já podia vir pronta.'],
    done: ['Navegar entre as áreas não pisca o menu inteiro e o título da aba muda.'],
  },
  'game-p1-ini': {
    steps: ['Desenhe dois lados e a bola, num loop com delta time.', 'Marque ponto e reinicie a bola.', 'Encerre ou recomece quando alguém ganha.'],
    pitfalls: ['Velocidade presa ao FPS.', 'Colisão que prende a bola dentro do retângulo.'],
    done: ['Dá para jogar uma partida até o fim sem abrir o depurador.'],
  },
  'f6-projeto-iniciante': {
    steps: ['Escreva o Dockerfile da API que já funciona na sua máquina.', 'Suba com `docker run` e chame a rota de fora do container.', 'Anote a porta e a variável de ambiente.'],
    pitfalls: ['Imagem que só roda porque a pasta local está montada.', 'Segredo dentro do Dockerfile.'],
    done: ['Outra pessoa com Docker sobe a API sem instalar a linguagem.'],
  },
};

export function foldGuideText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function detectProjectType(project) {
  const blob = foldGuideText([
    project?.title,
    project?.description,
    project?.trackId,
    ...(project?.languages || []),
    ...(project?.tags || []),
  ].join(' '));
  if ((project?.trackId === 'mobile' || project?.trackId === 'game-dev') && !/api|rest|login|jwt/.test(blob)) {
    return TRACK_TYPE[project.trackId];
  }
  for (const [pattern, type] of TYPE_RULES) {
    if (pattern.test(blob)) return type;
  }
  return TRACK_TYPE[project?.trackId] || 'general';
}

export function prerequisiteTopics(project, track) {
  const topics = [];
  for (const phase of track?.phases || []) {
    const number = phase.number || 0;
    if (project?.phaseNumber && number > project.phaseNumber) continue;
    for (const topic of phase.topics || []) topics.push({ ...topic, phaseId: phase.id, phaseTitle: phase.title });
  }
  const blob = foldGuideText([project?.title, project?.description, ...(project?.languages || [])].join(' '));
  const picked = [];
  for (const hint of TITLE_HINTS) {
    if (!hint.test.test(blob)) continue;
    const found = topics.find((topic) => hint.title.test(foldGuideText(topic.title)) && !picked.some((item) => item.id === topic.id));
    if (found) picked.push(found);
    if (picked.length >= 4) break;
  }
  if (!picked.length) {
    const earlier = topics.filter((topic) => !project?.phaseId || topic.phaseId !== project.phaseId).slice(-3);
    return earlier.length ? earlier : topics.slice(0, 3);
  }
  return picked;
}

export function suggestedStack(project, profile = {}) {
  const type = project?.type || detectProjectType(project);
  const lang = STACK_NAME[profile.backendLanguageId];
  const ui = STACK_NAME[profile.frontendFrameworkId];
  const game = STACK_NAME[profile.careerChoices?.['game-dev']];
  if (type === 'api' || type === 'auth') {
    return lang ? `Faça na linguagem de back-end que você escolheu: ${lang}.` : 'Use a linguagem de back-end da sua trilha. Se ainda não escolheu, comece pela que já está no roteiro.';
  }
  if (type === 'frontend' || type === 'fullstack') {
    const uiLine = ui ? ` A interface pode ir para ${ui} depois que a página existir sem framework.` : '';
    const langLine = type === 'fullstack' && lang ? ` O servidor fica em ${lang}.` : '';
    return `Comece em HTML, CSS e JavaScript.${uiLine}${langLine}`;
  }
  if (type === 'game' && game) return `A parte de linguagem pode seguir ${game}, que você escolheu em Jogos.`;
  if (type === 'data') return 'Use a ferramenta da etapa: planilha, SQL ou Python. Não troque no meio da pergunta.';
  if (type === 'mobile') return 'Siga o Flutter da trilha, a menos que o enunciado peça outra coisa.';
  return 'Use o que a etapa da trilha já apresentou. Não acrescente ferramenta nova só para este projeto.';
}

export function buildProjectGuide(project, track, profile = {}) {
  const type = detectProjectType(project);
  const hand = HAND_GUIDES[project?.id] || null;
  const topics = prerequisiteTopics(project, track).filter((topic) => (track?.phases || []).some((phase) => (phase.topics || []).some((item) => item.id === topic.id)));
  return {
    type,
    typeLabel: TYPES[type].label,
    steps: hand?.steps || TYPES[type].steps,
    pitfalls: hand?.pitfalls || [],
    done: hand?.done?.length ? hand.done : (project?.definitionOfDone || []),
    handwritten: !!hand,
    topics: topics.map((topic) => ({ id: topic.id, title: topic.title, phaseTitle: topic.phaseTitle })),
    place: {
      trackId: project?.trackId || track?.id || '',
      trackName: project?.trackName || track?.name || '',
      phaseTitle: project?.phaseTitle || '',
      phaseNumber: project?.phaseNumber || 0,
    },
    stack: suggestedStack({ ...project, type }, profile),
  };
}

export const HAND_GUIDE_IDS = Object.keys(HAND_GUIDES);
