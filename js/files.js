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

  const fontId = 3 + pages.length * 2;
  const objects = [];
  const kids = [];

  pages.forEach((page, pageIndex) => {
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
      streamBytes.push(0x28); // (
      for (const b of encoded) streamBytes.push(b);
      pushAscii(streamBytes, ') Tj\n');
    });
    pushAscii(streamBytes, 'ET\n');

    const contentId = 3 + pageIndex * 2;
    const pageId = contentId + 1;
    kids.push(`${pageId} 0 R`);

    const contentHead = `${contentId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`;
    const contentTail = `\nendstream\nendobj\n`;
    const contentObj = [];
    pushAscii(contentObj, contentHead);
    for (const b of streamBytes) contentObj.push(b);
    pushAscii(contentObj, contentTail);
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
  const height = 220 + flowHeight + treeHeight;
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

  // Mapa visual conectado (espinha dorsal + ramificações)
  const centerX = width / 2;
  const nodeW = 360;
  const nodeH = 44;
  let y = fy + flowHeight + 24;
  for (const phase of view.phases) {
    // Marco da etapa no eixo central
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
      const nx = isLeft ? centerX - 44 - nodeW : centerX + 44;

      // Conector horizontal até o tronco
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
      ctx.fillText(text.length > 44 ? `${text.slice(0, 43)}…` : text, nx + 12, ny + 27);
    });

    y = branchEndY + 24;
  }
}
