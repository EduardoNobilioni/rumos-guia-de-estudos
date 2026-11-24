const WIN = {
  'á': 0xe1, 'à': 0xe0, 'â': 0xe2, 'ã': 0xe3, 'ä': 0xe4,
  'é': 0xe9, 'è': 0xe8, 'ê': 0xea, 'ë': 0xeb,
  'í': 0xed, 'ì': 0xec, 'î': 0xee,
  'ó': 0xf3, 'ò': 0xf2, 'ô': 0xf4, 'õ': 0xf5, 'ö': 0xf6,
  'ú': 0xfa, 'ù': 0xf9, 'û': 0xfb, 'ü': 0xfc,
  'ç': 0xe7, 'ñ': 0xf1,
  'Á': 0xc1, 'À': 0xc0, 'Â': 0xc2, 'Ã': 0xc3,
  'É': 0xc9, 'Ê': 0xca, 'Í': 0xcd, 'Ó': 0xd3, 'Ô': 0xd4, 'Õ': 0xd5,
  'Ú': 0xda, 'Ç': 0xc7,
  '–': 0x96, '—': 0x97, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '→': 0x2d,
};

function encodeWin(text) {
  const bytes = [];
  for (const char of String(text)) {
    if (char === '(' || char === ')' || char === '\\') {
      bytes.push(0x5c, char.charCodeAt(0));
      continue;
    }
    const code = char.charCodeAt(0);
    if (code >= 32 && code < 127) bytes.push(code);
    else if (WIN[char] != null) bytes.push(WIN[char]);
    else bytes.push(0x3f);
  }
  return bytes;
}

function wrapLine(text, max = 72) {
  const raw = String(text ?? '');
  if (raw.length <= max) return [raw];
  const indentMatch = raw.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '';
  const words = raw.trim().split(/\s+/);
  const lines = [];
  let current = indent;
  for (const word of words) {
    const candidate = current === indent ? `${indent}${word}` : `${current} ${word}`;
    if (candidate.length > max && current.trim().length > 0) {
      lines.push(current);
      current = `${indent}  ${word}`;
    } else {
      current = candidate;
    }
  }
  if (current.trim().length > 0 || !lines.length) lines.push(current);
  return lines;
}

function pushAscii(target, str) {
  for (let i = 0; i < str.length; i += 1) {
    target.push(str.charCodeAt(i) & 0xff);
  }
}

function pushWinText(target, x, y, text, size = 10) {
  pushAscii(target, `BT /F1 ${size} Tf ${x} ${y} Td (`);
  for (const b of encodeWin(text)) target.push(b);
  pushAscii(target, ') Tj ET\n');
}

