/**
 * Monta sessões de estudo em volta da grade e dos horários travados.
 */

import { addUtcDays, clampHours, formatISODate, parseISODate } from './model.js';

export const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function localISODate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function toMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function fromMinutes(total) {
  const clamped = Math.max(0, Math.min(24 * 60, total));
  const hour = Math.floor(clamped / 60) % 24;
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function suggestSlot(weeklyHours, dayCount) {
  const days = Math.max(1, dayCount);
  const minutes = Math.round((clampHours(weeklyHours) * 60) / days);
  const duration = Math.min(180, Math.max(45, minutes));
  let end = 19 * 60 + duration;
  let start = 19 * 60;
  if (end > 23 * 60) {
    end = 23 * 60;
    start = end - duration;
  }
  return { start: fromMinutes(start), end: fromMinutes(end) };
}

export function syncPlanWeeklyHours(plan, weeklyHours) {
  if (!plan) return plan;
  const hours = clampHours(weeklyHours);
  if (!hours) return plan;
  plan.weeklyHours = hours;
  const days = Math.max(1, (plan.weekdays || []).length);
  const slot = suggestSlot(hours, days);
  plan.slots = plan.slots || {};
  for (const day of plan.weekdays || []) {
    plan.slots[day] = { ...slot };
  }
  return plan;
}

export function defaultStudyPlan(weeklyHours = 10) {
  const weekdays = [1, 2, 3, 4, 5];
  const slot = suggestSlot(weeklyHours, weekdays.length);
  const slots = {};
  weekdays.forEach((day) => { slots[day] = { ...slot }; });
  return {
    startDate: localISODate(),
    weekdays,
    slots,
    weeklyHours: clampHours(weeklyHours) || 10,
    includeOptional: false,
    includeProjects: true,
    includeReviews: true,
    includeCompanions: true,
    spacedReview: false,
    minBlockMinutes: 30,
    maxBlockMinutes: 90,
    skippedDates: [],
    sessions: [],
    university: emptyUniversity(),
  };
}

export function emptyUniversity() {
  return {
    bufferBefore: 15,
    bufferAfter: 15,
    examLoadPercent: 50,
    examRanges: [],
    manual: [],
    busy: [],
  };
}

function orderTopics(topics) {
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  const seen = new Set();
  const ordered = [];
  function visit(topic) {
    if (!topic || seen.has(topic.id)) return;
    seen.add(topic.id);
    for (const prerequisite of topic.prerequisites || []) visit(byId.get(prerequisite));
    ordered.push(topic);
  }
  topics.forEach(visit);
  return ordered;
}

export function buildWorkItems(view, level, options) {
  const items = [];
  const answers = options.quizAnswers || {};
  const reviewTopicIds = new Set();
  for (const phase of view.phases) {
    for (const q of phase.quiz || []) {
      const chosen = answers[q.id];
      if (!chosen) continue;
      const choice = (q.choices || []).find((c) => c.id === chosen);
      if (choice && !choice.correct && q.reviewTopicId) reviewTopicIds.add(q.reviewTopicId);
    }
    for (const t of phase.topics || []) {
      for (const q of t.quiz || []) {
        const chosen = answers[q.id];
        if (!chosen) continue;
        const choice = (q.choices || []).find((c) => c.id === chosen);
        if (choice && !choice.correct) reviewTopicIds.add(q.reviewTopicId || t.id);
      }
    }
  }
  for (const phase of view.phases) {
    for (const topic of phase.topics || []) {
      if (!reviewTopicIds.has(topic.id)) continue;
      items.push({
        kind: 'review',
        refId: topic.id,
        phaseId: phase.id,
        trackId: options.trackId || '',
        trackName: options.trackName || '',
        title: `Reforço (Revisar): ${topic.title}`,
        minutes: 30,
        summary: 'Tópico sinalizado para revisão na autoavaliação.',
        links: (topic.resources || []).map((resource) => ({ title: resource.title, url: resource.url })),
      });
    }
    const topics = orderTopics(phase.topics.filter((topic) => {
      if (topic.status === 'hidden') return false;
      if (topic.status === 'optional' && !options.includeOptional) return false;
      if (options.skipDone && topic.done) return false;
      return true;
    }));
    for (const topic of topics) {
      items.push({
        kind: 'topic',
        refId: topic.id,
        phaseId: phase.id,
        trackId: options.trackId || '',
        trackName: options.trackName || '',
        title: topic.title,
        minutes: Math.max(30, Math.round((Number(topic.hours) || 1) * 60)),
        summary: topic.description || '',
        links: (topic.resources || []).map((resource) => ({ title: resource.title, url: resource.url })),
      });
    }
    if (options.includeProjects) {
      for (const project of phase.projects || []) {
        if (project.level !== level) continue;
        if (options.skipDone && project.done) continue;
        items.push({
          kind: 'project',
          refId: project.id,
          phaseId: phase.id,
          trackId: options.trackId || '',
          trackName: options.trackName || '',
          title: `Projeto: ${project.title}`,
          minutes: Math.max(45, Math.round((Number(project.hours) || 2) * 60)),
          summary: project.description || '',
          links: [],
        });
      }
    }
    if (options.includeReviews && Array.isArray(phase.quiz) && phase.quiz.length) {
      items.push({
        kind: 'review',
        refId: phase.id,
        phaseId: phase.id,
        trackId: options.trackId || '',
        trackName: options.trackName || '',
        title: `Revisão: ${phase.title}`,
        minutes: 45,
        summary: 'Autoavaliação da etapa. Se errar, volte ao tópico indicado.',
        links: [],
      });
    }
  }
  return items;
}

export function interleaveWorkItems(primaryItems, companionLists) {
  const queues = (companionLists || []).map((list) => [...list]).filter((list) => list.length > 0);
  if (!queues.length) return [...primaryItems];
  const out = [];
  const main = [...primaryItems];
  let compIndex = 0;
  while (main.length || queues.some((q) => q.length)) {
    for (let i = 0; i < 2 && main.length; i += 1) out.push(main.shift());
    if (queues.some((q) => q.length)) {
      for (let tries = 0; tries < queues.length; tries += 1) {
        const q = queues[(compIndex + tries) % queues.length];
        if (q.length) {
          out.push(q.shift());
          compIndex = (compIndex + tries + 1) % queues.length;
          break;
        }
      }
    }
  }
  return out;
}

function examPercent(date, ranges) {
  for (const range of ranges || []) {
    if (date >= range.start && date <= range.end) return range.percent ?? 50;
  }
  return 100;
}

function busyOnDate(date, university) {
  const blocks = [];
  for (const event of university.busy || []) {
    const startDay = event.start.slice(0, 10);
    const endDay = event.end.slice(0, 10);
    if (event.allDay) {
      if (date >= startDay && date < endDay) blocks.push({ start: 0, end: 24 * 60, title: event.title, allDay: true });
      continue;
    }
    if (startDay !== date) continue;
    const start = toMinutes(event.start.slice(11, 16));
    const end = toMinutes(event.end.slice(11, 16));
    if (start == null || end == null || end <= start) continue;
    blocks.push({
      start: Math.max(0, start - (university.bufferBefore || 0)),
      end: Math.min(24 * 60, end + (university.bufferAfter || 0)),
      title: event.title,
      allDay: false,
    });
  }
  const weekday = parseISODate(date).getUTCDay();
  for (const row of university.manual || []) {
    if (Number(row.weekday) !== weekday) continue;
    const start = toMinutes(row.start);
    const end = toMinutes(row.end);
    if (start == null || end == null || end <= start) continue;
    blocks.push({
      start: Math.max(0, start - (university.bufferBefore || 0)),
      end: Math.min(24 * 60, end + (university.bufferAfter || 0)),
      title: row.title,
      allDay: false,
    });
  }
  return blocks;
}

function subtractBlocks(gaps, blocks) {
  let free = gaps.filter((gap) => gap.end - gap.start >= 20);
  for (const block of blocks) {
    const next = [];
    for (const gap of free) {
      if (block.end <= gap.start || block.start >= gap.end) {
        next.push(gap);
        continue;
      }
      if (block.start > gap.start) next.push({ start: gap.start, end: Math.min(gap.end, block.start) });
      if (block.end < gap.end) next.push({ start: Math.max(gap.start, block.end), end: gap.end });
    }
    free = next.filter((gap) => gap.end - gap.start >= 20);
  }
  return free;
}

function sessionMinutes(session) {
  return (toMinutes(session.end) || 0) - (toMinutes(session.start) || 0);
}

function cloneSession(session) {
  return {
    ...session,
    links: (session.links || []).map((link) => ({ ...link })),
  };
}

export function summarizeSessions(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  if (!list.length) return { count: 0, from: '', to: '', minutes: 0, hours: 0 };
  const dates = list.map((session) => session.date).filter(Boolean).sort();
  const minutes = list.reduce((sum, session) => {
    const start = toMinutes(session.start);
    const end = toMinutes(session.end);
    return sum + (start != null && end != null && end > start ? end - start : 0);
  }, 0);
  return {
    count: list.length,
    from: dates[0] || '',
    to: dates[dates.length - 1] || '',
    minutes,
    hours: Math.round((minutes / 60) * 10) / 10,
  };
}

export function findSessionConflicts(plan, session) {
  const conflicts = [];
  const start = toMinutes(session.start);
  const end = toMinutes(session.end);
  if (start == null || end == null || end <= start) {
    conflicts.push('Horário de fim precisa ser depois do início.');
    return conflicts;
  }
  const university = plan.university || emptyUniversity();
  for (const block of busyOnDate(session.date, university)) {
    if (start < block.end && end > block.start) {
      conflicts.push(`Conflito com aula/evento: ${block.title}`);
    }
  }
  for (const other of plan.sessions || []) {
    if (other.id === session.id || other.date !== session.date) continue;
    const oStart = toMinutes(other.start);
    const oEnd = toMinutes(other.end);
    if (oStart != null && oEnd != null && start < oEnd && end > oStart) {
      conflicts.push(`Sobrepõe sessão: ${other.title}`);
    }
  }
  return conflicts;
}

function compareSessions(a, b) {
  return `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`);
}

