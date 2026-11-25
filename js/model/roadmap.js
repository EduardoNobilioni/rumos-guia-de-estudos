import {
  LEVEL_RANK,
  LEVELS,
  clampHours,
  ensureTrack,
  foldText,
  isId,
  isPlainObject,
  normalizeLevel,
  STATUSES,
  sanitizeIdList,
  sanitizeLines,
  sanitizeCustomTopics,
  sanitizeCustomProjects,
  sanitizeOverrides,
  sanitizeTopicOrder,
  emptyTrackState,
  parseISODate,
  formatISODate,
  addUtcDays,
} from './storage.js';

export function naturalStatus(topic, trackState) {
  const userLevel = normalizeLevel(trackState.level) || 'iniciante';
  const topicLevel = normalizeLevel(topic.level) || 'iniciante';
  if (!trackState.includeBelowLevel && LEVEL_RANK[topicLevel] < LEVEL_RANK[userLevel]) {
    return 'optional';
  }
  return 'required';
}

export function effectiveStatus(topic, trackState) {
  const override = trackState.overrides && trackState.overrides[topic.id];
  if (STATUSES.includes(override)) return override;
  return naturalStatus(topic, trackState);
}

export function setTopicStatus(trackState, topic, status) {
  if (!STATUSES.includes(status)) return;
  const natural = naturalStatus(topic, trackState);
  if (!trackState.overrides) trackState.overrides = {};
  if (status === natural) delete trackState.overrides[topic.id];
  else trackState.overrides[topic.id] = status;
}

export function mergeOrder(naturalIds, savedOrder) {
  const natural = (naturalIds || []).filter(isId);
  const saved = sanitizeIdList(savedOrder).filter((id) => natural.includes(id));
  if (!saved.length) return natural.slice();
  const result = saved.slice();
  const seen = new Set(result);
  for (let i = 0; i < natural.length; i += 1) {
    const id = natural[i];
    if (seen.has(id)) continue;
    let insertAt = 0;
    for (let j = i - 1; j >= 0; j -= 1) {
      const prev = result.indexOf(natural[j]);
      if (prev !== -1) {
        insertAt = prev + 1;
        break;
      }
    }
    result.splice(insertAt, 0, id);
    seen.add(id);
  }
  return result;
}

export function moveId(list, id, direction) {
  const ids = list.slice();
  const index = ids.indexOf(id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= ids.length) return ids;
  const [item] = ids.splice(index, 1);
  ids.splice(next, 0, item);
  return ids;
}

export function topicsForPhase(phase, trackState) {
  const extraLinks = (topicId) => ((trackState.customLinks && trackState.customLinks[topicId]) || [])
    .map((resource) => ({ ...resource, custom: true }));
  const builtin = (phase.topics || []).map((topic) => ({
    ...topic,
    custom: false,
    resources: [...(topic.resources || []), ...extraLinks(topic.id)],
  }));
  const custom = (trackState.customTopics || [])
    .filter((topic) => topic.phaseId === phase.id)
    .map((topic) => ({
      ...topic,
      custom: true,
      tags: topic.tags || [],
      prerequisites: topic.prerequisites || [],
      resources: [...(topic.resources || []), ...extraLinks(topic.id)],
    }));
  return [...builtin, ...custom];
}

export function projectsForPhase(phase, trackState) {
  const builtin = (phase.projects || []).map((project) => ({
    ...project,
    custom: false,
    phaseId: phase.id,
  }));
  const custom = (trackState.customProjects || [])
    .filter((project) => project.phaseId === phase.id)
    .map((project) => ({ ...project, custom: true }));
  return [...builtin, ...custom].map((project) => ({
    ...project,
    level: normalizeLevel(project.level) || 'iniciante',
    steps: sanitizeLines(project.steps),
    definitionOfDone: sanitizeLines(project.definitionOfDone),
    done: !!(trackState.completedProjects && trackState.completedProjects[project.id]),
  }));
}

export const QUIZ_REVIEW_BELOW = 0.7;

export function quizScore(questions, answers = {}) {
  const list = Array.isArray(questions) ? questions : [];
  let answered = 0;
  let correct = 0;
  for (const question of list) {
    const choiceId = answers[question.id];
    if (!choiceId) continue;
    answered += 1;
    const choice = (question.choices || []).find((item) => item.id === choiceId);
    if (choice && choice.correct) correct += 1;
  }
  const total = list.length;
  const ratio = total ? correct / total : 1;
  return {
    total,
    answered,
    correct,
    ratio,
    complete: total > 0 && answered === total,
    needsReview: total > 0 && answered === total && ratio < QUIZ_REVIEW_BELOW,
  };
}

export function phaseDeadlines(phases, weeklyHours, startDate) {
  const start = parseISODate(startDate);
  const hoursPerWeek = clampHours(weeklyHours);
  if (!start || !hoursPerWeek) return [];
  let cursor = start;
  const events = [];
  for (const phase of phases) {
    const topicHours = (phase.topics || [])
      .filter((topic) => topic.status === 'required')
      .reduce((sum, topic) => sum + (Number(topic.hours) > 0 ? Number(topic.hours) : 0), 0);
    if (topicHours <= 0) continue;
    const days = Math.max(1, Math.ceil((topicHours / hoursPerWeek) * 7));
    const end = addUtcDays(cursor, days);
    events.push({
      phaseId: phase.id,
      title: `Etapa ${phase.number}: ${phase.title}`,
      start: formatISODate(cursor),
      end: formatISODate(end),
      hours: topicHours,
      days,
    });
    cursor = end;
  }
  return events;
}

export function phaseProgress(topics) {
  const visible = topics.filter((topic) => topic.status !== 'hidden');
  const required = visible.filter((topic) => topic.status === 'required');
  const pool = required.length ? required : visible;
  const done = pool.filter((topic) => topic.done).length;
  const total = pool.length;
  return {
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
    complete: total > 0 && done === total,
    requiredDone: required.filter((topic) => topic.done).length,
    requiredTotal: required.length,
    optionalTotal: visible.filter((topic) => topic.status === 'optional').length,
  };
}

