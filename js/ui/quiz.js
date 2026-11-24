import { quizScore } from '../model.js';
import { escapeHtml } from './dom.js';

export function initQuiz(api) {
  const { $, persist, toast } = api;

  function openQuiz(scope, id) {
    const trackState = api.activeTrackState();
    const view = api.activeView();
    let questions = [];
    let title = 'Autoavaliação';
    if (scope === 'phase') {
      const phase = view.phases.find((item) => item.id === id);
      if (!phase) return;
      questions = phase.quiz || [];
      title = `Autoavaliação · Etapa ${phase.number}`;
    } else {
      const located = api.findTopic(id);
      if (!located || !(located.topic.quiz || []).length) return;
      questions = located.topic.quiz;
      title = `Autoavaliação · ${located.topic.title}`;
    }
    $('quizTitle').textContent = title;
    $('quizBody').innerHTML = questions.map((question) => {
      const picked = trackState.quizAnswers[question.id];
      const pickedChoice = (question.choices || []).find((choice) => choice.id === picked);
      const choices = (question.choices || []).map((choice) => {
        const selected = picked === choice.id;
        const verdict = !selected ? '' : `${choice.correct ? 'Certa. ' : 'Errada. '}${choice.explanation}`;
        return `<label class="choice-card${selected ? ' is-selected' : ''}"><input type="radio" name="quiz-${question.id}" data-question="${question.id}" value="${choice.id}" ${selected ? 'checked' : ''} /><span>${escapeHtml(choice.text)}${verdict ? `<span class="muted" style="display:block;margin-top:6px">${escapeHtml(verdict)}</span>` : ''}</span></label>`;
      }).join('');
      const review = pickedChoice && !pickedChoice.correct ? `<button type="button" class="btn btn-ghost btn-small" data-review-topic="${question.reviewTopicId}">Voltar nesse tópico</button>` : '';
      return `<fieldset class="stack" style="margin-top:12px"><legend style="font:var(--text-label-m)">${escapeHtml(question.prompt)}</legend>${choices}${review}</fieldset>`;
    }).join('') || '<p class="muted">Essa etapa ainda não tem perguntas.</p>';
    if (!$('quizDialog').open) $('quizDialog').showModal();
  }

  function bind() {
    $('quizDialog').addEventListener('change', (event) => {
      const input = event.target;
      if (!input.dataset.question) return;
      api.activeTrackState().quizAnswers[input.dataset.question] = input.value;
      persist(api.getState().activeTrackId);
      const view = api.activeView();
      let scope = 'topic';
      let owner = '';
      let questions = [];
      for (const phase of view.phases) {
        if ((phase.quiz || []).some((question) => question.id === input.dataset.question)) {
          scope = 'phase'; owner = phase.id; questions = phase.quiz;
        }
        for (const topic of phase.topics) {
          if ((topic.quiz || []).some((question) => question.id === input.dataset.question)) {
            scope = 'topic'; owner = topic.id; questions = topic.quiz;
          }
        }
      }
      openQuiz(scope, owner);
      if (quizScore(questions, api.activeTrackState().quizAnswers).needsReview) toast('Vale revisar. Não é nota.');
    });
    $('quizDialog').addEventListener('click', (event) => {
      const button = event.target.closest('[data-review-topic]');
      if (!button) return;
      $('quizDialog').close();
      api.focusTopic(button.dataset.reviewTopic);
    });
  }

  return { bind, openQuiz };
}
