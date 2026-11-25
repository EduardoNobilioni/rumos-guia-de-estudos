import { LEVELS, LEVEL_LABELS, applyImport, buildExport, clampHours, newId } from '../model.js';
import { escapeHtml, icon, safeUrl } from './dom.js';

export function initDialogs(api) {
  const { $, toast, persist } = api;
  let editingTopic = null;
  let editingProject = null;
  let pendingPlan = null;

  function fillLevels(select, selected) {
    select.innerHTML = LEVELS.map((level) => `<option value="${level}" ${level === selected ? 'selected' : ''}>${LEVEL_LABELS[level]}</option>`).join('');
  }
  function fillPhases(select, selected) {
    const track = api.activeTrack();
    select.innerHTML = (track?.phases || []).map((phase) => `<option value="${escapeHtml(phase.id)}" ${phase.id === selected ? 'selected' : ''}>Etapa ${phase.number}: ${escapeHtml(phase.title)}</option>`).join('');
  }

  function openTopicDialog(topic) {
    editingTopic = topic || null;
    $('topicDialogTitle').textContent = topic ? 'Editar tópico' : 'Tópico seu';
    fillPhases($('topicPhase'), topic?.phaseId || api.activeTrack().phases[0].id);
    $('topicTitle').value = topic?.title || '';
    $('topicDescription').value = topic?.description || '';
    fillLevels($('topicLevel'), topic?.level || api.activeTrackState().level);
    $('topicHours').value = topic?.hours || 4;
    $('topicTags').value = (topic?.tags || []).join(', ');
    api.session.dialogResources = (topic?.resources || []).map((resource) => ({ title: resource.title, url: resource.url, lang: resource.lang === 'en' ? 'en' : 'pt', kind: resource.kind || 'leitura' }));
    renderResources();
    $('topicDialog').showModal();
  }

  function renderResources() {
    $('topicResourcesList').innerHTML = api.session.dialogResources.map((resource, index) => `<li class="spread"><span>${escapeHtml(resource.title)}</span><button type="button" data-remove-dialog-res="${index}">Remover</button></li>`).join('');
  }

  function openProjectDialog(phaseId, project) {
    editingProject = project || null;
    $('projectDialogTitle').textContent = project ? 'Editar ideia' : 'Ideia sua';
    fillPhases($('projectPhase'), project?.phaseId || phaseId);
    $('projectTitle').value = project?.title || '';
    $('projectDescription').value = project?.description || '';
    fillLevels($('projectLevel'), project?.level || api.activeTrackState().level);
    $('projectHours').value = project?.hours || 6;
    $('projectDialog').showModal();
  }

  async function askConfirm(options) {
    $('confirmTitle').textContent = options.title;
    $('confirmBody').textContent = options.body;
    $('confirmAccept').textContent = options.confirmLabel;
    $('confirmAccept').className = options.danger === false ? 'btn btn-primary' : 'btn btn-danger';
    const dialog = $('confirmDialog');
    const result = await new Promise((resolve) => {
      const onClose = () => { dialog.removeEventListener('close', onClose); resolve(dialog.returnValue === 'confirm'); };
      dialog.addEventListener('close', onClose);
      dialog.showModal();
    });
    return result;
  }

  function bind() {
    $('topicDetailClose').innerHTML = icon('x');
    $('infoDialogClose').innerHTML = icon('x');
    $('topicCancel').addEventListener('click', () => $('topicDialog').close());
    $('projectCancel').addEventListener('click', () => $('projectDialog').close());
    $('topicDetailClose').addEventListener('click', () => $('topicDetailDialog').close());
    $('infoDialogClose').addEventListener('click', () => $('infoDialog').close());
    document.querySelectorAll('dialog').forEach((dialog) => {
      let downOnBackdrop = false;
      dialog.addEventListener('pointerdown', (event) => {
        downOnBackdrop = event.target === dialog;
      });
      dialog.addEventListener('click', (event) => {
        if (downOnBackdrop && event.target === dialog) dialog.close('cancel');
        downOnBackdrop = false;
      });
    });
    $('topicAddResourceBtn').addEventListener('click', () => {
      const title = $('topicResourceTitle').value.trim();
      const url = $('topicResourceUrl').value.trim();
      if (!title || !safeUrl(url)) return toast('Título e link http(s).', 'error');
      api.session.dialogResources.push({ title, url, lang: $('topicResourceLang').value, kind: $('topicResourceKind').value });
      $('topicResourceTitle').value = '';
      $('topicResourceUrl').value = '';
      renderResources();
    });
    $('topicResourcesList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-dialog-res]');
      if (!button) return;
      api.session.dialogResources.splice(Number(button.dataset.removeDialogRes), 1);
      renderResources();
    });
    $('topicForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const trackState = api.activeTrackState();
      const title = $('topicTitle').value.trim();
      if (title.length < 2) return toast('Dá um título.', 'error');
      const data = {
        id: editingTopic?.id || newId('topico'),
        phaseId: $('topicPhase').value,
        title,
        description: $('topicDescription').value.trim(),
        level: $('topicLevel').value,
        hours: clampHours($('topicHours').value) || 4,
        tags: $('topicTags').value.split(',').map((tag) => tag.trim()).filter(Boolean),
        prerequisites: [],
        resources: api.session.dialogResources,
        custom: true,
      };
      trackState.customTopics = trackState.customTopics.filter((topic) => topic.id !== data.id);
      trackState.customTopics.push(data);
      $('topicDialog').close();
      persist(api.getState().activeTrackId);
      api.refresh('roadmap');
    });
    $('projectForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const trackState = api.activeTrackState();
      const title = $('projectTitle').value.trim();
      if (title.length < 2) return toast('Dá um título pra ideia.', 'error');
      const data = {
        id: editingProject?.id || newId('projeto'),
        phaseId: $('projectPhase').value,
        title,
        description: $('projectDescription').value.trim(),
        level: $('projectLevel').value,
        hours: clampHours($('projectHours').value) || 4,
        custom: true,
      };
      trackState.customProjects = trackState.customProjects.filter((project) => project.id !== data.id);
      trackState.customProjects.push(data);
      $('projectDialog').close();
      persist(api.getState().activeTrackId);
      api.refresh('roadmap');
    });
    $('copyShareBtn').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('shareUrl').value); toast('Link copiado.'); }
      catch { $('shareUrl').select(); toast('Copia o link na mão.', 'error'); }
    });
    $('applyShareBtn').addEventListener('click', () => {
      if (!pendingPlan) return;
      api.applyShare(pendingPlan);
      pendingPlan = null;
      $('sharedDialog').close();
      api.persistAll();
      api.refresh();
      toast('Plano aplicado. Progresso e anotações ficaram.');
    });
    $('importFileInput').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          applyImport(api.getState(), parsed);
          api.persistAll();
          api.refresh();
          toast('Backup restaurado.');
        } catch { toast('Esse JSON não entrou.', 'error'); }
      };
      reader.readAsText(file);
    });
    $('renameNoticeDismiss').addEventListener('click', () => {
      const profile = api.getState().profile;
      if (!profile.dismissedNotices.includes('dados-ciencia')) profile.dismissedNotices.push('dados-ciencia');
      api.persist();
      api.renderNotice();
    });
    $('siteFooter').addEventListener('click', (event) => {
      const button = event.target.closest('[data-footer-action]');
      if (!button) return;
      if (button.dataset.footerAction === 'about') {
        api.showHome();
        return;
      }
      const copy = {
        privacy: ['Privacidade', '<p>O Rumos não tem cadastro, cookie de rastreio nem analytics. Progresso, anotação e plano ficam no localStorage deste navegador. O link de compartilhar leva só a configuração, no # da URL.</p><p>O site é estático no GitHub Pages. As fontes vêm do próprio repositório. Link externo segue a regra de quem publicou.</p>'],
        terms: ['Termos', '<p>O Rumos é gratuito, licença MIT, feito pra estudar. Trilha, hora e projeto são orientação, não certificado.</p><p>Os links saem pra documentação e curso de outras pessoas. Se um quebrou, abre uma issue.</p>'],
        accessibility: ['Acessibilidade', '<p>A meta é WCAG 2.2 AA: teclado, foco visível, contraste e prefers-reduced-motion. Se travar em algum ponto, abre uma issue.</p>'],
      };
      const info = copy[button.dataset.footerAction];
      if (!info) return;
      $('infoDialogTitle').textContent = info[0];
      $('infoDialogBody').innerHTML = info[1];
      $('infoDialog').showModal();
    });
  }

  return {
    bind,
    openTopicDialog,
    openProjectDialog,
    askConfirm,
    setPending(plan) { pendingPlan = plan; },
    exportJson() {
      const blob = new Blob([JSON.stringify(buildExport(api.getState()), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rumos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
  };
}
