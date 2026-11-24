import { trackIconHtml } from '../icons.js';
import { catalog } from '../load-tracks.js';
import { groupTracks, tracksMatching } from '../model.js';
import { escapeHtml, icon } from './dom.js';
import { bindSheet, openSheet } from './sheet.js';

export function initSidebar(api) {
  const { $, session } = api;

  function row(track, planned) {
    const current = track.id === api.getState().activeTrackId && !session.combinedView;
    return `<button type="button" class="sidebar-item${planned ? ' is-plan' : ''}" data-sidebar-track="${escapeHtml(track.id)}" ${current ? 'aria-current="page"' : ''}>${trackIconHtml(track.id, 'sm', track.name)}<span>${escapeHtml(track.name)}</span></button>`;
  }

  function listHtml(queryInput) {
    const query = queryInput || '';
    const visible = new Set(tracksMatching(catalog(), query).map((track) => track.id));
    const state = api.getState();
    const planned = new Set([state.profile.primaryTrackId, ...(state.profile.companionIds || [])].filter(Boolean));
    return groupTracks(catalog()).map((group) => {
      const open = query ? true : !!session.openGroups[group.id];
      const items = group.tracks.filter((track) => visible.has(track.id));
      if (!items.length) return '';
      const body = open ? `<div class="stack">${items.map((track) => row(track, planned.has(track.id))).join('')}</div>` : '';
      return `<div><button type="button" class="group-toggle" data-group="${group.id}" aria-expanded="${open}"><span class="chev">${icon('chevronRight')}</span><span class="eyebrow">${escapeHtml(group.title)}</span><span class="mono">${items.length}</span></button>${body}</div>`;
    }).join('') || '<p class="muted">Nenhuma trilha com esse nome.</p>';
  }

  function render() {
    const chips = [{ id: 'all', title: 'Todas' }, ...groupTracks(catalog())];
    const group = session.sidebarGroup || 'all';
    if ($('sidebarGroups')) {
      $('sidebarGroups').innerHTML = chips.map((item) => `<button type="button" class="chip" data-sidebar-group="${item.id}" aria-pressed="${item.id === group}">${escapeHtml(item.title)}</button>`).join('');
    }
    const source = group === 'all' ? catalog() : catalog().filter((track) => track.group === group);
    const query = session.sidebarQuery || '';
    const visible = new Set(tracksMatching(source, query).map((track) => track.id));
    const state = api.getState();
    const planned = new Set([state.profile.primaryTrackId, ...(state.profile.companionIds || [])].filter(Boolean));
    $('sidebarList').innerHTML = groupTracks(source).map((section) => {
      const open = query ? true : session.openGroups[section.id] !== false && (session.openGroups[section.id] || section.id === 'carreira' && !query ? false : !!session.openGroups[section.id]);
      const expanded = query ? true : !!session.openGroups[section.id];
      const items = section.tracks.filter((track) => visible.has(track.id));
      if (!items.length) return '';
      return `<div style="margin-top:12px"><button type="button" class="group-toggle" data-group="${section.id}" aria-expanded="${expanded}"><span class="chev">${icon('chevronRight')}</span><span class="eyebrow">${escapeHtml(section.title)} ${items.length}</span></button>${expanded ? `<div class="stack">${items.map((track) => row(track, planned.has(track.id))).join('')}</div>` : ''}</div>`;
    }).join('') || '<p class="muted">Nenhuma trilha com esse nome.</p>';
    if ($('sheetList')) $('sheetList').innerHTML = listHtml($('sheetSearch')?.value || query);
  }

  function bind() {
    $('sidebarSearch').addEventListener('input', (event) => { session.sidebarQuery = event.target.value; render(); });
    $('sidebarGroups').addEventListener('click', (event) => {
      const chip = event.target.closest('[data-sidebar-group]');
      if (!chip) return;
      session.sidebarGroup = chip.dataset.sidebarGroup;
      render();
    });
    const pick = async (id) => {
      $('sheetDialog').close();
      await api.switchToTrack(id);
    };
    $('sidebarList').addEventListener('click', (event) => {
      const group = event.target.closest('[data-group]');
      if (group) {
        session.openGroups[group.dataset.group] = group.getAttribute('aria-expanded') !== 'true';
        render();
        return;
      }
      const item = event.target.closest('[data-sidebar-track]');
      if (item) pick(item.dataset.sidebarTrack);
    });
    $('sheetList').addEventListener('click', (event) => {
      const group = event.target.closest('[data-group]');
      if (group) {
        session.openGroups[group.dataset.group] = group.getAttribute('aria-expanded') !== 'true';
        render();
        return;
      }
      const item = event.target.closest('[data-sidebar-track]');
      if (item) pick(item.dataset.sidebarTrack);
    });
    $('sheetSearch').addEventListener('input', () => render());
    bindSheet();
  }

  function open() {
    render();
    openSheet();
  }

  return { bind, render, openSheet: open };
}