export function buildRoadmap(track, trackState) {
  const phaseIds = mergeOrder(
    (track.phases || []).map((phase) => phase.id),
    trackState.phaseOrder,
  );
  const known = new Set(phaseIds);
  const phases = phaseIds.map((phaseId) => {
    const phase = track.phases.find((item) => item.id === phaseId);
    const natural = topicsForPhase(phase, trackState);
    const orderedIds = mergeOrder(
      natural.map((topic) => topic.id),
      trackState.topicOrder && trackState.topicOrder[phase.id],
    );
    const byId = new Map(natural.map((topic) => [topic.id, topic]));
    const topics = orderedIds.map((id) => {
      const topic = byId.get(id);
      return {
        ...topic,
        status: effectiveStatus(topic, trackState),
        done: !!(trackState.completed && trackState.completed[topic.id]),
        note: (trackState.notes && trackState.notes[topic.id]) || '',
      };
    });
    return {
      ...phase,
      topics,
      projects: projectsForPhase(phase, trackState),
      note: (trackState.phaseNotes && trackState.phaseNotes[phase.id]) || '',
      progress: phaseProgress(topics),
    };
  });

  const orphans = (trackState.customProjects || [])
    .filter((project) => !known.has(project.phaseId))
    .map((project) => ({
      ...project,
      custom: true,
      level: normalizeLevel(project.level) || 'iniciante',
      done: !!(trackState.completedProjects && trackState.completedProjects[project.id]),
    }));

  return { phases, orphans };
}

function combinedGroupPriority(levelRank, group) {
  if (levelRank === 0) return group === 'fundamentos' ? 0 : (group === 'tecnologia' ? 1 : 2);
  if (levelRank === 1) return group === 'fundamentos' ? 0 : (group === 'carreira' ? 1 : 2);
  return group === 'carreira' ? 0 : (group === 'tecnologia' ? 1 : 2);
}

function combinedStageKey(item) {
  const rank = item.effectiveRank ?? item.levelRank;
  if (rank === 0 && item.sourceGroup !== 'carreira') return 'base-fundamentos';
  if (rank === 0) return 'base-carreira';
  if (rank === 1) return 'intermediario';
  return 'avancado';
}

const COMBINED_STAGES = [
  { key: 'base-fundamentos', id: 'combined-base-fundamentos', title: 'Fundamentos e Base Inicial', badgeTitle: 'Base Inicial' },
  { key: 'base-carreira', id: 'combined-base-carreira', title: 'Primeiros Passos na Carreira', badgeTitle: 'Primeiros Passos' },
  { key: 'intermediario', id: 'combined-intermediario', title: 'Aprofundamento e Prática', badgeTitle: 'Aprofundamento' },
  { key: 'avancado', id: 'combined-avancado', title: 'Domínio e Produção', badgeTitle: 'Domínio' },
];

function dedupeSharedTopics(nodes) {
  const groups = new Map();
  for (const node of nodes) {
    const title = foldText(node.topic?.title || '');
    if (!title) continue;
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(node);
  }
  const drop = new Set();
  const alias = new Map();
  for (const group of groups.values()) {
    const tracks = new Set(group.map((node) => node.trackId));
    if (tracks.size < 2) continue;
    const ranked = group.slice().sort((a, b) => a.order - b.order);
    const kept = ranked[0];
    if (group.some((node) => node.topic.done)) {
      kept.topic = { ...kept.topic, done: true };
    }
    for (const other of ranked.slice(1)) {
      drop.add(other.key);
      alias.set(other.key, kept.key);
    }
  }
  if (!drop.size) return;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (drop.has(nodes[index].key)) nodes.splice(index, 1);
  }
  for (const node of nodes) {
    node.prereqKeys = (node.prereqKeys || []).map((key) => alias.get(key) || key);
  }
}

export const FULLSTACK_TRACK_ID = 'fullstack';
export const FRONTEND_TRACK_ID = 'frontend';

/** Carreiras cuja etapa de interface pede um framework. */
export const FRONTEND_CAREER_IDS = [FRONTEND_TRACK_ID, FULLSTACK_TRACK_ID];

/** Frameworks de interface com trilha. Svelte não entra: não há arquivo. */
export const FRONTEND_FRAMEWORK_IDS = ['react', 'vuejs', 'angular'];

const UI_FRAMEWORK_TOPIC_IDS = {
  fullstack: new Set(['f2-frameworks']),
  frontend: new Set(['fe-react', 'fe-state', 'fe-next']),
};

/**
 * Onde a carreira se divide e as trilhas que cobririam cada lado.
 * O passo só aparece se pelo menos duas opções existem no catálogo.
 */
export const CAREER_PATH_SPLITS = [
  { careerId: 'mobile', topicIds: ['mb-flutter'], optionIds: ['flutter', 'kotlin'] },
  { careerId: 'dados', topicIds: ['ds-python'], optionIds: ['python', 'r'] },
  { careerId: 'analista-dados', topicIds: ['ad-python'], optionIds: ['python', 'r'] },
  { careerId: 'engenharia-dados', topicIds: ['ed-python'], optionIds: ['python', 'r'] },
  { careerId: 'machine-learning', topicIds: ['ml-python'], optionIds: ['python', 'r'] },
  { careerId: 'game-dev', topicIds: ['game-engine'], optionIds: ['csharp', 'cpp'] },
  { careerId: 'devops', topicIds: ['do-aws'], optionIds: ['aws', 'azure', 'gcp'] },
  { careerId: 'cloud', topicIds: ['cl-aws'], optionIds: ['aws', 'azure', 'gcp'] },
];

export function careerSplitOptions(trackId, list) {
  const spec = CAREER_PATH_SPLITS.find((item) => item.careerId === trackId);
  if (!spec) return [];
  const byId = new Map((Array.isArray(list) ? list : []).filter((track) => track && track.id).map((track) => [track.id, track]));
  const options = spec.optionIds.map((id) => byId.get(id)).filter(Boolean);
  return options.length >= 2 ? options : [];
}

