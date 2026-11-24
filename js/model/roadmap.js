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
  const companionIds = sanitizeIdList(selection.companionIds || [])
    .filter((id) => id !== trackId)
    .slice(0, 6);

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
