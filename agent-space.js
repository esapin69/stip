(() => {
'use strict';

const API = 'https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-onboarding';
const STORAGE = 'stip_session_v1';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[c]));
const nameOf = agent => [agent?.prenom, agent?.nom].filter(Boolean).join(' ').trim() || 'Agent STIP';
const dateFr = value => {
  if (!value) return '—';
  const d = new Date(String(value).length === 10 ? value + 'T12:00:00' : value);
  return Number.isNaN(d.valueOf()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
const statusLabel = value => ({
  active: 'En cours', draft: 'Brouillon', completed: 'Terminé', archived: 'Archivé',
  not_started: 'À faire', final: 'Validée', validated: 'Validée', cancelled: 'Annulée',
  observation: 'Observation', meeting: 'Rendez-vous', situation: 'Situation', note: 'Note'
}[value] || value || 'À faire');

let state = null;
let loading = null;
let selectedCase = null;
let activeTab = 'self';

async function api(action, body = {}) {
  const token = localStorage.getItem(STORAGE) || '';
  if (!token) throw new Error('SESSION_STIP_REQUISE');
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-STIP-Session': token },
    body: JSON.stringify({ action, ...body })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error || 'Service indisponible');
  return payload;
}

function ensureShell() {
  const appView = $('#appView');
  if (!appView || $('#agentSpaceView')) return;
  const view = document.createElement('section');
  view.id = 'agentSpaceView';
  view.className = 'view hidden agent-space-view';
  view.innerHTML = `
    <div class="view-head agent-space-head">
      <button class="back-btn" id="agentSpaceHome" type="button" aria-label="Retour à l’accueil">←</button>
      <div><p class="kicker">MON ESPACE STIP</p><h2>Ma fiche</h2></div>
    </div>
    <nav class="agent-space-tabs" aria-label="Espace agent">
      <button type="button" data-agent-tab="self" class="active">Ma fiche</button>
      <button type="button" data-agent-tab="manager" class="hidden">Responsable</button>
    </nav>
    <div id="agentSpaceContent"><div class="info-box">Chargement…</div></div>`;
  appView.appendChild(view);
  $('#agentSpaceHome').onclick = showHome;
  $$('[data-agent-tab]', view).forEach(button => {
    button.onclick = () => {
      activeTab = button.dataset.agentTab;
      selectedCase = null;
      renderSpace();
    };
  });
}

function showHome() {
  $$('.view').forEach(view => view.classList.add('hidden'));
  $('#homeView')?.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSpace(tab = 'self') {
  ensureShell();
  activeTab = tab;
  $$('.view').forEach(view => view.classList.add('hidden'));
  $('#agentSpaceView')?.classList.remove('hidden');
  renderSpace();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function progressOf(item) {
  const stages = item?.stages || [];
  return {
    done: stages.filter(stage => stage.record?.status === 'final').length,
    total: stages.length
  };
}

function renderHome() {
  const home = $('#homeView');
  const hero = $('.hero', home);
  if (!home || !hero || !state) return;
  let card = $('#agentHomeCard');
  if (!card) {
    card = document.createElement('section');
    card.id = 'agentHomeCard';
    card.className = 'agent-home-card';
    hero.insertAdjacentElement('afterend', card);
  }
  const agent = state.agent || {};
  const item = state.own_case;
  const progress = progressOf(item);
  card.innerHTML = `
    <div class="agent-home-main">
      <div class="agent-avatar" aria-hidden="true">${esc((agent.prenom || agent.nom || 'S').trim().charAt(0).toUpperCase())}</div>
      <div>
        <p class="kicker">MA FICHE PERSONNELLE</p>
        <h2>${esc(nameOf(agent))}</h2>
        <p>${esc([agent.role, agent.equipe || agent.ghe].filter(Boolean).join(' · ') || 'Équipe STIP')}</p>
      </div>
    </div>
    <div class="agent-home-progress">
      <span>${item ? esc(statusLabel(item.status)) : 'Profil actif'}</span>
      <strong>${item && progress.total ? progress.done + ' / ' + progress.total + ' étapes' : 'Données STIP'}</strong>
    </div>
    <div class="agent-home-actions">
      <button type="button" class="primary-btn" data-open-agent="self">Ouvrir ma fiche</button>
      ${state.can_manage ? '<button type="button" class="agent-secondary-btn" data-open-agent="manager">Espace responsable</button>' : ''}
    </div>`;
  $$('[data-open-agent]', card).forEach(button => {
    button.onclick = () => openSpace(button.dataset.openAgent);
  });
}

function bindModuleCards() {
  const grid = $('#moduleGrid');
  if (!grid || !state) return;
  const arrival = $$('.module-card', grid).find(card => $('strong', card)?.textContent.trim() === 'Nouveaux arrivants');
  if (arrival) {
    arrival.dataset.agentSpaceBound = 'true';
    const small = $('small', arrival);
    if (small) small.textContent = 'Ma fiche · parcours · évaluations · documents';
    arrival.onclick = () => openSpace('self');
  }
  const oldManager = $('[data-agent-space-manager]', grid);
  if (state.can_manage && !oldManager) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'module-card agent-manager-card';
    button.dataset.agentSpaceManager = 'true';
    button.innerHTML = '<span class="num">RESP</span><strong>Responsable</strong><small>Suivre les arrivants dans STIP</small>';
    button.onclick = () => openSpace('manager');
    grid.appendChild(button);
  }
  if (!state.can_manage && oldManager) oldManager.remove();
  if (grid.children.length) $('#emptyPermissions')?.classList.add('hidden');
}

async function refresh(force = false) {
  if (!localStorage.getItem(STORAGE)) {
    state = null;
    $('#agentHomeCard')?.remove();
    return null;
  }
  if (loading && !force) return loading;
  loading = api('bootstrap').then(payload => {
    state = payload;
    ensureShell();
    const managerTab = $('[data-agent-tab="manager"]');
    managerTab?.classList.toggle('hidden', !state.can_manage);
    if (!state.can_manage && activeTab === 'manager') activeTab = 'self';
    renderHome();
    bindModuleCards();
    if (!$('#agentSpaceView')?.classList.contains('hidden')) renderSpace();
    return state;
  }).catch(error => {
    if (!/SESSION/.test(error.message)) {
      const card = $('#agentHomeCard');
      if (card) card.innerHTML = '<div class="error-text">La fiche personnelle est momentanément indisponible.</div>';
    }
    return null;
  }).finally(() => { loading = null; });
  return loading;
}

function identityCard(agent, item) {
  return `
    <section class="agent-panel identity-panel">
      <div class="agent-panel-title">
        <div><p class="kicker">IDENTITÉ STIP</p><h3>${esc(nameOf(agent))}</h3></div>
        <span class="agent-status">${esc(item ? statusLabel(item.status) : 'Profil actif')}</span>
      </div>
      <dl class="agent-facts">
        <div><dt>Fonction</dt><dd>${esc(agent?.role || '—')}</dd></div>
        <div><dt>Équipe / GHE</dt><dd>${esc(agent?.equipe || agent?.ghe || '—')}</dd></div>
        <div><dt>Téléphone</dt><dd>${esc(agent?.telephone || '—')}</dd></div>
        <div><dt>E-mail</dt><dd>${esc(agent?.email || '—')}</dd></div>
      </dl>
    </section>`;
}

function stageCatalog(stage, payload, immutable) {
  const schema = stage.form_schema || {};
  const definitions = Array.isArray(schema.items) ? schema.items : [];
  if (!definitions.length) return immutable
    ? (payload.note ? '<p class="agent-note">' + esc(payload.note) + '</p>' : '<div class="info-box">Aucune saisie détaillée.</div>')
    : '<div class="info-box">Saisir une note générale pour cette étape.</div>';
  const values = payload.items || {};
  let section = '';
  const items = definitions.map(definition => {
    const value = values[definition.key] || {};
    const heading = definition.section && definition.section !== section
      ? (section = definition.section, '<h4 class="agent-stage-section">' + esc(section) + '</h4>') : '';
    if (immutable) {
      return heading + `<div class="agent-stage-result"><span>${esc(definition.label)}</span><strong>${esc(value.level || '—')}</strong>${value.observation ? '<p>' + esc(value.observation) + '</p>' : ''}</div>`;
    }
    const options = (schema.levels || []).map(level =>
      '<option value="' + esc(level) + '" ' + (value.level === level ? 'selected' : '') + '>' + esc(level) + '</option>'
    ).join('');
    return heading + `
      <div class="agent-stage-item" data-stage-item="${esc(definition.key)}">
        <p>${esc(definition.label)}</p>
        <div class="agent-form-two">
          <label>Niveau<select data-item-level><option value="">À renseigner…</option>${options}</select></label>
          <label>Observation<textarea data-item-observation placeholder="Obligatoire si le point reste à consolider">${esc(value.observation || '')}</textarea></label>
        </div>
      </div>`;
  }).join('');
  const bilanValues = payload.bilan || {};
  const bilan = (schema.bilan_fields || []).length ? `
    <div class="agent-stage-bilan">
      <h4>Bilan</h4>
      ${(schema.bilan_fields || []).map(field => immutable
        ? '<div class="agent-stage-result"><span>' + esc(field.label) + '</span><p>' + esc(bilanValues[field.key] || '—') + '</p></div>'
        : '<label>' + esc(field.label) + '<textarea data-bilan-key="' + esc(field.key) + '">' + esc(bilanValues[field.key] || '') + '</textarea></label>'
      ).join('')}
    </div>` : '';
  const choiceValues = payload.choices || {};
  const choiceGroups = [...new Set((schema.choices || []).map(choice => choice.group).filter(Boolean))];
  const choices = choiceGroups.map(group => {
    const field = (schema.bilan_fields || []).find(item => item.key === group);
    const options = (schema.choices || []).filter(choice => choice.group === group);
    if (immutable) {
      const selected = options.find(choice => choice.key === choiceValues[group]);
      return '<div class="agent-stage-choice"><strong>' + esc(field?.label || 'Choix') + '</strong><span>' + esc(selected?.label || '—') + '</span></div>';
    }
    return `<fieldset class="agent-stage-choice"><legend>${esc(field?.label || 'Choix')}</legend>${options.map(choice =>
      '<label><input type="radio" name="choice_' + esc(group) + '" data-choice-group="' + esc(group) + '" value="' + esc(choice.key) + '" ' + (choiceValues[group] === choice.key ? 'checked' : '') + '> ' + esc(choice.label) + '</label>'
    ).join('')}</fieldset>`;
  }).join('');
  return `<div class="agent-stage-catalog">${schema.objective ? '<div class="info-box">' + esc(schema.objective) + '</div>' : ''}${items}${bilan}${choices}</div>`;
}

function stageCard(stage, canFinalize) {
  const record = stage.record || {};
  const payload = record.payload || {};
  const immutable = record.status === 'final';
  const total = stage.form_schema?.items?.length || 0;
  const completed = Object.values(payload.items || {}).filter(item => item?.level).length;
  return `
    <article class="agent-stage ${immutable ? 'is-final' : ''}">
      <button type="button" class="agent-stage-toggle" aria-expanded="false">
        <span class="agent-stage-order">${String(stage.sort_order).padStart(2, '0')}</span>
        <span><strong>${esc(stage.label)}</strong><small>${esc(statusLabel(record.status))}${total ? ' · ' + completed + '/' + total + ' points' : ''}${stage.due_after_days != null ? ' · J+' + esc(stage.due_after_days) : ''}</small></span>
        <span aria-hidden="true">⌄</span>
      </button>
      <div class="agent-stage-body hidden">
        ${immutable ? `
          <div class="info-box">Étape validée le ${esc(dateFr(record.finalized_at || record.validation_date))}. Cette version est figée.</div>
          ${stageCatalog(stage, payload, true)}
        ` : `
          <form class="agent-stage-form" data-stage-form="${esc(stage.stage_key)}">
            ${stageCatalog(stage, payload, false)}
            <label>Note générale facultative<textarea name="note">${esc(payload.note || '')}</textarea></label>
            <div class="agent-inline-actions">
              <button type="submit" class="agent-secondary-btn">Enregistrer le brouillon</button>
              ${canFinalize ? '<button type="button" class="primary-btn" data-finalize-stage>Valider définitivement</button>' : ''}
            </div>
            <p class="agent-form-message" aria-live="polite"></p>
          </form>`}
      </div>
    </article>`;
}

function evaluationsBlock(item) {
  const rows = item.evaluations || [];
  return `
    <section class="agent-panel">
      <div class="agent-panel-title"><div><p class="kicker">ÉVALUATIONS</p><h3>Historique officiel</h3></div><span>${rows.length}</span></div>
      <div class="agent-list">
        ${rows.length ? rows.map(row => `
          <details class="agent-evaluation">
            <summary><span><strong>Version ${esc(row.version)}</strong><small>${esc(dateFr(row.evaluation_date))} · ${esc(row.evaluator_name)}</small></span><span class="agent-status">${esc(statusLabel(row.status))}</span></summary>
            <div class="agent-evaluation-body">
              <p><strong>Décision :</strong> ${esc(row.decision || '—')}</p>
              <div class="agent-ratings">${Object.entries(row.criteria || {}).map(([label, rating]) => '<div><span>' + esc(label) + '</span><strong>' + esc(rating || '—') + '</strong></div>').join('')}</div>
              ${Object.entries(row.observations || {}).filter(([, value]) => value).map(([label, value]) => '<p><strong>' + esc(label) + ' :</strong> ' + esc(value) + '</p>').join('')}
            </div>
          </details>`).join('') : '<div class="empty">Aucune évaluation enregistrée.</div>'}
      </div>
    </section>`;
}

function documentsBlock(item) {
  const rows = item.documents || [];
  return `
    <section class="agent-panel">
      <div class="agent-panel-title"><div><p class="kicker">DOCUMENTS</p><h3>Dossier sécurisé</h3></div><span>${rows.length}</span></div>
      <div class="agent-document-list">
        ${rows.length ? rows.map(row => `
          <button type="button" class="agent-document" data-document-id="${esc(row.id)}">
            <span aria-hidden="true">▣</span>
            <span><strong>${esc(row.file_name)}</strong><small>${esc(row.document_kind === 'evaluation_pdf' ? 'Évaluation PDF' : 'Archive du dossier')} · ${esc(dateFr(row.source_created_at || row.created_at))}</small></span>
            <span>Ouvrir</span>
          </button>`).join('') : '<div class="empty">Aucun document.</div>'}
      </div>
    </section>`;
}

function eventsBlock(item) {
  const rows = item.events || [];
  return `
    <section class="agent-panel">
      <div class="agent-panel-title"><div><p class="kicker">JOURNAL</p><h3>Observations et rendez-vous</h3></div><span>${rows.length}</span></div>
      <form id="agentEventForm" class="agent-event-form">
        <div class="agent-form-two">
          <label>Type<select name="event_type"><option value="observation">Observation</option><option value="meeting">Rendez-vous</option><option value="situation">Situation</option><option value="note">Note</option></select></label>
          <label>Titre<input name="title" required maxlength="250"></label>
        </div>
        <label>Détail<textarea name="notes" maxlength="10000"></textarea></label>
        <button type="submit" class="agent-secondary-btn">Ajouter au journal</button>
        <p class="agent-form-message" aria-live="polite"></p>
      </form>
      <div class="agent-timeline">
        ${rows.length ? rows.map(row => '<article><time>' + esc(dateFr(row.occurred_at)) + '</time><div><strong>' + esc(row.title) + '</strong><small>' + esc(statusLabel(row.event_type)) + '</small>' + (row.notes ? '<p>' + esc(row.notes) + '</p>' : '') + '</div></article>').join('') : '<div class="empty">Aucun événement dans ce dossier.</div>'}
      </div>
    </section>`;
}

function caseWorkspace(item, options = {}) {
  const agent = item?.agent || options.agent || state?.agent || {};
  if (!item) {
    return identityCard(agent, null) + '<div class="empty">Aucun parcours d’intégration actif. La fiche STIP reste disponible et aucun historique n’a été inventé.</div>';
  }
  const profile = item.profile_data || {};
  const canFinalize = !!options.manager;
  return `
    ${identityCard(agent, item)}
    <section class="agent-panel">
      <div class="agent-panel-title"><div><p class="kicker">DOSSIER D’INTÉGRATION</p><h3>Informations de suivi</h3></div><span>Arrivée ${esc(dateFr(item.arrival_date))}</span></div>
      <form id="agentProfileForm" class="agent-profile-form">
        <div class="agent-form-two">
          <label>Téléphone de suivi<input name="telephone" value="${esc(profile.telephone || profile.legacy_phone || agent.telephone || '')}"></label>
          <label>Matricule<input name="matricule" value="${esc(profile.matricule || profile.legacy_matricule || '')}"></label>
        </div>
        <label>Expériences / repères<textarea name="experiences">${esc(profile.experiences || item.experience_text || '')}</textarea></label>
        ${canFinalize ? `<div class="agent-form-two"><label>Date d’arrivée<input type="date" name="arrival_date" value="${esc(item.arrival_date || '')}"></label><label>Vérification<select name="verification_status"><option value="">À vérifier</option><option value="ok" ${item.verification_status === 'ok' ? 'selected' : ''}>Vérifié</option><option value="a_corriger" ${item.verification_status === 'a_corriger' ? 'selected' : ''}>À corriger</option></select></label></div>` : ''}
        <button type="submit" class="agent-secondary-btn">Enregistrer la fiche</button>
        <p class="agent-form-message" aria-live="polite"></p>
      </form>
    </section>
    <section class="agent-panel">
      <div class="agent-panel-title"><div><p class="kicker">PARCOURS</p><h3>Les étapes dans l’ordre</h3></div><span>${progressOf(item).done} / ${progressOf(item).total}</span></div>
      <div class="agent-stages">${(item.stages || []).map(stage => stageCard(stage, canFinalize)).join('')}</div>
    </section>
    ${evaluationsBlock(item)}
    ${documentsBlock(item)}
    ${eventsBlock(item)}
    ${canFinalize ? `<section class="agent-panel agent-danger-zone"><div><strong>Cycle du dossier</strong><p>Terminer fige ce parcours comme accompli. Archiver le retire des suivis actifs.</p></div><div class="agent-inline-actions"><button type="button" class="agent-secondary-btn" data-case-status="completed">Marquer terminé</button><button type="button" class="agent-text-btn" data-case-status="archived">Archiver</button></div></section>` : ''}`;
}

function wireCase(item, manager) {
  $$('.agent-stage-toggle').forEach(button => {
    button.onclick = () => {
      const body = button.nextElementSibling;
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      body.classList.toggle('hidden', open);
    };
  });
  $$('.agent-stage-form').forEach(form => {
    const submit = async finalize => {
      const message = $('.agent-form-message', form);
      message.textContent = finalize ? 'Validation…' : 'Enregistrement…';
      const data = new FormData(form);
      const items = {};
      $$('[data-stage-item]', form).forEach(row => {
        items[row.dataset.stageItem] = {
          level: $('[data-item-level]', row)?.value || '',
          observation: $('[data-item-observation]', row)?.value || ''
        };
      });
      const bilan = {};
      $$('[data-bilan-key]', form).forEach(field => { bilan[field.dataset.bilanKey] = field.value; });
      const choices = {};
      $$('[data-choice-group]:checked', form).forEach(field => { choices[field.dataset.choiceGroup] = field.value; });
      const payload = { items, bilan, choices, note: data.get('note') || '' };
      try {
        await api(finalize ? 'stage_finalize' : 'stage_save', { case_id: item.id, stage_key: form.dataset.stageForm, payload });
        await reloadCurrentCase(item.id, manager);
      } catch (error) {
        message.textContent = error.message;
        message.className = 'agent-form-message error-text';
      }
    };
    form.onsubmit = event => { event.preventDefault(); submit(false); };
    $('[data-finalize-stage]', form)?.addEventListener('click', () => {
      if (confirm('Valider cette étape définitivement ?')) submit(true);
    });
  });
  const profileForm = $('#agentProfileForm');
  if (profileForm) profileForm.onsubmit = async event => {
    event.preventDefault();
    const data = new FormData(profileForm);
    const message = $('.agent-form-message', profileForm);
    message.textContent = 'Enregistrement…';
    try {
      const body = {
        case_id: item.id,
        profile_data: { telephone: data.get('telephone'), matricule: data.get('matricule'), experiences: data.get('experiences') }
      };
      if (manager) {
        body.arrival_date = data.get('arrival_date');
        body.verification_status = data.get('verification_status');
        body.experience_text = data.get('experiences');
      }
      await api('profile_update', body);
      await reloadCurrentCase(item.id, manager);
    } catch (error) {
      message.textContent = error.message;
      message.className = 'agent-form-message error-text';
    }
  };
  const eventForm = $('#agentEventForm');
  if (eventForm) eventForm.onsubmit = async event => {
    event.preventDefault();
    const data = new FormData(eventForm);
    const message = $('.agent-form-message', eventForm);
    message.textContent = 'Ajout…';
    try {
      await api('event_add', { case_id: item.id, event_type: data.get('event_type'), title: data.get('title'), notes: data.get('notes') });
      await reloadCurrentCase(item.id, manager);
    } catch (error) {
      message.textContent = error.message;
      message.className = 'agent-form-message error-text';
    }
  };
  $$('[data-document-id]').forEach(button => {
    button.onclick = async () => {
      const popup = window.open('', '_blank', 'noopener,noreferrer');
      try {
        const result = await api('document_url', { document_id: button.dataset.documentId });
        if (popup) popup.location = result.url;
        else window.location.href = result.url;
      } catch (error) {
        popup?.close();
        alert(error.message);
      }
    };
  });
  $$('[data-case-status]').forEach(button => {
    button.onclick = async () => {
      const status = button.dataset.caseStatus;
      if (!confirm(status === 'completed' ? 'Marquer ce parcours comme terminé ?' : 'Archiver ce parcours ?')) return;
      try {
        await api('case_status', { case_id: item.id, status });
        selectedCase = null;
        await refresh(true);
        renderSpace();
      } catch (error) { alert(error.message); }
    };
  });
}

async function reloadCurrentCase(caseId, manager) {
  const payload = await api('case_detail', { case_id: caseId });
  if (manager) selectedCase = payload.case;
  else state.own_case = payload.case;
  renderSpace();
  renderHome();
}

function renderSelf() {
  const content = $('#agentSpaceContent');
  content.innerHTML = caseWorkspace(state.own_case, { agent: state.agent, manager: false });
  if (state.own_case) wireCase(state.own_case, false);
}

function syncSummary() {
  const sync = state.sync || {};
  const counts = sync.last_counts || {};
  return `
    <section class="agent-sync-banner">
      <div><p class="kicker">SOURCE DES DONNÉES</p><strong>${sync.mode === 'database_only' ? 'Supabase est la source officielle' : 'Migration Drive → Supabase en cours'}</strong></div>
      <div><span>${esc(sync.last_status || 'Import initial')}</span><small>${sync.last_completed_at ? 'Dernier contrôle ' + esc(dateFr(sync.last_completed_at)) : 'Contrôle à finaliser'}</small></div>
      ${sync.last_error ? '<p class="error-text">' + esc(sync.last_error) + '</p>' : ''}
      ${counts.documents_copied != null ? '<small>' + esc(counts.documents_copied) + ' document(s) copié(s) au dernier passage</small>' : ''}
    </section>`;
}

function managerList() {
  const rows = state.managed_cases || [];
  return `
    ${syncSummary()}
    <section class="agent-panel">
      <div class="agent-panel-title"><div><p class="kicker">NOUVEL ARRIVANT</p><h3>Ouvrir un dossier</h3></div></div>
      <form id="agentCreateCase" class="agent-create-form">
        <label>Rechercher dans les agents STIP<div class="agent-search-row"><input name="query" placeholder="Nom, prénom, équipe…"><button type="button" class="agent-secondary-btn" id="agentSearchButton">Rechercher</button></div></label>
        <label>Agent<select name="agent_id" required><option value="">Lancer une recherche…</option></select></label>
        <label>Date d’arrivée<input type="date" name="arrival_date"></label>
        <button type="submit" class="primary-btn">Créer le parcours</button>
        <p class="agent-form-message" aria-live="polite"></p>
      </form>
    </section>
    <section class="agent-panel">
      <div class="agent-panel-title"><div><p class="kicker">RESPONSABLE</p><h3>Dossiers en cours</h3></div><span>${rows.length}</span></div>
      <div class="agent-case-list">
        ${rows.length ? rows.map(item => `
          <button type="button" data-managed-case="${esc(item.id)}">
            <span class="agent-avatar small">${esc(nameOf(item.agent).charAt(0).toUpperCase())}</span>
            <span><strong>${esc(nameOf(item.agent))}</strong><small>${esc([item.agent?.role, item.agent?.equipe || item.agent?.ghe].filter(Boolean).join(' · '))}</small></span>
            <span><strong>${esc(item.progress?.final || 0)} / 6</strong><small>étapes validées</small></span>
          </button>`).join('') : '<div class="empty">Aucun dossier actif.</div>'}
      </div>
    </section>`;
}

function wireManagerList() {
  const form = $('#agentCreateCase');
  const search = async () => {
    const message = $('.agent-form-message', form);
    message.textContent = 'Recherche…';
    try {
      const data = new FormData(form);
      const payload = await api('agent_search', { query: data.get('query') });
      const select = $('[name="agent_id"]', form);
      select.innerHTML = '<option value="">Choisir un agent…</option>' + (payload.items || []).map(agent =>
        '<option value="' + esc(agent.id) + '">' + esc(nameOf(agent) + ' · ' + (agent.role || agent.equipe || agent.ghe || 'STIP')) + '</option>'
      ).join('');
      message.textContent = payload.items?.length ? payload.items.length + ' résultat(s)' : 'Aucun agent disponible.';
    } catch (error) {
      message.textContent = error.message;
      message.className = 'agent-form-message error-text';
    }
  };
  $('#agentSearchButton').onclick = search;
  form.onsubmit = async event => {
    event.preventDefault();
    const data = new FormData(form);
    const message = $('.agent-form-message', form);
    message.textContent = 'Création…';
    try {
      const payload = await api('case_create', { agent_id: data.get('agent_id'), arrival_date: data.get('arrival_date'), profile_data: {} });
      selectedCase = payload.case;
      await refresh(true);
      selectedCase = payload.case;
      renderSpace();
    } catch (error) {
      message.textContent = error.message;
      message.className = 'agent-form-message error-text';
    }
  };
  $$('[data-managed-case]').forEach(button => {
    button.onclick = async () => {
      const content = $('#agentSpaceContent');
      content.innerHTML = '<div class="info-box">Ouverture du dossier…</div>';
      try {
        const payload = await api('case_detail', { case_id: button.dataset.managedCase });
        selectedCase = payload.case;
        renderSpace();
      } catch (error) {
        content.innerHTML = '<div class="error-text">' + esc(error.message) + '</div>';
      }
    };
  });
}

function renderManager() {
  const content = $('#agentSpaceContent');
  if (!state.can_manage) {
    content.innerHTML = '<div class="error-text">Accès responsable non autorisé.</div>';
    return;
  }
  if (selectedCase) {
    content.innerHTML = '<button type="button" class="agent-list-back" id="agentCaseBack">← Tous les dossiers</button>' + caseWorkspace(selectedCase, { manager: true });
    $('#agentCaseBack').onclick = () => { selectedCase = null; renderSpace(); };
    wireCase(selectedCase, true);
  } else {
    content.innerHTML = managerList();
    wireManagerList();
  }
}

function renderSpace() {
  ensureShell();
  const content = $('#agentSpaceContent');
  if (!state) {
    content.innerHTML = '<div class="info-box">Chargement de ta fiche…</div>';
    refresh(true);
    return;
  }
  $$('[data-agent-tab]').forEach(button => button.classList.toggle('active', button.dataset.agentTab === activeTab));
  const title = $('.agent-space-head h2');
  if (title) title.textContent = activeTab === 'manager' ? 'Espace responsable' : 'Ma fiche';
  if (activeTab === 'manager') renderManager();
  else renderSelf();
}

ensureShell();
const grid = $('#moduleGrid');
if (grid) new MutationObserver(() => {
  if (!localStorage.getItem(STORAGE)) return;
  if (state) bindModuleCards();
  else refresh();
}).observe(grid, { childList: true });
new MutationObserver(() => {
  if (!$('#appView')?.classList.contains('hidden') && localStorage.getItem(STORAGE)) refresh();
  if ($('#appView')?.classList.contains('hidden')) $('#agentHomeCard')?.remove();
}).observe($('#appView') || document.body, { attributes: true, attributeFilter: ['class'] });
refresh();
})();