export function careerSplitReport(list) {
  return CAREER_PATH_SPLITS.map((spec) => {
    const ids = new Set((Array.isArray(list) ? list : []).map((track) => track && track.id));
    const present = spec.optionIds.filter((id) => ids.has(id));
    const missing = spec.optionIds.filter((id) => !ids.has(id));
    return { careerId: spec.careerId, offered: present.length >= 2, present, missing };
  });
}

export function needsCareerChoice(state, list) {
  if (!state?.profile?.onboarded) return false;
  const options = careerSplitOptions(state.activeTrackId, list);
  if (!options.length) return false;
  const chosen = state.profile.careerChoices && state.profile.careerChoices[state.activeTrackId];
  return !options.some((track) => track.id === chosen);
}

/** Linguagens de back-end com trilha. A oferta é a interseção com o catálogo, sem ordem de preferência. */
export const BACKEND_LANGUAGE_IDS = ['nodejs', 'python', 'java', 'csharp', 'php', 'go'];

/**
 * Ecossistema com trilha própria. Express, Fastify, Laravel e Spring moram dentro
 * da trilha da linguagem, então não viram um passo extra.
 */
export const BACKEND_ECOSYSTEM_IDS = {
  csharp: ['csharp-dotnet'],
};

/** Nó de linguagem no Full-Stack publicado (hoje Node). O resto da trilha não sai. */
const FULLSTACK_LANGUAGE_TOPIC_IDS = new Set(['f3-runtime']);
/** Nó de framework no Full-Stack publicado (hoje Express). Só sai se houver linguagem escolhida. */
const FULLSTACK_FRAMEWORK_TOPIC_IDS = new Set(['f3-frameworks-web']);
const BACKEND_ANCHOR_IDS = ['f3-rest-apis', 'f3-auth', 'f3-docs-testes', 'f3-authz', 'f3-seguranca', 'f3-realtime'];

export function blocksFullStackCompanion(trackId) {
  if (BACKEND_LANGUAGE_IDS.includes(trackId)) return true;
  return Object.values(BACKEND_ECOSYSTEM_IDS).some((ids) => ids.includes(trackId));
}

export function careerIncludesFrontend(trackId) {
  return FRONTEND_CAREER_IDS.includes(trackId);
}

