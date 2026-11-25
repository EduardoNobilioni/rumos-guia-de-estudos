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
  '•': 0x95, '·': 0xb7, 'º': 0xba, 'ª': 0xaa, '→': 0x2d,
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

function pushWinText(target, x, y, text, size = 10, bold = false) {
  const font = bold ? '/F2' : '/F1';
  pushAscii(target, `BT ${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (`);
  for (const b of encodeWin(text)) target.push(b);
  pushAscii(target, ') Tj ET\n');
}

function pdfRoundRectPath(x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  const k = 0.55228475 * rad;
  const x0 = x;
  const y0 = y;
  const x1 = x + w;
  const y1 = y + h;
  const f = (n) => n.toFixed(2);
  return [
    `${f(x0 + rad)} ${f(y0)} m`,
    `${f(x1 - rad)} ${f(y0)} l`,
    `${f(x1 - rad + k)} ${f(y0)} ${f(x1)} ${f(y0 + rad - k)} ${f(x1)} ${f(y0 + rad)} c`,
    `${f(x1)} ${f(y1 - rad)} l`,
    `${f(x1)} ${f(y1 - rad + k)} ${f(x1 - rad + k)} ${f(y1)} ${f(x1 - rad)} ${f(y1)} c`,
    `${f(x0 + rad)} ${f(y1)} l`,
    `${f(x0 + rad - k)} ${f(y1)} ${f(x0)} ${f(y1 - rad + k)} ${f(x0)} ${f(y1 - rad)} c`,
    `${f(x0)} ${f(y0 + rad)} l`,
    `${f(x0)} ${f(y0 + rad - k)} ${f(x0 + rad - k)} ${f(y0)} ${f(x0 + rad)} ${f(y0)} c`,
    'h',
  ].join(' ');
}

function pushPdfRoundBox(target, x, y, w, h, r, fillRgb, strokeRgb, lineWidth = 1.2, dashed = false) {
  pushAscii(
    target,
    `q ${dashed ? '[3 2] 0 d' : '[] 0 d'} ${lineWidth.toFixed(2)} w ${fillRgb} rg ${strokeRgb} RG ${pdfRoundRectPath(x, y, w, h, r)} B Q\n`,
  );
}

function pushPdfCheckmark(target, x, y, size, strokeRgb = '1 1 1') {
  const f = (n) => n.toFixed(2);
  pushAscii(
    target,
    `q [] 0 d 1 J 1 j 1.5 w ${strokeRgb} RG ${f(x + size * 0.22)} ${f(y + size * 0.52)} m ${f(x + size * 0.43)} ${f(y + size * 0.28)} l ${f(x + size * 0.78)} ${f(y + size * 0.74)} l S Q\n`,
  );
}

function truncText(text, maxChars) {
  const str = String(text ?? '');
  if (str.length <= maxChars) return str;
  return `${str.slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
}

function buildPdfDocument(pageStreams, { mono = false } = {}) {
  const pages = pageStreams.length ? pageStreams : [[]];
  const font1Id = 3 + pages.length * 2;
  const font2Id = font1Id + 1;
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
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R >> >> >>\nendobj\n`,
    );
    objects.push(pageObj);
  });

  const catalogObj = [];
  pushAscii(catalogObj, '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const pagesObj = [];
  pushAscii(pagesObj, `2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>\nendobj\n`);
  const baseRegular = mono ? '/Courier' : '/Helvetica';
  const baseBold = mono ? '/Courier-Bold' : '/Helvetica-Bold';
  const font1Obj = [];
  pushAscii(font1Obj, `${font1Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont ${baseRegular} /Encoding /WinAnsiEncoding >>\nendobj\n`);
  const font2Obj = [];
  pushAscii(font2Obj, `${font2Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont ${baseBold} /Encoding /WinAnsiEncoding >>\nendobj\n`);

  const allObjects = [catalogObj, pagesObj, ...objects, font1Obj, font2Obj];
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

  return buildPdfDocument(streams, { mono: true });
}

