import { tracksMatching } from '../model.js';
import { catalog } from '../load-tracks.js';
import { escapeHtml, icon } from './dom.js';

export function initCmdk(api) {
  const { $ } = api;
  let items = [];
  let index = 0;
  let trigger = null;

  function close() {
    if ($('cmdkDialog').open) $('cmdkDialog').close();
    trigger?.focus();
  }

  function actions() {
    return [
      { group: 'Ações', label: 'Ideias de projeto', run: () => api.showScreen('projects') },
      { group: 'Ações', label: 'Painel', run: () => api.showScreen('dashboard') },
      { group: 'Ações', label: 'Plano de estudo', run: () => api.showScreen('plan') },
      { group: 'Ações', label: 'Compartilhar', run: () => api.openShare() },
      { group: 'Ações', label: 'Alternar tema', run: () => api.toggleTheme() },
      { group: 'Ações', label: 'Tópico seu', run: () => api.openTopicDialog() },
    ];
  }

  function build(query) {
    const needle = query.trim().toLowerCase();
    const result = [];
    const next = api.nextTopic?.();
    if (next && (!needle || next.title.toLowerCase().includes(needle))) {
      result.push({ group: 'Continuar', label: next.title, run: () => api.focusTopic(next.id) });
    }
    actions().forEach((item) => {
      if (!needle || item.label.toLowerCase().includes(needle)) result.push(item);
    });
    tracksMatching(catalog(), query).slice(0, 8).forEach((track) => {
      result.push({ group: 'Trilhas', label: track.name, run: () => api.switchToTrack(track.id) });
    });
    if (needle) {
      api.topicHits(needle).slice(0, 8).forEach((topic) => {
        result.push({ group: 'Tópicos', label: topic.title, run: () => api.focusTopic(topic.id, topic.sourceTrackId) });
      });
    }
    return result;
  }

  function paint() {
    const groups = [];
    $('cmdkList').innerHTML = items.map((item, itemIndex) => {
      const head = groups.includes(item.group) ? '' : `<p class="cmdk-label">${escapeHtml(item.group)}</p>`;
      groups.push(item.group);
      return `${head}<button type="button" class="cmdk-item${itemIndex === index ? ' is-active' : ''}" role="option" data-index="${itemIndex}">${icon('arrowRight')}<span>${escapeHtml(item.label)}</span></button>`;
    }).join('') || '<p class="muted" style="padding:8px">Nada com esse termo.</p>';
  }

  function open(from) {
    trigger = from || document.activeElement;
    items = build('');
    index = 0;
    $('cmdkInput').value = '';
    paint();
    $('cmdkDialog').showModal();
    $('cmdkInput').focus();
  }

  function bind() {
    $('cmdkBtn').innerHTML = `${icon('search')}<span>Buscar tópico, trilha ou ação</span><span class="kbd">⌘K</span>`;
    $('cmdkBtn').addEventListener('click', () => open($('cmdkBtn')));
    $('cmdkInput').addEventListener('input', () => { items = build($('cmdkInput').value); index = 0; paint(); });
    $('cmdkDialog').addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!items.length) return;
        index = (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        paint();
      }
      if (event.key === 'Enter' && items[index]) {
        event.preventDefault();
        const run = items[index].run;
        close();
        run();
      }
    });
    $('cmdkDialog').addEventListener('click', (event) => {
      const button = event.target.closest('[data-index]');
      if (!button) {
        if (event.target === $('cmdkDialog')) close();
        return;
      }
      const run = items[Number(button.dataset.index)]?.run;
      close();
      run?.();
    });
    document.addEventListener('keydown', (event) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      } else if (event.key === '/' && !typing) {
        event.preventDefault();
        open();
      }
    });
  }

  return { bind, open };
}
