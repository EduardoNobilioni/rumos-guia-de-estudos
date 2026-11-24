import { CHECK_SVG, icon } from './glyph.js';

export { icon };

export const $ = (id) => document.getElementById(id);

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function safeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
  } catch { return ''; }
  return '';
}

export function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' is-error' : ''}`;
  el.innerHTML = `<i></i><span></span>`;
  el.querySelector('span').textContent = message;
  $('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export function prefersReduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function runViewTransition(update) {
  update();
  if (prefersReduced()) return;
  const next = document.querySelector('.is-screen:not([hidden])');
  if (!next) return;
  next.classList.remove('is-entering');
  void next.offsetWidth;
  next.classList.add('is-entering');
}

let menuEl = null;
let menuIndex = 0;

export function closeMenu() {
  menuEl?.remove();
  menuEl = null;
}

export function openMenu(anchor, items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  items.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.textContent = item.label;
    if (item.danger) button.classList.add('is-danger');
    button.addEventListener('click', () => { closeMenu(); item.run(); });
    menu.appendChild(button);
    if (index === 0) button.classList.add('is-active');
  });
  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 6 + window.scrollY}px`;
  menu.style.left = `${Math.max(8, rect.right - 220)}px`;
  menuEl = menu;
  menuIndex = 0;
  menu.querySelector('button')?.focus();
  const onKey = (event) => {
    const buttons = [...menu.querySelectorAll('button')];
    if (event.key === 'Escape') { closeMenu(); anchor.focus(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      menuIndex = (menuIndex + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
      buttons.forEach((button, index) => button.classList.toggle('is-active', index === menuIndex));
      buttons[menuIndex].focus();
    }
  };
  menu.addEventListener('keydown', onKey);
  setTimeout(() => {
    const away = (event) => {
      if (!menu.contains(event.target) && event.target !== anchor) {
        closeMenu();
        document.removeEventListener('pointerdown', away);
      }
    };
    document.addEventListener('pointerdown', away);
  }, 0);
}

export function checkbox(checked, attrs, label) {
  return `<button type="button" role="checkbox" aria-checked="${checked}" aria-label="${escapeHtml(label)}" ${attrs} class="mark-box${checked ? ' is-on' : ''}">${checked ? CHECK_SVG : ''}</button>`;
}

export function watchReveals(root) {
  if (!root || prefersReduced() || !('IntersectionObserver' in window)) {
    root?.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  root.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

export function brandMark(animate = false) {
  return `<svg class="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="16" r="13.5" class="logo-ring" stroke-width="1.5" stroke-dasharray="3 2.5"></circle>
    <g class="${animate ? 'compass-needle' : ''}">
      <path d="M24 8L7.5 17L15 17L15 24.5Z" class="logo-accent"></path>
      <path d="M24 8L15 17L15 24.5Z" class="logo-primary"></path>
    </g>
  </svg>`;
}

export function ring(percent) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, percent)) / 100) * c;
  return `<svg class="ring" viewBox="0 0 112 112" aria-hidden="true">
    <circle class="track" cx="56" cy="56" r="${r}"></circle>
    <circle class="arc" cx="56" cy="56" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 56 56)"></circle>
  </svg>`;
}
