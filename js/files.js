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

export function textPdf(lines) {
  const pageSize = 40;
  const pages = [];
  for (let index = 0; index < lines.length; index += pageSize) pages.push(lines.slice(index, index + pageSize));
  if (!pages.length) pages.push(['(vazio)']);
  const objects = [];
  const kids = [];
  pages.forEach((page, pageIndex) => {
    const content = [
      '0.890 0.871 0.824 rg',
      '0 0 595 842 re f',
    ];
    const textTop = pageIndex === 0 ? '48 772 Td' : '48 790 Td';
    if (pageIndex === 0) content.push(brandMarkPdf());
    content.push('0.169 0.129 0.106 rg', 'BT', '/F1 10 Tf', textTop, '16 TL');
    page.forEach((line, lineIndex) => {
      const text = encodeWin(line.slice(0, 70));
      const literal = `(${String.fromCharCode(...text)})`;
      content.push(lineIndex === 0 ? `${literal} Tj` : `T* ${literal} Tj`);
    });
    content.push('ET');
    const stream = content.join('\n');
    const contentId = 3 + pageIndex * 2;
    const pageId = contentId + 1;
    kids.push(`${pageId} 0 R`);
    objects.push(`${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`);
  });
  const fontId = 3 + pages.length * 2;
  const body = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    `2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>\nendobj\n`,
    ...objects,
    `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj\n`,
  ].join('');
  let offset = '%PDF-1.4\n'.length;
  const xref = ['0000000000 65535 f \n'];
  const parts = ['%PDF-1.4\n'];
  const chunks = body.split(/(?=\d+ 0 obj)/);
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    xref.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
    parts.push(chunk);
    offset += chunk.length;
  }
  const xrefStart = offset;
  parts.push(`xref\n0 ${xref.length}\n${xref.join('')}trailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
  return parts.join('');
}

export function roadmapLines(track, view) {
  const lines = [`Rumo — ${track.name}`, track.description, ''];
  for (const phase of view.phases) {
    lines.push(`Etapa ${phase.number}: ${phase.title}`);
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
  const lines = [`# Rumo — ${track.name}`, '', track.description, ''];
  for (const phase of view.phases) {
    lines.push(`## Etapa ${phase.number}: ${phase.title}`, '');
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
const MARK_NORTH = [[25.19, 6.81], [20.60, 17.34], [14.66, 11.40]];
const MARK_TAIL = [[6.81, 25.19], [11.40, 14.66], [17.34, 20.60]];
const MARK_NORTH_LIGHT = '#1D4ED8';
const MARK_TAIL_LIGHT = '#64748B';

function brandMarkPdf() {
  const paint = (points, rgb) => {
    const ops = points.map(([x, y], index) => {
      const px = (48 + x * 0.5).toFixed(2);
      const py = (802 - y * 0.5).toFixed(2);
      return `${px} ${py} ${index === 0 ? 'm' : 'l'}`;
    });
    return `${rgb} rg\n${ops.join(' ')} h f`;
  };
  return [
    paint(MARK_NORTH, '0.478 0.200 0.161'),
    paint(MARK_TAIL, '0.533 0.463 0.333'),
  ].join('\n');
}

function drawBrandMark(ctx, x, y, size) {
  const scale = size / 32;
  const paint = (points, color) => {
    ctx.beginPath();
    points.forEach(([px, py], index) => {
      const X = x + px * scale;
      const Y = y + py * scale;
      if (index === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  paint(MARK_NORTH, MARK_NORTH_LIGHT);
  paint(MARK_TAIL, MARK_TAIL_LIGHT);
}

export function drawRoadmap(canvas, track, view) {
  const width = 1100;
  const line = 28;
  const rows = view.phases.reduce((sum, phase) => sum + 1 + phase.topics.filter((topic) => topic.status !== 'hidden').length, view.phases.length);
  const height = 200 + rows * line;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#F7F8FA';
  ctx.fillRect(0, 0, width, height);
  drawBrandMark(ctx, 48, 22, 40);
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 32px ${FONT_UI}`;
  ctx.fillText('rumo', 100, 52);
  ctx.font = `600 20px ${FONT_UI}`;
  ctx.fillStyle = '#1D4ED8';
  ctx.fillText(track.name, 48, 108);
  let y = 168;
  for (const phase of view.phases) {
    ctx.fillStyle = '#0F172A';
    ctx.font = `600 18px ${FONT_UI}`;
    ctx.fillText(`Etapa ${phase.number}: ${phase.title}`, 48, y);
    y += line;
    ctx.font = `400 16px ${FONT_BODY}`;
    for (const topic of phase.topics) {
      if (topic.status === 'hidden') continue;
      ctx.fillStyle = topic.done ? '#047857' : '#0F172A';
      const prefix = topic.done ? '✓' : '○';
      const optional = topic.status === 'optional' ? ' · opcional' : '';
      ctx.fillText(`${prefix}  ${topic.title}${optional}`, 72, y);
      y += line;
    }
    y += 12;
  }
}