export function generateSessions(plan, items, options = {}) {
  const idFactory = options.idFactory || (() => {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `sessao-${token}`;
  });
  const fromDate = options.fromDate || plan.startDate;
  const kept = (plan.sessions || []).filter((session) => {
    if (session.locked) return true;
    if (options.fromDate && session.date < options.fromDate) return true;
    return false;
  }).map(cloneSession);

  const covered = new Map();
  for (const session of kept) {
    if (!session.refId || session.kind === 'custom') continue;
    const key = `${session.kind}:${session.refId}`;
    covered.set(key, (covered.get(key) || 0) + sessionMinutes(session));
  }
  const queue = [];
  for (const item of items) {
    const key = `${item.kind}:${item.refId}`;
    const left = item.minutes - (covered.get(key) || 0);
    if (left >= 20) queue.push({ ...item, left });
  }

  const university = plan.university || emptyUniversity();
  const skipped = new Set(plan.skippedDates || []);
  const gaps = [];
  let cursor = parseISODate(fromDate);
  const limit = addUtcDays(cursor, 420);
  while (cursor <= limit && queue.some((item) => item.left >= 20)) {
    const date = formatISODate(cursor);
    const weekday = cursor.getUTCDay();
    const slot = plan.slots?.[weekday];
    if (plan.weekdays.includes(weekday) && slot && !skipped.has(date)) {
      const start = toMinutes(slot.start);
      const end = toMinutes(slot.end);
      if (start != null && end != null && end > start) {
        const percent = examPercent(date, university.examRanges);
        const usable = start + Math.round(((end - start) * percent) / 100);
        let free = subtractBlocks([{ start, end: Math.max(start + 20, usable) }], busyOnDate(date, university));
        for (const session of kept) {
          if (session.date !== date) continue;
          free = subtractBlocks(free, [{ start: toMinutes(session.start), end: toMinutes(session.end) }]);
        }
        free.forEach((gap) => gaps.push({ date, ...gap }));
      }
    }
    cursor = addUtcDays(cursor, 1);
  }

  const minBlock = Math.max(20, Math.min(90, Number(plan.minBlockMinutes) || 20));
  const maxBlock = Number(plan.maxBlockMinutes) > 0 ? Math.max(minBlock, Number(plan.maxBlockMinutes)) : 0;
  const created = [];
  const spacedQueue = [];
  let gapIndex = 0;
  for (const item of queue) {
    let left = item.left;
    let lastDate = '';
    while (left >= 20 && gapIndex < gaps.length) {
      const gap = gaps[gapIndex];
      const room = gap.end - gap.start;
      if (room < 20 || (room < minBlock && left >= minBlock)) {
        gapIndex += 1;
        continue;
      }
      let take = Math.min(room, left);
      if (maxBlock && take > maxBlock) take = maxBlock;
      const start = gap.start;
      const end = gap.start + take;
      lastDate = gap.date;
      created.push({
        id: idFactory(),
        date: gap.date,
        start: fromMinutes(start),
        end: fromMinutes(end),
        title: item.title,
        kind: item.kind,
        refId: item.refId,
        phaseId: item.phaseId,
        trackId: item.trackId || '',
        trackName: item.trackName || '',
        locked: false,
        detail: '',
        summary: item.summary,
        links: item.links || [],
      });
      gap.start = maxBlock && take === maxBlock && (gap.end - end >= minBlock + 10) ? end + 10 : end;
      left -= take;
      if (gap.end - gap.start < 20) gapIndex += 1;
    }
    if (plan.spacedReview && item.kind === 'topic' && lastDate) {
      const reviewAfter = formatISODate(addUtcDays(parseISODate(lastDate), 7));
      spacedQueue.push({
        afterDate: reviewAfter,
        title: `Revisão espaçada: ${item.title}`,
        refId: item.refId,
        phaseId: item.phaseId,
        trackId: item.trackId || '',
        trackName: item.trackName || '',
        links: item.links || [],
      });
    }
  }
  for (const rev of spacedQueue) {
    const slotGap = gaps.find((gap) => gap.date >= rev.afterDate && (gap.end - gap.start) >= 25);
    if (!slotGap) continue;
    const start = slotGap.start;
    const end = start + 25;
    created.push({
      id: idFactory(),
      date: slotGap.date,
      start: fromMinutes(start),
      end: fromMinutes(end),
      title: rev.title,
      kind: 'review',
      refId: rev.refId,
      phaseId: rev.phaseId,
      trackId: rev.trackId,
      trackName: rev.trackName,
      locked: false,
      detail: '',
      summary: 'Revisão espaçada (+7 dias) para fixar o conteúdo.',
      links: rev.links,
    });
    slotGap.start = end;
  }
  return [...kept, ...created].sort(compareSessions);
}