function buildPdfDocument(pageStreams) {
  const pages = pageStreams.length ? pageStreams : [[]];
  const fontId = 3 + pages.length * 2;
  const objects = [];
  const kids = [];

  pages.forEach((streamBytes, pageIndex) => {
    const contentId = 3 + pageIndex * 2;
    const pageId = contentId + 1;
    kids.push(`${pageId} 0 R`);

    const contentObj = [];
    pushAscii(contentObj, `${contentId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
    for (const b of streamBytes) contentObj.push(b);
    pushAscii(contentObj, '\nendstream\nendobj\n');
    objects.push(contentObj);

    const pageObj = [];
    pushAscii(
      pageObj,
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>\nendobj\n`,
    );
    objects.push(pageObj);
  });

  const catalogObj = [];
  pushAscii(catalogObj, '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const pagesObj = [];
  pushAscii(pagesObj, `2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>\nendobj\n`);
  const fontObj = [];
  pushAscii(fontObj, `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj\n`);

  const allObjects = [catalogObj, pagesObj, ...objects, fontObj];
  const pdf = [];
  pushAscii(pdf, '%PDF-1.4\n');
  const xref = ['0000000000 65535 f \n'];
  for (const obj of allObjects) {
    xref.push(`${String(pdf.length).padStart(10, '0')} 00000 n \n`);
    for (const b of obj) pdf.push(b);
  }
  const xrefStart = pdf.length;
  pushAscii(pdf, `xref\n0 ${xref.length}\n${xref.join('')}trailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
  return new Uint8Array(pdf);
}

export function textPdf(lines) {
  const wrapped = [];
  for (const line of lines) {
    for (const part of wrapLine(line, 72)) wrapped.push(part);
  }
  const pageSize = 42;
  const pages = [];
  for (let index = 0; index < wrapped.length; index += pageSize) {
    pages.push(wrapped.slice(index, index + pageSize));
  }
  if (!pages.length) pages.push(['(vazio)']);

  const streams = pages.map((page, pageIndex) => {
    const streamBytes = [];
    const header = [
      '1 1 1 rg\n',
      '0 0 595 842 re f\n',
      pageIndex === 0 ? `${brandMarkPdf()}\n` : '',
      '0.059 0.090 0.165 rg\n',
      'BT\n',
      '/F1 10 Tf\n',
      pageIndex === 0 ? '48 764 Td\n' : '48 790 Td\n',
      '16 TL\n',
    ].join('');
    pushAscii(streamBytes, header);
    page.forEach((line, lineIndex) => {
      const encoded = encodeWin(line);
      if (lineIndex > 0) pushAscii(streamBytes, 'T* ');
      streamBytes.push(0x28);
      for (const b of encoded) streamBytes.push(b);
      pushAscii(streamBytes, ') Tj\n');
    });
    pushAscii(streamBytes, 'ET\n');
    return streamBytes;
  });

  return buildPdfDocument(streams);
}

export function roadmapPdf(track, view) {
  const streams = [];
  const tree = [];
  pushAscii(tree, `1 1 1 rg\n0 0 595 842 re f\n${brandMarkPdf()}\n0.059 0.090 0.165 rg\n`);
  pushWinText(tree, 78, 792, `Rumos - ${track.name}`, 13);
  pushAscii(tree, '0.145 0.388 0.922 rg\n');
  pushWinText(tree, 48, 764, 'Arvore visual do roadmap', 11);

  let yTop = 738;
  let prevCenterX = null;
  let prevBottomY = null;
  for (let i = 0; i < view.phases.length && yTop >= 110; i += 1) {
    const phase = view.phases[i];
    const isLeft = i % 2 === 0;
    const boxX = isLeft ? 48 : 112;
    const boxW = 435;
    const boxH = 44;
    const boxY = yTop - boxH;
    const centerX = boxX + boxW / 2;

    if (prevCenterX !== null && prevBottomY !== null) {
      const midY = Math.round((prevBottomY + yTop) / 2);
      pushAscii(tree, `0.392 0.455 0.545 RG 1.2 w ${prevCenterX} ${prevBottomY} m ${prevCenterX} ${midY} l ${centerX} ${midY} l ${centerX} ${yTop} l S\n`);
    }

    if (phase.progress.complete) {
      pushAscii(tree, `0.925 0.992 0.961 rg 0.020 0.588 0.412 RG 1.5 w ${boxX} ${boxY} ${boxW} ${boxH} re B\n`);
    } else {
      pushAscii(tree, `0.973 0.980 0.988 rg 0.145 0.388 0.922 RG 1.2 w ${boxX} ${boxY} ${boxW} ${boxH} re B\n`);
    }

    pushAscii(tree, '0.059 0.090 0.165 rg\n');
    const stageMark = phase.progress.complete ? '[x]' : '[ ]';
    const stageLine = `${stageMark} Etapa ${phase.number}: ${phase.title} (${phase.progress.done}/${phase.progress.total})`;
    pushWinText(tree, boxX + 10, boxY + 26, stageLine.slice(0, 66), 9);

    const visible = phase.topics.filter((t) => t.status !== 'hidden').slice(0, 3);
    const previewTopics = visible.map((t) => `${t.done ? '[x]' : '[ ]'} ${t.title}`).join('  |  ');
    pushAscii(tree, '0.278 0.333 0.412 rg\n');
    pushWinText(tree, boxX + 10, boxY + 10, previewTopics.slice(0, 74), 8);

    prevCenterX = centerX;
    prevBottomY = boxY;
    yTop = boxY - 22;
  }
  streams.push(tree);

  const notebookLines = [
    `Caderno de acompanhamento - ${track.name}`,
    track.description || '',
    '',
    ...roadmapLines(track, view).slice(2),
  ];
  const wrapped = [];
  for (const line of notebookLines) {
    for (const part of wrapLine(line, 72)) wrapped.push(part);
  }
  const pageSize = 44;
  for (let index = 0; index < wrapped.length; index += pageSize) {
    const page = wrapped.slice(index, index + pageSize);
    const streamBytes = [];
    pushAscii(streamBytes, '1 1 1 rg\n0 0 595 842 re f\n0.059 0.090 0.165 rg\nBT\n/F1 10 Tf\n48 796 Td\n16 TL\n');
    page.forEach((line, lineIndex) => {
      const encoded = encodeWin(line);
      if (lineIndex > 0) pushAscii(streamBytes, 'T* ');
      streamBytes.push(0x28);
      for (const b of encoded) streamBytes.push(b);
      pushAscii(streamBytes, ') Tj\n');
    });
    pushAscii(streamBytes, 'ET\n');
    streams.push(streamBytes);
  }

  return buildPdfDocument(streams);
}

export function roadmapLines(track, view) {
  const lines = [
    `Rumos - ${track.name}`,
    track.description,
    '',
    'Fluxograma das etapas:',
    `  ${view.phases.map((p) => `[${p.number}. ${p.badgeTitle} (${p.progress.done}/${p.progress.total})]`).join(' -> ')}`,
    '',
  ];
  for (const phase of view.phases) {
    lines.push(`Etapa ${phase.number}: ${phase.title} (${phase.progress.done}/${phase.progress.total})`);
    for (const topic of phase.topics) {
      if (topic.status === 'hidden') continue;
      const mark = topic.done ? '[x]' : '[ ]';
      const extra = topic.status === 'optional' ? ' (opcional)' : '';
      lines.push(`  ${mark} ${topic.title}${extra} - ${topic.hours || 0} h`);
    }
    for (const project of phase.projects || []) {
      lines.push(`  ${project.done ? '[x]' : '[ ]'} Projeto: ${project.title}`);
    }
    lines.push('');
  }
  return lines;
}

export function roadmapMarkdown(track, view) {
  const flow = view.phases.map((p) => `**${p.number}. ${p.title}** (${p.progress.done}/${p.progress.total})`).join(' → ');
  const lines = [
    `# Rumos — ${track.name}`,
    '',
    track.description,
    '',
    '## Fluxograma das etapas',
    '',
    flow,
    '',
  ];
  for (const phase of view.phases) {
    lines.push(`## Etapa ${phase.number}: ${phase.title} (${phase.progress.done}/${phase.progress.total})`, '');
    for (const topic of phase.topics) {
      if (topic.status === 'hidden') continue;
      lines.push(`- [${topic.done ? 'x' : ' '}] ${topic.title}${topic.status === 'optional' ? ' _(opcional)_' : ''}`);
    }
    if ((phase.projects || []).length) {
      lines.push('', '### Projetos');
      for (const project of phase.projects) {
        lines.push(`- [${project.done ? 'x' : ' '}] ${project.title} (${project.level})`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

const FONT_BODY = '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
const FONT_UI = '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

function brandMarkPdf() {
  return [
    '0.145 0.388 0.922 rg',
    '48 784 m 68 804 l 61 789 l h f',
    '0.020 0.588 0.412 rg',
    '48 784 m 54 798 l 68 804 l h f',
  ].join('\n');
}

function drawBrandMark(ctx, x, y, size) {
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.16, y + size * 0.84);
  ctx.lineTo(x + size * 0.84, y + size * 0.16);
  ctx.lineTo(x + size * 0.58, y + size * 0.68);
  ctx.lineTo(x + size * 0.44, y + size * 0.54);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.16, y + size * 0.84);
  ctx.lineTo(x + size * 0.36, y + size * 0.40);
  ctx.lineTo(x + size * 0.84, y + size * 0.16);
  ctx.lineTo(x + size * 0.44, y + size * 0.54);
  ctx.closePath();
  ctx.fill();
}

export function drawRoadmap(canvas, track, view) {
  const width = 1140;
  const line = 28;
  const cols = Math.min(4, Math.max(1, view.phases.length));
  const flowRows = Math.ceil(view.phases.length / cols);
  const flowHeight = flowRows * 74 + 24;
  const treeHeight = view.phases.reduce((sum, phase) => {
    const visible = phase.topics.filter((t) => t.status !== 'hidden');
    const pairs = Math.ceil(visible.length / 2);
    return sum + 64 + Math.max(1, pairs) * 62 + 24;
  }, 0);
  const checklistHeight = 72 + view.phases.reduce(
    (sum, phase) => sum + 42 + phase.topics.filter((t) => t.status !== 'hidden').length * 28 + 16,
    0,
  );
  const height = 220 + flowHeight + treeHeight + checklistHeight;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  drawBrandMark(ctx, 48, 22, 40);
  ctx.fillStyle = '#0F172A';
  ctx.font = `800 32px "Syne", ${FONT_UI}`;
  ctx.fillText('Rumos', 100, 52);
  ctx.font = `700 22px ${FONT_UI}`;
  ctx.fillStyle = '#1D4ED8';
  ctx.fillText(track.name, 48, 102);

  // Fluxograma das etapas
  let fy = 128;
  const boxW = Math.floor((width - 96 - (cols - 1) * 28) / cols);
  view.phases.forEach((phase, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const x = 48 + col * (boxW + 28);
    const y = fy + row * 74;
    ctx.fillStyle = phase.progress.complete ? '#ECFDF5' : '#F8FAFC';
    ctx.strokeStyle = phase.progress.complete ? '#059669' : '#2563EB';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, 54, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = phase.progress.complete ? '#047857' : '#1D4ED8';
    ctx.font = `700 12px ${FONT_UI}`;
    ctx.fillText(`ETAPA ${phase.number} · ${phase.progress.done}/${phase.progress.total}`, x + 12, y + 20);
    ctx.fillStyle = '#0F172A';
    ctx.font = `600 14px ${FONT_UI}`;
    const label = phase.title.length > 24 ? `${phase.title.slice(0, 23)}…` : phase.title;
    ctx.fillText(label, x + 12, y + 40);

    if (col < cols - 1 && idx < view.phases.length - 1) {
      ctx.strokeStyle = '#64748B';
      ctx.beginPath();
      ctx.moveTo(x + boxW + 4, y + 27);
      ctx.lineTo(x + boxW + 24, y + 27);
      ctx.lineTo(x + boxW + 18, y + 22);
      ctx.moveTo(x + boxW + 24, y + 27);
      ctx.lineTo(x + boxW + 18, y + 32);
      ctx.stroke();
    }
  });

  // Mapa visual conectado (espinha dorsal + ramificações com deslocamento entre etapas)
  const baseCenterX = width / 2;
  const nodeW = 350;
  const nodeH = 44;
  let y = fy + flowHeight + 24;
  view.phases.forEach((phase, phaseIdx) => {
    const offsetX = phaseIdx % 2 === 0 ? -24 : 24;
    const centerX = baseCenterX + offsetX;
    // Marco da etapa deslocado
    ctx.fillStyle = phase.progress.complete ? '#ECFDF5' : '#EFF6FF';
    ctx.strokeStyle = phase.progress.complete ? '#059669' : '#2563EB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(centerX - 240, y, 480, 42, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = `700 15px ${FONT_UI}`;
    const pTitle = `Etapa ${phase.number}: ${phase.title} (${phase.progress.done}/${phase.progress.total})`;
    ctx.fillText(pTitle.length > 54 ? `${pTitle.slice(0, 53)}…` : pTitle, centerX - 220, y + 26);

    const visible = phase.topics.filter((topic) => topic.status !== 'hidden');
    const branchStartY = y + 42;
    const rows = Math.max(1, Math.ceil(visible.length / 2));
    const branchEndY = branchStartY + rows * 62;

    // Espinha dorsal vertical
    ctx.strokeStyle = '#93C5FD';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, branchStartY);
    ctx.lineTo(centerX, branchEndY);
    ctx.stroke();

    visible.forEach((topic, idx) => {
      const row = Math.floor(idx / 2);
      const isLeft = idx % 2 === 0;
      const ny = branchStartY + 14 + row * 62;
      const nx = isLeft ? centerX - 40 - nodeW : centerX + 40;

      ctx.strokeStyle = '#93C5FD';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, ny + nodeH / 2);
      ctx.lineTo(isLeft ? nx + nodeW : nx, ny + nodeH / 2);
      ctx.stroke();

      ctx.fillStyle = topic.done ? '#ECFDF5' : '#FFFFFF';
      ctx.strokeStyle = topic.done ? '#059669' : (topic.status === 'optional' ? '#D97706' : '#2563EB');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(nx, ny, nodeW, nodeH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = topic.done ? '#047857' : '#0F172A';
      ctx.font = `600 13px ${FONT_BODY}`;
      const prefix = topic.done ? '✓ ' : '';
      const opt = topic.status === 'optional' ? ' (opc.)' : '';
      const text = `${prefix}${topic.title}${opt}`;
      ctx.fillText(text.length > 42 ? `${text.slice(0, 41)}…` : text, nx + 12, ny + 27);
    });

    y = branchEndY + 24;
  });

  // Caderno de acompanhamento — Checklist de etapas e tópicos
  y += 16;
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 20px ${FONT_UI}`;
  ctx.fillText('Caderno de acompanhamento — Etapas e tópicos', 48, y);
  y += 32;

  for (const phase of view.phases) {
    // Caixinha de check da etapa
    ctx.strokeStyle = phase.progress.complete ? '#059669' : '#2563EB';
    ctx.fillStyle = phase.progress.complete ? '#059669' : '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(48, y - 14, 18, 18, 4);
    ctx.fill();
    ctx.stroke();
    if (phase.progress.complete) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 13px ${FONT_UI}`;
      ctx.fillText('✓', 52, y);
    }

    ctx.fillStyle = '#0F172A';
    ctx.font = `700 16px ${FONT_UI}`;
    ctx.fillText(`Etapa ${phase.number}: ${phase.title} (${phase.progress.done}/${phase.progress.total})`, 76, y);
    y += 32;

    for (const topic of phase.topics) {
      if (topic.status === 'hidden') continue;
      ctx.strokeStyle = topic.done ? '#059669' : '#64748B';
      ctx.fillStyle = topic.done ? '#059669' : '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(76, y - 12, 15, 15, 3);
      ctx.fill();
      ctx.stroke();
      if (topic.done) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 11px ${FONT_UI}`;
        ctx.fillText('✓', 79, y - 1);
      }

      ctx.fillStyle = topic.done ? '#047857' : '#0F172A';
      ctx.font = `400 14px ${FONT_BODY}`;
      const opt = topic.status === 'optional' ? ' · opcional' : '';
      const hrs = Number(topic.hours) ? ` (${topic.hours} h)` : '';
      ctx.fillText(`${topic.title}${hrs}${opt}`, 100, y);
      y += 28;
    }
    y += 16;
  }
}
