# Tarefas planejadas

Lista viva das próximas entregas do Rumos. Cada tarefa vira um commit separado.

## Regras que valem para todas as tarefas
1. **Montagem dinâmica:** o roadmap final é montado a partir do que foi selecionado em cada etapa (carreira, trilhas adicionais, nível e horas). Mudou a seleção, o roadmap muda.
2. **Trajeto coerente:** a ordem final vai do mais básico ao mais avançado, respeitando nível e pré-requisitos, mesmo combinando várias trilhas.
3. **Apresentação em árvore:** a trilha é exibida como mapa visual conectado (espinha dorsal + ramificações).
4. **Exportação completa:** toda exportação traz os **tópicos em lista** e a **apresentação visual** (árvore/fluxograma).
5. Nada disso pode quebrar ao adicionar trilhas, projetos ou telas novas.

## 0. Ajustes para cumprir as regras (antes das próximas tarefas)
- [x] Roadmap combinado: juntar carreira + trilhas adicionais num único trajeto ordenado por nível e pré-requisitos
- [x] PNG: incluir a lista de tópicos junto com a árvore
- [x] PDF: incluir a árvore visual junto com a lista de tópicos

## 1. Barra lateral de trilhas (estilo roadmap.sh)
- [x] Painel lateral com Carreiras, Fundamentos e Tecnologias
- [x] Busca e filtro por grupo
- [x] Troca rápida de trilha e destaque das trilhas do seu plano
- [x] Gaveta no celular

## 2. Modelo de dados dos projetos
- [x] Adicionar `languages`/`tags` aos projetos existentes
- [x] Índice unificado de projetos de todas as trilhas

## 3. Tela "Ideias de projeto"
- [x] Área separada com filtros combináveis por nível e por linguagem/tecnologia
- [x] Contador de resultados, roteiro e definição de pronto

## 4. Novas trilhas (em lotes de 3 a 4, com ícones e `npm run validate`)

### Carreiras (~9)
- [x] UX / UI Design e Product Design (pesquisa, usabilidade, Figma, Design Systems)
- [x] Product Manager / Gestão de Produto (discovery, métricas, priorização)
- [x] Engenharia de IA (LLMs, RAG, agentes, avaliação)
- [x] MLOps (pipelines, deploy e monitoramento de modelos)
- [x] Desenvolvimento de Jogos (game loop, física, Godot/Unity)
- [x] Engenharia de Redes (TCP/IP, roteamento, DNS, VPN, segurança de rede)
- [x] DevSecOps (AppSec em CI/CD, análise estática/dinâmica, contêineres)
- [x] Analista de BI (modelagem dimensional, Power BI/Metabase, KPIs)
- [x] C# / .NET ou PHP / Laravel

### Linguagens e tecnologias (~12)
- [x] Linguagens: Go, Rust, C / C++, C#, PHP
- [x] Front-end / Web: Next.js, Angular, Vue.js
- [ ] Dados / Back-end / Infra: GraphQL, MongoDB, Terraform, Power BI

### Fundamentos (~3)
- [ ] Redes de Computadores e Internet
- [ ] Design Systems e Acessibilidade
- [ ] Engenharia de Prompt

## 5. Fechamento de cada etapa
- [ ] README, prints e testes atualizados