export function frontendFrameworkChoices(list) {
  const byId = new Map((Array.isArray(list) ? list : []).filter((track) => track && track.id).map((track) => [track.id, track]));
  return FRONTEND_FRAMEWORK_IDS
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

export function needsFrontendFrameworkChoice(state, list) {
  if (!state?.profile?.onboarded || !careerIncludesFrontend(state.activeTrackId)) return false;
  const id = state.profile.frontendFrameworkId;
  if (!isId(id)) return true;
  if (Array.isArray(list) && !frontendFrameworkChoices(list).some((track) => track.id === id)) return true;
  return false;
}

export function backendLanguageChoices(list) {
  const byId = new Map((Array.isArray(list) ? list : []).filter((track) => track && track.id).map((track) => [track.id, track]));
  return BACKEND_LANGUAGE_IDS
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

export function backendEcosystemChoices(list, languageId) {
  const ids = BACKEND_ECOSYSTEM_IDS[languageId] || [];
  const byId = new Map((Array.isArray(list) ? list : []).filter((track) => track && track.id).map((track) => [track.id, track]));
  return ids.map((id) => byId.get(id)).filter((track) => track && track.id !== languageId);
}

export const MAX_COMPANION_FUNDAMENTALS = 2;
export const MAX_COMPANION_TECHNOLOGIES = 3;

const KNOWN_FUNDAMENTALS_IDS = new Set([
  'computacao',
  'algoritmos',
  'banco-de-dados',
  'engenharia-software',
  'redes-internet',
  'design-systems',
  'engenharia-prompt',
]);

export const CAREER_SUGGESTIONS = {
  frontend: {
    fundamentals: ['design-systems', 'redes-internet', 'algoritmos'],
    technologies: ['typescript', 'nextjs', 'git', 'graphql', 'javascript'],
  },
  backend: {
    fundamentals: ['banco-de-dados', 'redes-internet', 'engenharia-software', 'algoritmos'],
    technologies: ['nodejs', 'python', 'go', 'sql', 'docker', 'git'],
  },
  fullstack: {
    fundamentals: ['banco-de-dados', 'redes-internet', 'engenharia-software', 'design-systems'],
    technologies: ['typescript', 'sql', 'docker', 'git', 'graphql', 'mongodb'],
  },
  dados: {
    fundamentals: ['banco-de-dados', 'algoritmos', 'engenharia-prompt'],
    technologies: ['python', 'sql', 'power-bi', 'git', 'mongodb'],
  },
  'analista-dados': {
    fundamentals: ['banco-de-dados', 'engenharia-prompt'],
    technologies: ['sql', 'power-bi', 'python', 'git'],
  },
  'bi-analyst': {
    fundamentals: ['banco-de-dados', 'design-systems'],
    technologies: ['power-bi', 'sql', 'python', 'mongodb'],
  },
  'engenharia-dados': {
    fundamentals: ['banco-de-dados', 'algoritmos', 'redes-internet'],
    technologies: ['python', 'sql', 'mongodb', 'docker', 'linux', 'terraform'],
  },
  'machine-learning': {
    fundamentals: ['algoritmos', 'banco-de-dados', 'engenharia-prompt'],
    technologies: ['python', 'sql', 'docker', 'git', 'linux'],
  },
  'ai-engineer': {
    fundamentals: ['engenharia-prompt', 'algoritmos', 'engenharia-software'],
    technologies: ['python', 'typescript', 'docker', 'sql', 'git'],
  },
  mlops: {
    fundamentals: ['engenharia-software', 'redes-internet', 'banco-de-dados'],
    technologies: ['python', 'docker', 'kubernetes', 'linux', 'terraform', 'git'],
  },
  java: {
    fundamentals: ['engenharia-software', 'banco-de-dados', 'algoritmos'],
    technologies: ['sql', 'docker', 'git', 'linux', 'mongodb'],
  },
  'csharp-dotnet': {
    fundamentals: ['engenharia-software', 'banco-de-dados', 'algoritmos'],
    technologies: ['csharp', 'sql', 'docker', 'git'],
  },
  mobile: {
    fundamentals: ['design-systems', 'engenharia-software', 'redes-internet'],
    technologies: ['typescript', 'javascript', 'react', 'graphql', 'git'],
  },
  'game-dev': {
    fundamentals: ['algoritmos', 'computacao', 'engenharia-software'],
    technologies: ['git', 'python', 'rust'],
  },
  qa: {
    fundamentals: ['engenharia-software', 'redes-internet', 'banco-de-dados'],
    technologies: ['javascript', 'typescript', 'python', 'sql', 'git', 'docker'],
  },
  devops: {
    fundamentals: ['redes-internet', 'computacao', 'engenharia-software'],
    technologies: ['linux', 'docker', 'kubernetes', 'terraform', 'git', 'python'],
  },
  devsecops: {
    fundamentals: ['redes-internet', 'computacao', 'engenharia-software'],
    technologies: ['linux', 'docker', 'kubernetes', 'terraform', 'python', 'git'],
  },
  ciberseguranca: {
    fundamentals: ['redes-internet', 'computacao', 'banco-de-dados'],
    technologies: ['linux', 'python', 'docker', 'sql', 'git'],
  },
  'network-engineer': {
    fundamentals: ['redes-internet', 'computacao'],
    technologies: ['linux', 'python', 'docker', 'terraform', 'git'],
  },
  cloud: {
    fundamentals: ['redes-internet', 'banco-de-dados', 'computacao'],
    technologies: ['linux', 'docker', 'kubernetes', 'terraform', 'python', 'git'],
  },
  'arquitetura-software': {
    fundamentals: ['engenharia-software', 'banco-de-dados', 'redes-internet', 'algoritmos'],
    technologies: ['docker', 'kubernetes', 'sql', 'mongodb', 'graphql', 'go'],
  },
  'ux-ui': {
    fundamentals: ['design-systems', 'engenharia-prompt'],
    technologies: ['javascript', 'react', 'git'],
  },
  'product-manager': {
    fundamentals: ['engenharia-prompt', 'design-systems', 'banco-de-dados'],
    technologies: ['sql', 'power-bi', 'git'],
  },
};

const DEFAULT_SUGGESTIONS = {
  fundamentals: ['computacao', 'algoritmos', 'engenharia-software'],
  technologies: ['git', 'sql', 'python', 'javascript'],
};

export function isBlockedCompanion(trackId, candidateId, context = {}) {
  if (!isId(candidateId) || candidateId === trackId) return true;
  if (trackId === FULLSTACK_TRACK_ID && blocksFullStackCompanion(candidateId)) return true;
  if (careerIncludesFrontend(trackId) && FRONTEND_FRAMEWORK_IDS.includes(candidateId)) return true;
  if (context.backendLanguageId && candidateId === context.backendLanguageId) return true;
  if (Array.isArray(context.backendEcosystemIds) && context.backendEcosystemIds.includes(candidateId)) return true;
  if (context.frontendFrameworkId && candidateId === context.frontendFrameworkId) return true;
  if (context.careerChoiceId && candidateId === context.careerChoiceId) return true;
  return false;
}

export function companionOptionsForCareer(trackId, list, group, context = {}) {
  const tracks = (Array.isArray(list) ? list : []).filter(
    (track) => track && track.group === group && !isBlockedCompanion(trackId, track.id, context),
  );
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const mapKey = group === 'fundamentos' ? 'fundamentals' : 'technologies';
  const rawSuggested = CAREER_SUGGESTIONS[trackId]?.[mapKey] || DEFAULT_SUGGESTIONS[mapKey] || [];
  const suggested = [];
  const seen = new Set();
  for (const id of rawSuggested) {
    const item = byId.get(id);
    if (item && !seen.has(id)) {
      seen.add(id);
      suggested.push(item);
    }
  }
  const others = tracks.filter((track) => !seen.has(track.id));
  return { suggested, others };
}

export function filterCompanionSelection(rawIds, trackId, list = null, context = {}) {
  const byId = Array.isArray(list)
    ? new Map(list.filter((item) => item && item.id).map((item) => [item.id, item]))
    : null;
  let fundCount = 0;
  let techCount = 0;
  const out = [];
  for (const id of sanitizeIdList(rawIds || [])) {
    if (isBlockedCompanion(trackId, id, context)) continue;
    const group = byId?.get(id)?.group || (KNOWN_FUNDAMENTALS_IDS.has(id) ? 'fundamentos' : 'tecnologia');
    if (group === 'carreira') continue;
    if (group === 'fundamentos') {
      if (fundCount >= MAX_COMPANION_FUNDAMENTALS) continue;
      fundCount += 1;
      out.push(id);
    } else {
      if (techCount >= MAX_COMPANION_TECHNOLOGIES) continue;
      techCount += 1;
      out.push(id);
    }
  }
  return out;
}

export function fullstackOnboardingSteps(trackId, languageId, list) {
  const steps = ['career'];
  if (trackId === FULLSTACK_TRACK_ID) {
    steps.push('language');
    if (backendEcosystemChoices(list, languageId).length) steps.push('ecosystem');
  }
  if (careerIncludesFrontend(trackId) && frontendFrameworkChoices(list).length) steps.push('framework');
  if (careerSplitOptions(trackId, list).length) steps.push('path');
  steps.push('fundamentals', 'technologies', 'level', 'hours', 'preview');
  return steps;
}

export function needsBackendLanguageChoice(state, list) {
  if (!state?.profile?.onboarded || state.activeTrackId !== FULLSTACK_TRACK_ID) return false;
  const id = state.profile.backendLanguageId;
  if (!isId(id)) return true;
  if (Array.isArray(list) && !backendLanguageChoices(list).some((track) => track.id === id)) return true;
  return false;
}

function withoutFullStackSlots(track, dropIds) {
  if (!track || track.id !== FULLSTACK_TRACK_ID) return track;
  return {
    ...track,
    phases: (track.phases || []).map((phase) => ({
      ...phase,
      topics: (phase.topics || [])
        .filter((topic) => !dropIds.has(topic.id))
        .map((topic) => ({
          ...topic,
          prerequisites: (topic.prerequisites || []).filter((prereq) => !dropIds.has(prereq)),
        })),
    })),
  };
}

export function stripFullStackLanguageTopics(track) {
  const drop = new Set([...FULLSTACK_LANGUAGE_TOPIC_IDS, ...FULLSTACK_FRAMEWORK_TOPIC_IDS]);
  return withoutFullStackSlots(track, drop);
}

function topicsFromEntry(entry) {
  if (!entry?.track || !entry.trackState) return [];
  const built = buildRoadmap(entry.track, entry.trackState);
  const topics = [];
  for (const phase of built.phases) {
    for (const topic of phase.topics) {
      topics.push({
        ...topic,
        sourceTrackId: entry.track.id,
        sourceTrackName: entry.track.name,
        sourceGroup: entry.track.group || 'tecnologia',
      });
    }
  }
  return topics;
}

function dedupeLanguageTopics(existingTopics, incomingTopics) {
  const nodes = existingTopics.map((topic, index) => ({
    key: `keep::${index}::${topic.id}`,
    topic,
    trackId: topic.sourceTrackId || FULLSTACK_TRACK_ID,
    order: index,
  }));
  const offset = nodes.length;
  incomingTopics.forEach((topic, index) => {
    nodes.push({
      key: `lang::${topic.sourceTrackId}::${topic.id}`,
      topic,
      trackId: topic.sourceTrackId || 'linguagem',
      order: offset + index,
    });
  });
  dedupeSharedTopics(nodes);
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  existingTopics.forEach((topic, index) => {
    const node = byKey.get(`keep::${index}::${topic.id}`);
    if (node?.topic?.done) topic.done = true;
  });
  const incomingKeys = new Set(incomingTopics.map((topic) => `lang::${topic.sourceTrackId}::${topic.id}`));
  return nodes.filter((node) => incomingKeys.has(node.key)).map((node) => node.topic);
}

function backendHostPhase(view) {
  return view.phases.find((phase) => phase.topics.some((topic) => BACKEND_ANCHOR_IDS.includes(topic.id)))
    || view.phases.find((phase) => {
      const text = foldText(`${phase.title || ''} ${phase.badgeTitle || ''}`);
      return text.includes('backend') || text.includes('back-end');
    })
    || null;
}

/**
 * A trilha Full-Stack inteira permanece, na ordem publicada.
 * A linguagem escolhida troca só o nó de linguagem da etapa de back-end.
 * O framework, se houver um, troca só o nó de framework. HTTP, REST, banco, auth, teste e deploy ficam.
 */
export function resetTrackProgress(trackState) {
  if (!trackState) return trackState;
  trackState.completed = {};
  trackState.notes = {};
  trackState.phaseNotes = {};
  trackState.completedProjects = {};
  trackState.quizAnswers = {};
  trackState.doneResources = {};
  trackState.guideChecks = {};
  trackState.overrides = {};
  trackState.customTopics = [];
  trackState.customProjects = [];
  trackState.customLinks = {};
  trackState.phaseOrder = [];
  trackState.topicOrder = {};
  trackState.studyPlan = null;
  return trackState;
}

export function resetRoadmapSelection(state, trackId = state?.activeTrackId) {
  if (!state) return state;
  const targetId = trackId || state.activeTrackId;
  if (targetId && state.tracks?.[targetId]) {
    resetTrackProgress(state.tracks[targetId]);
    state.tracks[targetId].level = null;
    state.tracks[targetId].weeklyHours = null;
  }
  state.activeTrackId = null;
  if (state.profile) {
    state.profile.onboarded = false;
    state.profile.primaryTrackId = null;
    state.profile.companionIds = [];
    state.profile.backendLanguageId = null;
    state.profile.backendEcosystemIds = [];
    state.profile.frontendFrameworkId = null;
    if (targetId && state.profile.careerChoices) {
      delete state.profile.careerChoices[targetId];
    }
  }
  return state;
}

export function buildStudyRoadmap(entries, languageEntries = [], uiFrameworkEntry = null, careerChoiceEntry = null) {
  const list = (entries || []).filter((entry) => entry && entry.track && entry.trackState);
  const chosen = (languageEntries || []).filter((entry) => entry && entry.track && entry.trackState);
  const hasFullstack = list.some((entry) => entry.track.id === FULLSTACK_TRACK_ID);
  const career = list.find((entry) => careerIncludesFrontend(entry.track.id));
  const finish = (view) => {
    if (career && uiFrameworkEntry?.track && uiFrameworkEntry.trackState && !list.some((entry) => entry.track.id === uiFrameworkEntry.track.id)) {
      spliceUiFramework(view, career.track.id, uiFrameworkEntry);
      for (const phase of view.phases) phase.progress = phaseProgress(phase.topics);
      view.frontendFrameworkName = uiFrameworkEntry.track.name;
    }
    const careerId = list[0]?.track?.id;
    const spec = CAREER_PATH_SPLITS.find((item) => item.careerId === careerId);
    if (spec && careerChoiceEntry?.track && careerChoiceEntry.trackState && spec.optionIds.includes(careerChoiceEntry.track.id)) {
      const drop = new Set(spec.topicIds);
      let host = null;
      for (const phase of view.phases) {
        if (phase.topics.some((topic) => drop.has(topic.id))) host = phase;
      }
      for (const phase of view.phases) {
        phase.topics = phase.topics
          .filter((topic) => !drop.has(topic.id))
          .map((topic) => ({
            ...topic,
            prerequisites: (topic.prerequisites || []).filter((id) => !drop.has(id)),
          }));
      }
      if (host) {
        const incoming = dedupeLanguageTopics(view.phases.flatMap((phase) => phase.topics), topicsFromEntry(careerChoiceEntry));
        const index = host.topics.findIndex((topic) => (topic.prerequisites || []).some((id) => drop.has(id)));
        const insertAt = index >= 0 ? index : host.topics.length;
        host.topics = [...host.topics.slice(0, insertAt), ...incoming, ...host.topics.slice(insertAt)];
      }
      for (const phase of view.phases) phase.progress = phaseProgress(phase.topics);
      view.careerChoiceName = careerChoiceEntry.track.name;
    }
    return view;
  };
  if (!hasFullstack || !chosen.length) return finish(buildCombinedRoadmap(list));

  const present = new Set(list.map((entry) => entry.track.id));
  const language = chosen[0] && !present.has(chosen[0].track.id) ? chosen[0] : null;
  const framework = chosen[1] && !present.has(chosen[1].track.id) ? chosen[1] : null;
  const drop = new Set(FULLSTACK_LANGUAGE_TOPIC_IDS);
  if (language || framework) FULLSTACK_FRAMEWORK_TOPIC_IDS.forEach((id) => drop.add(id));
  const stripped = list.map((entry) => (
    entry.track.id === FULLSTACK_TRACK_ID
      ? { ...entry, track: withoutFullStackSlots(entry.track, drop) }
      : entry
  ));
  const view = buildCombinedRoadmap(stripped);
  const host = backendHostPhase(view);
  if (host) {
    const existing = view.phases.flatMap((phase) => phase.topics);
    const languageTopics = language ? dedupeLanguageTopics(existing, topicsFromEntry(language)) : [];
    const frameworkTopics = framework
      ? dedupeLanguageTopics([...existing, ...languageTopics], topicsFromEntry(framework))
      : [];
    if (languageTopics.length || frameworkTopics.length) {
      host.topics = [...languageTopics, ...frameworkTopics, ...host.topics];
    }
  }
  for (const phase of view.phases) phase.progress = phaseProgress(phase.topics);
  view.backendLanguageName = chosen[0].track.name;
  view.backendStackNames = [chosen[0].track.name, framework?.track?.name].filter(Boolean);
  return finish(view);
}

function spliceUiFramework(view, careerId, entry) {
  const drop = UI_FRAMEWORK_TOPIC_IDS[careerId];
  if (!drop || !entry) return view;
  let host = null;
  for (const phase of view.phases) {
    if (phase.topics.some((topic) => drop.has(topic.id))) host = phase;
  }
  for (const phase of view.phases) {
    phase.topics = phase.topics
      .filter((topic) => !drop.has(topic.id))
      .map((topic) => ({
        ...topic,
        prerequisites: (topic.prerequisites || []).filter((id) => !drop.has(id)),
      }));
  }
  if (!host) {
    const anchor = careerId === FULLSTACK_TRACK_ID ? ['f2-html5', 'f2-js-base'] : ['fe-vite', 'fe-ts'];
    host = view.phases.find((phase) => phase.topics.some((topic) => anchor.includes(topic.id))) || null;
  }
  if (!host) return view;
  const incoming = dedupeLanguageTopics(view.phases.flatMap((phase) => phase.topics), topicsFromEntry(entry));
  const afterId = careerId === FULLSTACK_TRACK_ID ? 'f2-estado-estilo' : 'fe-ts';
  const index = host.topics.findIndex((topic) => topic.id === afterId);
  const at = careerId === FRONTEND_TRACK_ID
    ? (index >= 0 ? index + 1 : host.topics.length)
    : (index >= 0 ? index : host.topics.length);
  host.topics = [...host.topics.slice(0, at), ...incoming, ...host.topics.slice(at)];
  return view;
}

/** Espinha = tópicos obrigatórios da trilha. Opcional e trilha paralela saem para o lado. */
export function layoutStudyMap(phases, { branchTrackIds = [] } = {}) {
  const branchIds = new Set(branchTrackIds);
  return (phases || []).map((phase) => {
    const spine = [];
    const branches = [];
    for (const topic of phase.topics || []) {
      if (topic.status === 'hidden') continue;
      const side = topic.status === 'optional' || (topic.sourceTrackId && branchIds.has(topic.sourceTrackId));
      if (side) branches.push(topic);
      else spine.push(topic);
    }
    if (!spine.length && branches.length) spine.push(branches.shift());
    return { phase, spine, branches };
  }).filter((stop) => stop.spine.length || stop.branches.length);
}

export function buildCombinedRoadmap(entries) {
  const valid = (entries || []).filter((e) => e && e.track && e.trackState);
  if (!valid.length) return { phases: [], orphans: [], combined: false };
  if (valid.length === 1) {
    const { track, trackState } = valid[0];
    const single = buildRoadmap(track, trackState);
    return {
      combined: false,
      phases: single.phases.map((phase) => ({
        ...phase,
        topics: phase.topics.map((topic) => ({
          ...topic,
          sourceTrackId: track.id,
          sourceTrackName: track.name,
          sourceGroup: track.group || 'carreira',
        })),
        projects: (phase.projects || []).map((project) => ({
          ...project,
          sourceTrackId: track.id,
          sourceTrackName: track.name,
        })),
      })),
      orphans: single.orphans,
    };
  }

  const nodes = [];
  const projectsByKey = new Map();
  let seq = 0;

  for (const { track, trackState } of valid) {
    const view = buildRoadmap(track, trackState);
    const totalPhases = Math.max(1, view.phases.length);
    view.phases.forEach((phase, phaseIndex) => {
      const phaseRatio = totalPhases > 1 ? phaseIndex / (totalPhases - 1) : 0;
      for (const topic of phase.topics) {
        const level = normalizeLevel(topic.level) || 'iniciante';
        const levelRank = LEVEL_RANK[level] ?? 0;
        const isCheckpoint = /\bcheckpoint\b/i.test(topic.title || '') ? 1 : 0;
        const key = `${track.id}::${topic.id}`;
        nodes.push({
          key,
          topic: {
            ...topic,
            sourceTrackId: track.id,
            sourceTrackName: track.name,
            sourceGroup: track.group || 'carreira',
          },
          trackId: track.id,
          sourceGroup: track.group || 'carreira',
          levelRank,
          isCheckpoint,
          groupPriority: combinedGroupPriority(levelRank, track.group || 'carreira'),
          phaseRatio,
          order: seq++,
          prereqKeys: (topic.prerequisites || []).map((pid) => `${track.id}::${pid}`),
        });
      }
      for (const project of phase.projects || []) {
        const pLevel = normalizeLevel(project.level) || 'iniciante';
        const pRank = LEVEL_RANK[pLevel] ?? 0;
        const sKey = pRank === 0 ? 'base-carreira' : (pRank === 1 ? 'intermediario' : 'avancado');
        if (!projectsByKey.has(sKey)) projectsByKey.set(sKey, []);
        projectsByKey.get(sKey).push({
          ...project,
          sourceTrackId: track.id,
          sourceTrackName: track.name,
        });
      }
    });
  }

  dedupeSharedTopics(nodes);

  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const inDegree = new Map();
  const dependents = new Map();
  for (const n of nodes) {
    inDegree.set(n.key, 0);
    dependents.set(n.key, []);
  }
  for (const n of nodes) {
    for (const pk of n.prereqKeys) {
      if (byKey.has(pk) && pk !== n.key) {
        inDegree.set(n.key, inDegree.get(n.key) + 1);
        dependents.get(pk).push(n.key);
      }
    }
  }

  const compareNodes = (a, b) => (
    a.levelRank - b.levelRank
    || a.isCheckpoint - b.isCheckpoint
    || a.groupPriority - b.groupPriority
    || a.phaseRatio - b.phaseRatio
    || a.order - b.order
  );

  const ready = nodes.filter((n) => inDegree.get(n.key) === 0).sort(compareNodes);
  const sorted = [];
  const visited = new Set();

  while (ready.length) {
    const current = ready.shift();
    if (visited.has(current.key)) continue;
    visited.add(current.key);
    sorted.push(current);
    for (const depKey of dependents.get(current.key)) {
      const nextDeg = inDegree.get(depKey) - 1;
      inDegree.set(depKey, nextDeg);
      if (nextDeg === 0) {
        ready.push(byKey.get(depKey));
        ready.sort(compareNodes);
      }
    }
  }

  if (sorted.length < nodes.length) {
    const rest = nodes.filter((n) => !visited.has(n.key)).sort(compareNodes);
    sorted.push(...rest);
  }

  for (const item of sorted) {
    let eff = item.levelRank;
    for (const pk of item.prereqKeys) {
      const parent = byKey.get(pk);
      if (parent && parent.effectiveRank > eff) eff = parent.effectiveRank;
    }
    item.effectiveRank = eff;
  }

  const grouped = new Map();
  for (const item of sorted) {
    const sKey = combinedStageKey(item);
    if (!grouped.has(sKey)) grouped.set(sKey, []);
    grouped.get(sKey).push(item.topic);
  }

  const phases = [];
  let number = 1;
  for (const stage of COMBINED_STAGES) {
    const topics = grouped.get(stage.key) || [];
    if (!topics.length) continue;
    phases.push({
      id: stage.id,
      number: number++,
      title: stage.title,
      badgeTitle: stage.badgeTitle,
      topics,
      projects: projectsByKey.get(stage.key) || [],
      quiz: [],
      note: '',
      progress: phaseProgress(topics),
    });
  }

  return { phases, orphans: [], combined: true };
}

export function roadmapStats(phases) {
  let required = 0;
  let requiredDone = 0;
  let optional = 0;
  let optionalDone = 0;
  let hidden = 0;
  let hours = 0;
  let hoursLeft = 0;
  let badges = 0;

  for (const phase of phases) {
    if (phase.progress && phase.progress.complete) badges += 1;
    for (const topic of phase.topics) {
      const topicHours = Number(topic.hours) > 0 ? Number(topic.hours) : 0;
      if (topic.status === 'hidden') {
        hidden += 1;
        continue;
      }
      if (topic.status === 'optional') {
        optional += 1;
        if (topic.done) optionalDone += 1;
        continue;
      }
      required += 1;
      hours += topicHours;
      if (topic.done) requiredDone += 1;
      else hoursLeft += topicHours;
    }
  }

  return {
    required,
    requiredDone,
    optional,
    optionalDone,
    hidden,
    hours,
    hoursLeft,
    percent: required ? Math.round((requiredDone / required) * 100) : 0,
    badges,
    phases: phases.length,
  };
}

export function projectPlanStats(phases, level) {
  let total = 0;
  let done = 0;
  let hours = 0;
  for (const phase of phases) {
    for (const project of phase.projects || []) {
      if (project.level !== level) continue;
      total += 1;
      hours += Number(project.hours) > 0 ? Number(project.hours) : 0;
      if (project.done) done += 1;
    }
  }
  return { total, done, hours };
}

export function visibleProjects(projects, level, showAll) {
  if (showAll) return projects;
  return projects.filter((project) => project.level === level);
}

export function formatDuration(hours, weeklyHours) {
  const roundedHours = Math.round(Number(hours) || 0);
  const hourLabel = `${roundedHours.toLocaleString('pt-BR')} h`;
  if (!weeklyHours || weeklyHours <= 0 || roundedHours <= 0) return hourLabel;
  const weeks = Number(hours) / weeklyHours;
  if (weeks < 0.8) {
    const days = Math.max(1, Math.round(weeks * 7));
    return `${hourLabel} · ${days === 1 ? 'cerca de 1 dia' : `cerca de ${days} dias`}`;
  }
  const rounded = weeks < 10 ? Math.round(weeks * 2) / 2 : Math.round(weeks);
  const num = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  const unit = rounded === 1 ? 'semana' : 'semanas';
  return `${hourLabel} · cerca de ${num} ${unit}`;
}

export function currentPhase(phases) {
  for (const phase of phases) {
    const required = phase.topics.filter((topic) => topic.status === 'required');
    if (!required.length) continue;
    if (required.some((topic) => !topic.done)) return phase;
  }
  return null;
}

export function sharePlanFromTrack(state, trackId) {
  const track = state.tracks[trackId];
  if (!track || !track.level || !track.weeklyHours) return null;
  const plan = {
    v: 1,
    t: trackId,
    l: track.level,
    h: track.weeklyHours,
    b: track.includeBelowLevel ? 1 : 0,
  };
  if (track.showAllProjectLevels) plan.s = 1;
  if (track.overrides && Object.keys(track.overrides).length) plan.o = track.overrides;
  if (track.customTopics && track.customTopics.length) plan.c = track.customTopics;
  if (track.customProjects && track.customProjects.length) plan.p = track.customProjects;
  if (track.phaseOrder && track.phaseOrder.length) plan.po = track.phaseOrder;
  if (track.topicOrder && Object.keys(track.topicOrder).length) plan.to = track.topicOrder;
  return plan;
}

export function applySharePlan(state, plan) {
  if (!isPlainObject(plan) || plan.v !== 1 || !isId(plan.t)) {
    throw new Error('Plano compartilhado inválido.');
  }
  const level = normalizeLevel(plan.l);
  const hours = clampHours(plan.h);
  if (!level || !hours) throw new Error('Plano compartilhado inválido.');

  const previous = state.tracks[plan.t];
  const kept = previous
    ? {
      completed: previous.completed,
      notes: previous.notes,
      phaseNotes: previous.phaseNotes,
      completedProjects: previous.completedProjects,
      collapsedPhases: previous.collapsedPhases,
      quizAnswers: previous.quizAnswers,
      guideChecks: previous.guideChecks,
      studyPlan: previous.studyPlan,
    }
    : null;

  const track = ensureTrack(state, plan.t);
  track.level = level;
  track.weeklyHours = hours;
  track.includeBelowLevel = plan.b === 1 || plan.b === true;
  track.showAllProjectLevels = plan.s === 1 || plan.s === true;
  track.overrides = sanitizeOverrides(plan.o);
  track.customTopics = sanitizeCustomTopics(plan.c);
  track.customProjects = sanitizeCustomProjects(plan.p);
  track.phaseOrder = sanitizeIdList(plan.po);
  track.topicOrder = sanitizeTopicOrder(plan.to);
  if (kept) {
    track.completed = kept.completed;
    track.notes = kept.notes;
    track.phaseNotes = kept.phaseNotes;
    track.completedProjects = kept.completedProjects;
    track.collapsedPhases = kept.collapsedPhases;
    track.quizAnswers = kept.quizAnswers;
    track.guideChecks = kept.guideChecks;
    track.studyPlan = kept.studyPlan;
  }
  state.activeTrackId = plan.t;
  state.profile.onboarded = true;
  return state;
}

export function applyStudySelection(state, selection) {
  const trackId = selection && selection.trackId;
  const level = normalizeLevel(selection && selection.level);
  const hours = clampHours(selection && selection.hours);
  if (!isId(trackId) || !level || !hours) {
    throw new Error('Seleção de estudo inválida.');
  }
  const languageId = isId(selection.backendLanguageId) ? selection.backendLanguageId : null;
  const uiFrameworkId = isId(selection.frontendFrameworkId) ? selection.frontendFrameworkId : null;
  if (trackId === FULLSTACK_TRACK_ID && !languageId) {
    throw new Error('Escolhe a linguagem do back-end.');
  }
  if (careerIncludesFrontend(trackId) && !uiFrameworkId) {
    throw new Error('Escolha o framework de front-end.');
  }
  const ecosystemIds = sanitizeIdList(selection.backendEcosystemIds || [])
    .filter((id) => id !== trackId && id !== languageId)
    .slice(0, 1);
  const companionIds = filterCompanionSelection(
    selection.companionIds || [],
    trackId,
    selection.catalog || null,
    {
      backendLanguageId: trackId === FULLSTACK_TRACK_ID ? languageId : null,
      backendEcosystemIds: trackId === FULLSTACK_TRACK_ID ? ecosystemIds : [],
      frontendFrameworkId: careerIncludesFrontend(trackId) ? uiFrameworkId : null,
      careerChoiceId: isId(selection.careerChoiceId) ? selection.careerChoiceId : null,
    },
  );

  const adapt = (id) => {
    const track = ensureTrack(state, id);
    track.level = level;
    track.weeklyHours = hours;
    track.includeBelowLevel = false;
    track.overrides = {};
    if (track.studyPlan) track.studyPlan.weeklyHours = hours;
    return track;
  };

  adapt(trackId);
  companionIds.forEach(adapt);
  if (trackId === FULLSTACK_TRACK_ID) {
    state.profile.backendLanguageId = languageId;
    state.profile.backendEcosystemIds = ecosystemIds;
    adapt(languageId);
    ecosystemIds.forEach(adapt);
  }
  if (careerIncludesFrontend(trackId)) {
    state.profile.frontendFrameworkId = uiFrameworkId;
    adapt(uiFrameworkId);
  }
  if (!state.profile.careerChoices || typeof state.profile.careerChoices !== 'object') state.profile.careerChoices = {};
  if (isId(selection.careerChoiceId)) state.profile.careerChoices[trackId] = selection.careerChoiceId;
  state.profile.primaryTrackId = trackId;
  state.profile.companionIds = companionIds;
  state.activeTrackId = trackId;
  state.profile.onboarded = true;
  return state;
}

export function newId(prefix) {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now().toString(36)}${token}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}
