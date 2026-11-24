import { $ } from './dom.js';

export function bindSheet() {
  const dialog = $('sheetDialog');
  const handle = $('sheetHandle');
  if (!dialog || !handle) return;
  let startY = 0;
  handle.addEventListener('pointerdown', (event) => {
    startY = event.clientY;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointerup', (event) => {
    if (event.clientY - startY > window.innerHeight * 0.3) dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dialog.close();
  });
}

export function openSheet() {
  const dialog = $('sheetDialog');
  if (!dialog.open) dialog.showModal();
  $('sheetSearch')?.focus();
}
