import {
  LEVELS,
  RESOURCE_KINDS,
  isId,
  isPlainObject,
  normalizeLevel,
} from './storage.js';

export function validateTrack(data) {
  const errors = [];
  if (!isPlainObject(data)) return ['A trilha precisa ser um objeto JSON.'];
  if (!isId(data.id)) errors.push('O id da trilha é obrigatório e deve usar letras, números e hífen.');
  for (const field of ['name', 'tagline', 'description']) {
    if (typeof data[field] !== 'string' || !data[field].trim()) {
      errors.push(`Campo "${field}" é obrigatório.`);
    }
  }
  if (!Array.isArray(data.phases) || data.phases.length === 0) {
    errors.push('A trilha precisa de uma lista "phases" com ao menos uma etapa.');
    return errors;
  }

  const phaseIds = new Set();
  const topicIds = new Set();
  const projectIds = new Set();
  const questionIds = new Set();
  const reviewPointers = [];

  function validateQuiz(questions, label, ownerTopicId) {
    if (questions == null) return;
    if (!Array.isArray(questions) || questions.length < 2) {
      errors.push(`${label}: quiz precisa de ao menos duas perguntas.`);
      return;
    }
    for (const question of questions) {
      if (!isPlainObject(question) || !isId(question.id)) {
        errors.push(`${label}: pergunta sem id válido.`);
        continue;
      }
      if (questionIds.has(question.id)) errors.push(`Pergunta duplicada: ${question.id}.`);
      questionIds.add(question.id);
      if (typeof question.prompt !== 'string' || question.prompt.trim().length < 8) {
        errors.push(`${question.id}: prompt curto demais.`);
      }
      if (!Array.isArray(question.choices) || question.choices.length < 2) {
        errors.push(`${question.id}: inclua ao menos duas alternativas.`);
        continue;
      }
      const correct = question.choices.filter((choice) => choice && choice.correct === true);
      if (correct.length !== 1) errors.push(`${question.id}: marque exatamente uma alternativa correta.`);
      const choiceIds = new Set();
      for (const choice of question.choices) {
        if (!isPlainObject(choice) || !isId(choice.id)) {
          errors.push(`${question.id}: alternativa sem id.`);
          continue;
        }
        if (choiceIds.has(choice.id)) errors.push(`${question.id}: alternativa duplicada.`);
        choiceIds.add(choice.id);
        if (typeof choice.text !== 'string' || !choice.text.trim()) errors.push(`${question.id}: alternativa sem texto.`);
        if (typeof choice.explanation !== 'string' || choice.explanation.trim().length < 8) {
          errors.push(`${question.id}: cada alternativa precisa de uma explicação curta.`);
        }
      }
      const reviewId = question.reviewTopicId || ownerTopicId;
      if (!isId(reviewId)) errors.push(`${question.id}: aponte reviewTopicId para um tópico.`);
      else reviewPointers.push([question.id, reviewId]);
    }
  }

  data.phases.forEach((phase, index) => {
    const label = phase && phase.id ? phase.id : `etapa ${index + 1}`;
    if (!isPlainObject(phase) || !isId(phase.id)) errors.push(`${label}: id de etapa inválido.`);
    else if (phaseIds.has(phase.id)) errors.push(`${label}: id de etapa duplicado.`);
    else phaseIds.add(phase.id);
    if (!phase || typeof phase.title !== 'string' || !phase.title.trim()) errors.push(`${label}: title obrigatório.`);
    if (!phase || typeof phase.badgeTitle !== 'string' || !phase.badgeTitle.trim()) {
      errors.push(`${label}: badgeTitle obrigatório.`);
    }
    if (!phase || !Array.isArray(phase.topics) || phase.topics.length === 0) {
      errors.push(`${label}: inclua ao menos um tópico.`);
    }
    for (const topic of (phase && phase.topics) || []) {
      if (!isPlainObject(topic) || !isId(topic.id)) {
        errors.push(`${label}: tópico sem id válido.`);
        continue;
      }
      if (topicIds.has(topic.id)) errors.push(`Tópico duplicado: ${topic.id}.`);
      topicIds.add(topic.id);
      if (!normalizeLevel(topic.level)) errors.push(`${topic.id}: level deve ser iniciante, intermediario ou avancado.`);
      if (!(Number(topic.hours) > 0)) errors.push(`${topic.id}: hours deve ser um número maior que zero.`);
      if (typeof topic.title !== 'string' || !topic.title.trim()) errors.push(`${topic.id}: title obrigatório.`);
      if (typeof topic.description !== 'string' || !topic.description.trim()) {
        errors.push(`${topic.id}: description obrigatória.`);
      }
      if (!Array.isArray(topic.tags)) errors.push(`${topic.id}: tags deve ser uma lista.`);
      if (!Array.isArray(topic.prerequisites)) errors.push(`${topic.id}: prerequisites deve ser uma lista.`);
      if (!Array.isArray(topic.resources) || topic.resources.length === 0) {
        errors.push(`${topic.id}: inclua ao menos um recurso gratuito.`);
      }
      for (const resource of topic.resources || []) {
        if (!isPlainObject(resource) || typeof resource.title !== 'string' || !resource.title.trim()) {
          errors.push(`${topic.id}: recurso sem título.`);
          continue;
        }
        if (typeof resource.url !== 'string' || !/^https?:\/\//i.test(resource.url)) {
          errors.push(`${topic.id}: URL inválida em "${resource.title}".`);
        }
        if (resource.lang !== 'pt' && resource.lang !== 'en') errors.push(`${topic.id}: lang deve ser pt ou en.`);
        if (!RESOURCE_KINDS.includes(resource.kind)) {
          errors.push(`${topic.id}: kind inválido. Use leitura, curso, documentacao, pratica ou video.`);
        }
      }
      if (topic.quiz) validateQuiz(topic.quiz, topic.id, topic.id);
    }
    if (!phase || !Array.isArray(phase.quiz) || phase.quiz.length < 2) {
      errors.push(`${label}: inclua um quiz com ao menos duas perguntas.`);
    } else {
      validateQuiz(phase.quiz, label);
    }

    if (!phase || !Array.isArray(phase.projects) || phase.projects.length === 0) {
      errors.push(`${label}: inclua ideias de projeto em "projects".`);
    }
    const levels = new Set();
    for (const project of (phase && phase.projects) || []) {
      if (!isPlainObject(project) || !isId(project.id)) {
        errors.push(`${label}: projeto sem id válido.`);
        continue;
      }
      if (projectIds.has(project.id) || topicIds.has(project.id)) {
        errors.push(`Id de projeto duplicado: ${project.id}.`);
      }
      projectIds.add(project.id);
      const level = normalizeLevel(project.level);
      if (!level) errors.push(`${project.id}: level de projeto inválido.`);
      else levels.add(level);
      if (typeof project.title !== 'string' || !project.title.trim()) errors.push(`${project.id}: title obrigatório.`);
      if (typeof project.description !== 'string' || !project.description.trim()) {
        errors.push(`${project.id}: description obrigatória.`);
      }
      for (const field of ['steps', 'definitionOfDone']) {
        if (project[field] == null) continue;
        if (!Array.isArray(project[field]) || project[field].some((line) => typeof line !== 'string' || !line.trim())) {
          errors.push(`${project.id}: ${field} deve ser uma lista de textos.`);
        }
      }
    }
    for (const level of LEVELS) {
      if (!levels.has(level)) errors.push(`${label}: falta um projeto de nível ${level}.`);
    }
  });

  for (const phase of data.phases) {
    for (const topic of (phase && phase.topics) || []) {
      for (const prerequisite of (topic && topic.prerequisites) || []) {
        if (!topicIds.has(prerequisite)) {
          errors.push(`${topic.id}: pré-requisito "${prerequisite}" não existe nesta trilha.`);
        }
      }
    }
  }
  for (const [questionId, reviewId] of reviewPointers) {
    if (!topicIds.has(reviewId)) errors.push(`${questionId}: reviewTopicId "${reviewId}" não existe.`);
  }

  return errors;
}