export function roadmapPdf(track, view) {
  const RGB_WHITE = '1 1 1';
  const RGB_INK = '0.094 0.094 0.106';        // #18181B
  const RGB_MUTED = '0.443 0.443 0.478';      // #71717A
  const RGB_GREEN = '0.416 0.604 0.078';      // #6A9A14
  const RGB_GREEN_TEXT = '0.302 0.478 0.055'; // #4D7A0E
  const RGB_DONE = '0.184 0.478 0.306';       // #2F7A4E
  const RGB_DONE_BG = '0.953 0.973 0.910';    // #F3F8E8
  const RGB_SOFT_BG = '0.980 0.980 0.976';    // #FAFAF9
  const RGB_STAGE_BG = '0.957 0.957 0.961';   // #F4F4F5

  const MARGIN_X = 36;
  const PAGE_W = 595;
  const INNER_W = PAGE_W - MARGIN_X * 2; // 523
  const BOTTOM_Y = 44;

  const streams = [];
  let page = [];
  let curY = 804;

  const startPage = (withBrand = false) => {
    page = [];
    pushAscii(page, '1 1 1 rg\n0 0 595 842 re f\n');
    streams.push(page);
    if (withBrand) {
      pushAscii(page, `${brandMarkPdf(MARGIN_X, 784, 22)}\n`);
      pushAscii(page, `${RGB_INK} rg\n`);
      pushWinText(page, MARGIN_X + 28, 790, 'Rumos', 18, true);
      pushAscii(page, `${RGB_GREEN_TEXT} rg\n`);
      pushWinText(page, MARGIN_X, 766, truncText(track.name || 'Roadmap', 68), 13, true);
      curY = 748;
    } else {
      curY = 798;
    }
  };

  const ensureSpace = (needed) => {
    if (curY - needed < BOTTOM_Y) startPage(false);
  };

  startPage(true);

  const phases = view.phases || [];

  // 1. Fluxograma das etapas (mesma grade e estilo do PNG)
  if (phases.length) {
    const cols = Math.min(4, Math.max(1, phases.length));
    const gapX = 14;
    const boxW = (INNER_W - (cols - 1) * gapX) / cols;
    const boxH = 34;
    const rowStep = 44;
    const totalRows = Math.ceil(phases.length / cols);

    for (let row = 0; row < totalRows; row += 1) {
      ensureSpace(rowStep);
      const boxY = curY - boxH;
      for (let col = 0; col < cols; col += 1) {
        const idx = row * cols + col;
        if (idx >= phases.length) break;
        const phase = phases[idx];
        const x = MARGIN_X + col * (boxW + gapX);
        const done = !!phase.progress?.complete;

        pushPdfRoundBox(
          page,
          x,
          boxY,
          boxW,
          boxH,
          6,
          done ? RGB_DONE_BG : RGB_SOFT_BG,
          done ? RGB_DONE : RGB_GREEN,
          1.1,
        );

        pushAscii(page, `${done ? RGB_DONE : RGB_GREEN_TEXT} rg\n`);
        pushWinText(page, x + 7, boxY + 21, `ETAPA ${phase.number} · ${phase.progress.done}/${phase.progress.total}`, 7, true);

        pushAscii(page, `${RGB_INK} rg\n`);
        const maxChars = cols >= 4 ? 19 : (cols === 3 ? 27 : 42);
        pushWinText(page, x + 7, boxY + 9, truncText(phase.title, maxChars), 8, true);

        if (col < cols - 1 && idx < phases.length - 1) {
          const ax0 = (x + boxW + 2).toFixed(2);
          const ax1 = (x + boxW + gapX - 2).toFixed(2);
          const axTip = (x + boxW + gapX - 5.5).toFixed(2);
          const ay = (boxY + boxH / 2).toFixed(2);
          const ayUp = (boxY + boxH / 2 + 2.8).toFixed(2);
          const ayDn = (boxY + boxH / 2 - 2.8).toFixed(2);
          pushAscii(
            page,
            `q [] 0 d 1 w ${RGB_MUTED} RG ${ax0} ${ay} m ${ax1} ${ay} l ${axTip} ${ayUp} m ${ax1} ${ay} l ${axTip} ${ayDn} l S Q\n`,
          );
        }
      }
      curY -= rowStep;
    }
    curY -= 10;
  }

  // 2. Árvore visual conectada (espinha dorsal + ramificações com deslocamento entre etapas)
  ensureSpace(64);
  pushAscii(page, `${RGB_INK} rg\n`);
  pushWinText(page, MARGIN_X, curY - 12, 'Árvore visual do roadmap', 12, true);
  curY -= 24;

  const baseCenterX = PAGE_W / 2;
  const nodeW = 212;
  const nodeH = 24;
  const branchGap = 20;
  const rowPitch = 32;

  phases.forEach((phase, phaseIdx) => {
    const visible = (phase.topics || []).filter((t) => t.status !== 'hidden');
    const offsetX = phaseIdx % 2 === 0 ? -12 : 12;
    const centerX = baseCenterX + offsetX;
    const donePhase = !!phase.progress?.complete;

    // Garante espaço para o marco da etapa + pelo menos a primeira dupla de nós
    ensureSpace(28 + rowPitch + 12);

    const stageW = 280;
    const stageH = 24;
    const stageX = centerX - stageW / 2;
    const stageY = curY - stageH;

    pushPdfRoundBox(
      page,
      stageX,
      stageY,
      stageW,
      stageH,
      6,
      donePhase ? RGB_DONE_BG : RGB_STAGE_BG,
      donePhase ? RGB_DONE : RGB_GREEN,
      1.3,
    );
    pushAscii(page, `${RGB_INK} rg\n`);
    const pTitle = `Etapa ${phase.number}: ${phase.title} (${phase.progress.done}/${phase.progress.total})`;
    pushWinText(page, stageX + 10, stageY + 8, truncText(pTitle, 52), 8.5, true);

    curY = stageY;
    const totalTopicRows = Math.max(1, Math.ceil(visible.length / 2));

    if (!visible.length) {
      const endY = curY - 16;
      pushAscii(page, `q [] 0 d 1.4 w ${RGB_GREEN} RG ${centerX.toFixed(2)} ${curY.toFixed(2)} m ${centerX.toFixed(2)} ${endY.toFixed(2)} l S Q\n`);
      curY = endY - 12;
      return;
    }

    for (let row = 0; row < totalTopicRows; row += 1) {
      if (curY - rowPitch < BOTTOM_Y) {
        startPage(false);
      }
      const spineTop = curY;
      const spineBottom = curY - rowPitch;
      const ny = curY - 6 - nodeH;
      const midY = ny + nodeH / 2;

      // Segmento da espinha dorsal vertical
      pushAscii(
        page,
        `q [] 0 d 1.4 w ${RGB_GREEN} RG ${centerX.toFixed(2)} ${spineTop.toFixed(2)} m ${centerX.toFixed(2)} ${spineBottom.toFixed(2)} l S Q\n`,
      );

      for (let side = 0; side < 2; side += 1) {
        const tIdx = row * 2 + side;
        if (tIdx >= visible.length) break;
        const topic = visible[tIdx];
        const isLeft = side === 0;
        const nx = isLeft ? centerX - branchGap - nodeW : centerX + branchGap;
        const connX = isLeft ? nx + nodeW : nx;
        const isOpt = topic.status === 'optional';
        const isDone = !!topic.done;

        // Ramificação horizontal conectada à espinha
        pushAscii(
          page,
          `q [] 0 d 1.3 w ${RGB_GREEN} RG ${centerX.toFixed(2)} ${midY.toFixed(2)} m ${connX.toFixed(2)} ${midY.toFixed(2)} l S Q\n`,
        );

        pushPdfRoundBox(
          page,
          nx,
          ny,
          nodeW,
          nodeH,
          5,
          isDone ? RGB_DONE_BG : RGB_WHITE,
          isDone ? RGB_DONE : (isOpt ? RGB_MUTED : RGB_GREEN),
          1.1,
          isOpt && !isDone,
        );

        let textX = nx + 8;
        if (isDone) {
          pushPdfRoundBox(page, nx + 6, ny + 6.5, 11, 11, 2.5, RGB_DONE, RGB_DONE, 1);
          pushPdfCheckmark(page, nx + 6, ny + 6.5, 11);
          textX = nx + 21;
        }

        pushAscii(page, `${isDone ? RGB_DONE : RGB_INK} rg\n`);
        const optSuffix = isOpt ? ' (opc.)' : '';
        const maxTitle = isDone ? 35 : 39;
        pushWinText(page, textX, ny + 8.5, truncText(`${topic.title}${optSuffix}`, maxTitle), 7.8, true);
      }

      curY = spineBottom;
    }

    curY -= 14;
  });

  // 3. Caderno de acompanhamento — Etapas e tópicos (mesmo estilo do PNG)
  ensureSpace(72);
  curY -= 6;
  pushAscii(page, `${RGB_INK} rg\n`);
  pushWinText(page, MARGIN_X, curY - 14, 'Caderno de acompanhamento — Etapas e tópicos', 13, true);
  curY -= 32;

  for (const phase of phases) {
    ensureSpace(44);
    const pDone = !!phase.progress?.complete;
    const pBoxY = curY - 12;

    pushPdfRoundBox(
      page,
      MARGIN_X,
      pBoxY,
      12,
      12,
      3,
      pDone ? RGB_DONE : RGB_WHITE,
      pDone ? RGB_DONE : RGB_GREEN,
      1.3,
    );
    if (pDone) pushPdfCheckmark(page, MARGIN_X, pBoxY, 12);

    pushAscii(page, `${RGB_INK} rg\n`);
    pushWinText(
      page,
      MARGIN_X + 20,
      curY - 10,
      truncText(`Etapa ${phase.number}: ${phase.title} (${phase.progress.done}/${phase.progress.total})`, 74),
      10.5,
      true,
    );
    curY -= 22;

    for (const topic of phase.topics || []) {
      if (topic.status === 'hidden') continue;
      ensureSpace(20);
      const tDone = !!topic.done;
      const tBoxX = MARGIN_X + 20;
      const tBoxY = curY - 10;

      pushPdfRoundBox(
        page,
        tBoxX,
        tBoxY,
        10,
        10,
        2.5,
        tDone ? RGB_DONE : RGB_WHITE,
        tDone ? RGB_DONE : RGB_MUTED,
        1.1,
      );
      if (tDone) pushPdfCheckmark(page, tBoxX, tBoxY, 10);

      pushAscii(page, `${tDone ? RGB_DONE : RGB_INK} rg\n`);
      const opt = topic.status === 'optional' ? ' · opcional' : '';
      const hrs = Number(topic.hours) ? ` (${topic.hours} h)` : '';
      pushWinText(page, tBoxX + 16, curY - 8.5, truncText(`${topic.title}${hrs}${opt}`, 82), 9, false);
      curY -= 18;
    }

    curY -= 8;
  }

  return buildPdfDocument(streams, { mono: false });
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

function brandMarkPdf(x = 48, y = 784, size = 20) {
  const f = (n) => n.toFixed(2);
  const tipX = f(x + size * 0.88);
  const tipY = f(y + size * 0.88);
  const lwX = f(x + size * 0.10);
  const lwY = f(y + size * 0.44);
  const midX = f(x + size * 0.46);
  const midY = f(y + size * 0.44);
  const rwX = f(x + size * 0.46);
  const rwY = f(y + size * 0.08);
  return [
    '0.416 0.604 0.078 rg',
    `${tipX} ${tipY} m ${lwX} ${lwY} l ${midX} ${midY} l ${rwX} ${rwY} l h f`,
    '0.718 0.890 0.290 rg',
    `${tipX} ${tipY} m ${midX} ${midY} l ${rwX} ${rwY} l h f`,
  ].join('\n');
}

function drawBrandMark(ctx, x, y, size) {
  ctx.fillStyle = '#6A9A14';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.75, y + size * 0.25);
  ctx.lineTo(x + size * 0.234375, y + size * 0.53125);
  ctx.lineTo(x + size * 0.46875, y + size * 0.53125);
  ctx.lineTo(x + size * 0.46875, y + size * 0.765625);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#B7E34A';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.75, y + size * 0.25);
  ctx.lineTo(x + size * 0.46875, y + size * 0.53125);
  ctx.lineTo(x + size * 0.46875, y + size * 0.765625);
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
  ctx.fillStyle = '#18181B';
  ctx.font = `800 32px ${FONT_UI}`;
  ctx.fillText('Rumos', 100, 52);
  ctx.font = `700 22px ${FONT_UI}`;
  ctx.fillStyle = '#4D7A0E';
  ctx.fillText(track.name, 48, 102);

  // Fluxograma das etapas
  let fy = 128;
  const boxW = Math.floor((width - 96 - (cols - 1) * 28) / cols);
  view.phases.forEach((phase, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const x = 48 + col * (boxW + 28);
    const y = fy + row * 74;
    ctx.fillStyle = phase.progress.complete ? '#F3F8E8' : '#FAFAF9';
    ctx.strokeStyle = phase.progress.complete ? '#2F7A4E' : '#6A9A14';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, 54, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = phase.progress.complete ? '#2F7A4E' : '#4D7A0E';
    ctx.font = `700 12px ${FONT_UI}`;
    ctx.fillText(`ETAPA ${phase.number} · ${phase.progress.done}/${phase.progress.total}`, x + 12, y + 20);
    ctx.fillStyle = '#18181B';
    ctx.font = `600 14px ${FONT_UI}`;
    const label = phase.title.length > 24 ? `${phase.title.slice(0, 23)}…` : phase.title;
    ctx.fillText(label, x + 12, y + 40);

    if (col < cols - 1 && idx < view.phases.length - 1) {
      ctx.strokeStyle = '#71717A';
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
    ctx.fillStyle = phase.progress.complete ? '#F3F8E8' : '#F4F4F5';
    ctx.strokeStyle = phase.progress.complete ? '#2F7A4E' : '#6A9A14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(centerX - 240, y, 480, 42, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#18181B';
    ctx.font = `700 15px ${FONT_UI}`;
    const pTitle = `Etapa ${phase.number}: ${phase.title} (${phase.progress.done}/${phase.progress.total})`;
    ctx.fillText(pTitle.length > 54 ? `${pTitle.slice(0, 53)}…` : pTitle, centerX - 220, y + 26);

    const visible = phase.topics.filter((topic) => topic.status !== 'hidden');
    const branchStartY = y + 42;
    const rows = Math.max(1, Math.ceil(visible.length / 2));
    const branchEndY = branchStartY + rows * 62;

    // Espinha dorsal vertical
    ctx.strokeStyle = '#6A9A14';
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

      ctx.strokeStyle = '#6A9A14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, ny + nodeH / 2);
      ctx.lineTo(isLeft ? nx + nodeW : nx, ny + nodeH / 2);
      ctx.stroke();

      ctx.fillStyle = topic.done ? '#F3F8E8' : '#FFFFFF';
      ctx.strokeStyle = topic.done ? '#2F7A4E' : (topic.status === 'optional' ? '#71717A' : '#6A9A14');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(nx, ny, nodeW, nodeH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = topic.done ? '#2F7A4E' : '#18181B';
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
  ctx.fillStyle = '#18181B';
  ctx.font = `700 20px ${FONT_UI}`;
  ctx.fillText('Caderno de acompanhamento — Etapas e tópicos', 48, y);
  y += 32;

  for (const phase of view.phases) {
    // Caixinha de check da etapa
    ctx.strokeStyle = phase.progress.complete ? '#2F7A4E' : '#6A9A14';
    ctx.fillStyle = phase.progress.complete ? '#2F7A4E' : '#FFFFFF';
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

    ctx.fillStyle = '#18181B';
    ctx.font = `700 16px ${FONT_UI}`;
    ctx.fillText(`Etapa ${phase.number}: ${phase.title} (${phase.progress.done}/${phase.progress.total})`, 76, y);
    y += 32;

    for (const topic of phase.topics) {
      if (topic.status === 'hidden') continue;
      ctx.strokeStyle = topic.done ? '#2F7A4E' : '#71717A';
      ctx.fillStyle = topic.done ? '#2F7A4E' : '#FFFFFF';
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

      ctx.fillStyle = topic.done ? '#2F7A4E' : '#18181B';
      ctx.font = `400 14px ${FONT_BODY}`;
      const opt = topic.status === 'optional' ? ' · opcional' : '';
      const hrs = Number(topic.hours) ? ` (${topic.hours} h)` : '';
      ctx.fillText(`${topic.title}${hrs}${opt}`, 100, y);
      y += 28;
    }
    y += 16;
  }
}
