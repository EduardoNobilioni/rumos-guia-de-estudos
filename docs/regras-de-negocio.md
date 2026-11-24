# Regras de negócio

O que o Rumos promete pra quem estuda. O código que decide isso fica em `js/model/` e `js/plan.js`. A interface só aplica.

## Adaptação da trilha

- **RN-01.** A trilha segue o que foi escolhido: carreira, trilhas adicionais, nível e horas por semana. Não há outro campo de objetivo.
- **RN-02.** Tópico com nível abaixo do escolhido entra como opcional e fica fora da conta do progresso, salvo se a pessoa pedir pra contar.
- **RN-03.** O trajeto combinado junta a carreira e as trilhas adicionais, do mais básico ao mais avançado, respeitando pré-requisito dentro de cada trilha.
- **RN-04.** Tópico com o mesmo título em trilhas diferentes aparece uma vez. Fica o da trilha principal. Se qualquer cópia estava concluída, a que resta aparece concluída.
- **RN-05.** A duração e o prazo de cada etapa usam as horas semanais. Mais horas, prazo mais curto.
- **RN-06.** A grade do plano (dias e tamanho da janela) acompanha as horas semanais.
- **RN-07.** Refazer o onboarding troca nível, horas e companhia e limpa override, pra o nível novo valer de novo. Progresso, anotação, nota de etapa e sessão travada continuam.
- **RN-08.** Trocar de trilha não apaga o progresso das outras.

## Estudo e dados

- **RN-09.** Tudo fica na chave `rumo_guia_ptbr_v1`. Quem tinha `trilha_estudos_ptbr_v2` ou `roadmap_fullstack_ptbr_v1` é migrado. O backup antigo do Full-Stack ainda importa.
- **RN-10.** O link de compartilhar leva configuração, não anotação nem progresso.
- **RN-11.** Autoavaliação abaixo de 70% pede revisão. Não é nota.
- **RN-12.** O plano não marca estudo em cima de aula. O `.ics` exportado só tem sessão de estudo.
- **RN-13.** A página do plano não lista cada sessão. Gerar monta o plano e baixa `.ics`, PDF e Markdown. Na tela fica o resumo: quantidade, intervalo de datas e horas.
- **RN-14.** A busca de ideias espera cerca de 200 ms e mostra 12 projetos por página.
- **RN-15.** Na abertura o navegador lê só o índice das trilhas. O JSON de uma trilha baixa quando ela é aberta. A validação das 52 trilhas roda no `npm run validate`, não no navegador.

## O que já estava pronto e o que mudou

| Regra | Antes | Depois |
| --- | --- | --- |
| RN-01 escolha vira trilha | Implementada no onboarding | `applyStudySelection` |
| RN-02 opcional abaixo do nível | Implementada | Igual, com teste explícito |
| RN-03 trajeto combinado | Implementada | Igual |
| RN-04 tópico compartilhado | Ausente | Deduplica por título |
| RN-05 prazo pelas horas | Função existia e não era usada | Aparece na etapa |
| RN-06 janela semanal | Parcial, só na sugestão inicial | `syncPlanWeeklyHours` |
| RN-07 refazer sem perder progresso | Parcial | Nível e horas reaplicados, notas preservadas |
| RN-13 plano sem lista na tela | Ausente | Resumo e download |
