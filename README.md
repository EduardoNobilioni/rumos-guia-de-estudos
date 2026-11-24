# Rumos

Mapa de estudos em tecnologia. Você escolhe a carreira, o nível e as horas por semana. O Rumos monta a trilha, guarda o progresso neste navegador e encaixa o estudo na rotina.

Não é curso e não dá certificado. Não tem cadastro nem servidor.

Publicação: https://eduardonobilioni.github.io/rumo-guia-de-estudos/

Repositório: https://github.com/EduardoNobilioni/rumo-guia-de-estudos

## O que dá pra fazer

- Escolher carreira, fundamentos e linguagens, nível e horas. O trajeto combinado junta as trilhas, tira tópico repetido e respeita pré-requisito.
- No Full-Stack, escolher uma linguagem de back-end. Nada vem marcado. Ela troca só a parte de linguagem do servidor; fundamentos, front-end, HTTP, banco e deploy continuam. Sem escolha salva, a versão em Node continua até você escolher.
- Marcar tópico, anotar, ocultar, reordenar, criar tópico e link seu.
- Ideias de projeto com busca, doze por página.
- Autoavaliação por etapa. Abaixo de 70% aparece revisão. Não é nota.
- Plano de estudo em volta da grade (`.ics`, CSV ou horário manual). Gerar baixa `.ics`, PDF e Markdown. A página mostra só o resumo.
- Backup JSON, PNG e PDF da trilha, link de compartilhar sem anotação nem progresso.
- Tema Limão Escuro (padrão) e Limão Claro. Funciona offline pelo service worker.

As regras de negócio estão em [docs/regras-de-negocio.md](docs/regras-de-negocio.md).

## Como rodar

Os dados são arquivos separados. Precisa de um servidor estático.

```bash
python3 -m http.server 8080
```

Abre http://localhost:8080

## Testes

Não há dependência pra instalar. O `npm` só chama o Node.

```bash
npm test
npm run validate
npm run check-links
```

`npm test` cobre progresso, backup antigo, link, grade, plano e as regras de adaptação da trilha. `npm run validate` confere as trilhas no Node, não no navegador. O workflow `.github/workflows/ci.yml` roda os dois em pull request.

## Mapa dos módulos

Não tem bundler. O navegador carrega ES modules.

- `js/app.js` sobe a página, troca de tela e liga os botões.
- `js/store.js` guarda estado, sessão e o `localStorage` (`rumo_guia_ptbr_v1`), gravando a trilha que mudou.
- `js/load-tracks.js` lê `data/tracks/index.json` na abertura e busca a trilha escolhida quando precisa.
- `js/model.js` reexporta `model/storage.js`, `model/validate.js` e `model/roadmap.js`.
- `js/ui/` desenha a casa, a trilha, a barra lateral, a folha, os diálogos, o quiz e o ⌘K.
- `js/screens/` é o plano, o painel e as ideias de projeto.
- `js/plan.js`, `js/ics.js`, `js/files.js`, `js/share.js`, `js/projects.js` ficam sem DOM.

## Visual

Limão Escuro em `:root`, Limão Claro em `[data-theme="light"]`. Tokens em `css/tokens.css`. O resto está em `base.css`, `components.css`, `screens.css` e `motion.css`. Fonte Plus Jakarta Sans e JetBrains Mono, em `woff2`, com `font-display: swap`. Sem Tailwind, sem Devicon, sem gradiente. O movimento usa `transform` e `opacity`, com `prefers-reduced-motion`.

A marca continua a agulha de bússola em `assets/brand/`, recolorida nos tokens.

## Como este projeto foi feito

A versão original, a trilha Full-Stack, foi criada por Eduardo Nobilioni.

Esta versão — trilhas personalizadas, plano de estudo, importação da grade, autoavaliações, exportações, redesign e acessibilidade — foi desenvolvida com a ajuda de ferramentas de IA: um assistente (Grok Bot) e um agente de código do Cursor. O trabalho foi feito sob a direção de Eduardo, que definiu as ideias, os requisitos e as escolhas de visual, e revisa as mudanças.

O texto das trilhas e os links de estudo também passaram por essa ajuda e podem ter erro. Correção é bem-vinda por issue ou pull request.

## Licença

MIT. Veja [LICENSE](LICENSE).