function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function fold(line) {
  const text = String(line);
  if (text.length <= 73) return text;
  const parts = [text.slice(0, 73)];
  for (let index = 73; index < text.length; index += 72) parts.push(` ${text.slice(index, index + 72)}`);
  return parts.join('\r\n');
}

export function sessionsToIcs(sessions, calendarName, timeZone = '') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rumo//Guia de estudos//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calendarName || 'Plano de estudo')}`,
  ];
  const tz = /^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(timeZone || '') ? timeZone : '';
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}00Z`;
  for (const session of sessions) {
    const description = [
      session.trackName ? `Trilha: ${session.trackName}` : '',
      session.summary,
      session.detail,
      (session.links || []).length ? `Recursos:\n${session.links.map((link) => `- ${link.title}: ${link.url}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
    const start = `${session.date.replace(/-/g, '')}T${session.start.replace(':', '')}00`;
    const end = `${session.date.replace(/-/g, '')}T${session.end.replace(':', '')}00`;
    lines.push('BEGIN:VEVENT');
    lines.push(fold(`UID:${session.id}@rumo-guia-de-estudos`));
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(tz ? `DTSTART;TZID=${tz}:${start}` : `DTSTART:${start}`);
    lines.push(tz ? `DTEND;TZID=${tz}:${end}` : `DTEND:${end}`);
    lines.push(fold(`SUMMARY:${icsEscape(session.title)}`));
    if (description) lines.push(fold(`DESCRIPTION:${icsEscape(description)}`));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export function planMarkdown(trackName, sessions) {
  const groups = new Map();
  for (const session of sessions) {
    if (!groups.has(session.date)) groups.set(session.date, []);
    groups.get(session.date).push(session);
  }
  const lines = [`# Rumo — Plano de estudo — ${trackName}`, ''];
  for (const [date, list] of groups) {
    lines.push(`## ${date}`);
    for (const session of list) {
      lines.push(`- [ ] ${session.start}–${session.end} ${session.title}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
