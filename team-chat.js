(() => {
  "use strict";

  const API = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages";
  const STORE = "stip_session_v1";
  const state = {
    root: null,
    data: null,
    timer: null,
    loading: false,
    selection: false,
    selected: new Set(),
    pendingPhoto: null,
    lastSignature: "",
    replyTo: null,
  };
  const previewState = { root: null, data: null, timer: null, loading: false, signature: "" };
  const SUGGESTIONS = [
    { key: "search", label: "🔎 Je cherche", prefix: "🔎 Je cherche : " },
    { key: "available", label: "📍 Disponible à", prefix: "📍 Disponible à : " },
    { key: "missing", label: "⚠️ Manque", prefix: "⚠️ Manque : " },
    { key: "resolved", label: "✅ Trouvé / réglé", prefix: "✅ Trouvé / réglé : " },
    { key: "free", label: "💬 Message libre", prefix: "" },
  ];
  const PRIVACY_KEY = "stip_team_privacy_seen_v1";

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  const token = () => localStorage.getItem(STORE) || "";

  async function api(action, body = {}) {
    const response = await fetch(API, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-stip-session": token(),
      },
      body: JSON.stringify({ action, ...body }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.error) {
      throw Error(typeof json.error === "string" ? json.error : "Service indisponible.");
    }
    return json;
  }

  function fmtTime(value) {
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      }).format(new Date(value));
    } catch {
      return "";
    }
  }

  function fmtDay(value) {
    try {
      const date = new Date(value);
      const now = new Date();
      const source = date.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
      const today = now.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
      if (source === today) return "Aujourd’hui";
      return new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Europe/Paris",
      }).format(date).replace(".", "");
    } catch {
      return "";
    }
  }

  function agentName(agent = {}) {
    return (
      agent.nickname ||
      [agent.prenom, agent.nom].filter(Boolean).join(" ").trim() ||
      "Agent"
    );
  }

  function avatar(agent = {}) {
    const src =
      agent.profile_photo_url ||
      agent.avatar_signed_url ||
      agent.avatar_url ||
      "";
    const initials =
      ((agent.prenom?.[0] || "") + (agent.nom?.[0] || "")).toUpperCase() ||
      String(agentName(agent)).slice(0, 2).toUpperCase() ||
      "ST";
    return (
      '<span class="tc-avatar" data-avatar-fallback="' +
      esc(initials) +
      '">' +
      (src
        ? '<img src="' + esc(src) + '" alt="" loading="lazy">'
        : esc(initials)) +
      "</span>"
    );
  }

  function dataSignature(data) {
    return JSON.stringify(
      (data?.messages || []).map((message) => [
        message.id,
        message.created_at,
        message.body,
        message.payload?.photo_url || "",
        message.payload?.reply_to_id || "",
      ]),
    );
  }

  function shellMarkup() {
    return (
      '<section class="tc-shell tc-terrain-shell">' +
      '<header class="tc-head">' +
      '<button type="button" class="tc-back" data-close aria-label="Retour">‹</button>' +
      '<div class="tc-head-title"><small>ÉQUIPE</small><h2>Terrain</h2></div>' +
      '<span class="tc-readonly" data-readonly hidden>Lecture</span>' +
      '<div class="tc-head-actions">' +
      '<button type="button" data-install aria-label="Ajouter le raccourci téléphone">📱</button>' +
      '<button type="button" data-refresh aria-label="Actualiser">↻</button>' +
      '<button type="button" data-select hidden>Sélectionner</button>' +
      '</div></header>' +
      '<section class="tc-suggestions" data-suggestions></section>' +
      '<main class="tc-feed" data-feed><p class="tc-loading">Chargement…</p></main>' +
      '<section class="tc-selection-bar" data-selection-bar hidden>' +
      '<button type="button" data-select-all>Tout sélectionner</button>' +
      '<strong data-selection-count>0</strong>' +
      '<button type="button" class="danger" data-delete-selected>Supprimer</button>' +
      '<button type="button" data-selection-close>Annuler</button>' +
      '</section>' +
      '<section class="tc-reply-bar" data-reply-bar hidden></section>' +
      '<section class="tc-photo-preview" data-photo-preview hidden></section>' +
      '<form class="tc-composer" data-form>' +
      '<input type="file" accept="image/*" capture="environment" data-camera hidden>' +
      '<input type="file" accept="image/*" data-gallery hidden>' +
      '<button type="button" class="tc-media-btn" data-camera-open aria-label="Prendre une photo">📷</button>' +
      '<button type="button" class="tc-media-btn" data-gallery-open aria-label="Choisir une photo">▧</button>' +
      '<textarea name="body" rows="1" maxlength="2000" placeholder="Écrire sur Terrain…"></textarea>' +
      '<button type="submit" class="tc-send" aria-label="Envoyer">↑</button>' +
      '</form>' +
      '</section>'
    );
  }

  function mount(root) {
    if (!root) return;
    if (state.root !== root) {
      stop();
      state.root = root;
      state.data = null;
      state.selection = false;
      state.selected.clear();
      clearPendingPhoto();
      root.innerHTML = shellMarkup();
      bind(root);
    }
    load(false);
    if (!state.timer) {
      state.timer = setInterval(() => {
        if (!state.root?.isConnected) {
          stop();
          return;
        }
        if (!document.hidden) load(true);
      }, 5000);
    }
  }

  function stop() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function bind(root) {
    root.querySelector("[data-close]")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("stip:team-chat-close"));
    });
    root.querySelector("[data-install]")?.addEventListener("click", () => {
      location.href = "/team-chat.html";
    });
    root.querySelector("[data-refresh]")?.addEventListener("click", () => load(false));
    root.querySelector("[data-select]")?.addEventListener("click", () => toggleSelection(true));
    root.querySelector("[data-selection-close]")?.addEventListener("click", () => toggleSelection(false));
    root.querySelector("[data-select-all]")?.addEventListener("click", selectAll);
    root.querySelector("[data-delete-selected]")?.addEventListener("click", deleteSelected);

    root.querySelector("[data-camera-open]")?.addEventListener("click", async () => {
      if (!(await ensurePrivacy())) return;
      root.querySelector("[data-camera]")?.click();
    });
    root.querySelector("[data-gallery-open]")?.addEventListener("click", async () => {
      if (!(await ensurePrivacy())) return;
      root.querySelector("[data-gallery]")?.click();
    });
    root.querySelector("[data-camera]")?.addEventListener("change", (event) => {
      pickPhoto(event.target.files?.[0]);
    });
    root.querySelector("[data-gallery]")?.addEventListener("change", (event) => {
      pickPhoto(event.target.files?.[0]);
    });
    root.querySelector("[data-form]")?.addEventListener("submit", send);
    root.querySelector("textarea")?.addEventListener("input", (event) => {
      autoGrow(event.currentTarget);
    });

    root.addEventListener("click", (event) => {
      const photo = event.target.closest?.("[data-photo-url]");
      if (photo) {
        event.stopPropagation();
        openPhoto(photo.dataset.photoUrl);
        return;
      }
      const suggestion = event.target.closest?.("[data-suggestion]");
      if (suggestion) {
        applySuggestion(suggestion.dataset.suggestion);
        return;
      }
      const reply = event.target.closest?.("[data-reply-id]");
      if (reply) {
        setReply(reply.dataset.replyId);
        return;
      }
      if (event.target.closest?.("[data-reply-clear]")) {
        state.replyTo = null;
        renderReplyBar();
      }
    });
  }

  function autoGrow(element) {
    element.style.height = "auto";
    element.style.height = Math.min(110, Math.max(44, element.scrollHeight)) + "px";
  }

  async function load(quiet = false) {
    if (state.loading || !state.root) return;
    state.loading = true;
    try {
      const data = await api("team_thread");
      state.data = data;
      const canWrite = data.can_write !== false && data.access_mode !== "read";
      const selectButton = state.root.querySelector("[data-select]");
      if (selectButton) selectButton.hidden = !data.admin || !(data.messages || []).length;
      state.root.querySelector("[data-form]").hidden = !canWrite;
      state.root.querySelector("[data-suggestions]").hidden = !canWrite;
      state.root.querySelector("[data-readonly]").hidden = canWrite;
      if ((!data.admin || !(data.messages || []).length) && state.selection) {
        state.selection = false;
        state.selected.clear();
      }
      if (!canWrite) state.replyTo = null;
      renderSuggestions();
      renderReplyBar();

      const signature = dataSignature(data) + "|" + String(data.access_mode || "");
      if (!quiet || signature !== state.lastSignature) {
        state.lastSignature = signature;
        renderMessages();
      }
    } catch (error) {
      if (!quiet && state.root) {
        state.root.querySelector("[data-feed]").innerHTML =
          '<p class="tc-error">' + esc(error.message) + "</p>";
      }
    } finally {
      state.loading = false;
    }
  }

  function renderMessages() {
    const feed = state.root?.querySelector("[data-feed]");
    if (!feed) return;

    const messages = state.data?.messages || [];
    const me = String(state.data?.me?.id || "");
    const canWrite = state.data?.can_write !== false && state.data?.access_mode !== "read";
    const byId = new Map(messages.map((message) => [String(message.id), message]));

    if (!messages.length) {
      feed.innerHTML = '<div class="tc-empty" aria-hidden="true"><span>◎</span></div>';
      updateSelectionBar();
      return;
    }

    let previousDay = "";
    const html = [];

    for (const message of messages) {
      const day = fmtDay(message.created_at);
      const mine = String(message.sender_agent_id) === me;
      const photo = message.payload?.photo_url || "";
      const id = String(message.id);
      const checked = state.selected.has(id);

      if (day !== previousDay) {
        html.push('<div class="tc-day">' + esc(day) + "</div>");
        previousDay = day;
      }

      let row = '<article class="tc-message ' + (mine ? "mine" : "theirs");
      if (checked) row += " selected";
      row += '" data-message-id="' + esc(id) + '">';

      if (state.selection) {
        row +=
          '<label class="tc-check"><input type="checkbox" data-message-check="' +
          esc(id) +
          '"' +
          (checked ? " checked" : "") +
          '><span>✓</span></label>';
      }

      if (!mine) row += avatar(message.sender);

      row += '<div class="tc-bubble">';
      if (!mine) row += "<strong>" + esc(agentName(message.sender)) + "</strong>";

      const replyId = String(message.payload?.reply_to_id || "");
      if (replyId) {
        const parent = byId.get(replyId);
        if (parent) {
          const excerpt =
            String(parent.body || "").trim().slice(0, 90) ||
            (parent.payload?.photo_url ? "📷 Photo" : "Message");
          row +=
            '<div class="tc-reply-quote"><b>↩ ' +
            esc(agentName(parent.sender)) +
            "</b><span>" +
            esc(excerpt) +
            "</span></div>";
        } else {
          row += '<div class="tc-reply-quote is-expired"><span>↩ Message expiré</span></div>';
        }
      }

      if (photo) {
        row +=
          '<button type="button" class="tc-photo" data-photo-url="' +
          esc(photo) +
          '"><img src="' +
          esc(photo) +
          '" alt="Photo envoyée"></button>';
      }

      if (message.body) {
        row += "<p>" + esc(message.body).replace(/\n/g, "<br>") + "</p>";
      }

      row += '<div class="tc-message-meta"><time>' + esc(fmtTime(message.created_at)) + "</time>";
      if (canWrite && !state.selection)
        row += '<button type="button" data-reply-id="' + esc(id) + '" aria-label="Répondre">↩</button>';
      row += "</div></div></article>";
      html.push(row);
    }

    feed.innerHTML = html.join("");

    feed.querySelectorAll("[data-message-check]").forEach((input) => {
      input.addEventListener("change", () => {
        const id = String(input.dataset.messageCheck);
        if (input.checked) state.selected.add(id);
        else state.selected.delete(id);
        renderMessages();
      });
    });

    updateSelectionBar();
    if (!state.selection) {
      requestAnimationFrame(() => {
        feed.scrollTop = feed.scrollHeight;
      });
    }
  }

  function renderSuggestions() {
    const host = state.root?.querySelector("[data-suggestions]");
    if (!host) return;
    host.innerHTML = SUGGESTIONS.map(
      (item) =>
        '<button type="button" data-suggestion="' +
        esc(item.key) +
        '">' +
        esc(item.label) +
        "</button>",
    ).join("");
  }

  function applySuggestion(key) {
    const item = SUGGESTIONS.find((x) => x.key === key);
    const input = state.root?.querySelector("textarea");
    if (!item || !input) return;
    if (item.key !== "free") input.value = item.prefix;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    autoGrow(input);
  }

  function setReply(id) {
    const message = (state.data?.messages || []).find((x) => String(x.id) === String(id));
    if (!message) return;
    state.replyTo = String(message.id);
    renderReplyBar();
    state.root?.querySelector("textarea")?.focus();
  }

  function renderReplyBar() {
    const bar = state.root?.querySelector("[data-reply-bar]");
    if (!bar) return;
    if (!state.replyTo) {
      bar.hidden = true;
      bar.innerHTML = "";
      return;
    }
    const message = (state.data?.messages || []).find(
      (x) => String(x.id) === String(state.replyTo),
    );
    if (!message) {
      state.replyTo = null;
      bar.hidden = true;
      bar.innerHTML = "";
      return;
    }
    const excerpt =
      String(message.body || "").trim().slice(0, 110) ||
      (message.payload?.photo_url ? "📷 Photo" : "Message");
    bar.hidden = false;
    bar.innerHTML =
      '<span><b>↩ ' +
      esc(agentName(message.sender)) +
      "</b><small>" +
      esc(excerpt) +
      '</small></span><button type="button" data-reply-clear aria-label="Annuler la réponse">×</button>';
  }

  function toggleSelection(enabled) {
    state.selection = !!enabled;
    state.selected.clear();
    renderMessages();
  }

  function selectAll() {
    const ids = (state.data?.messages || []).map((message) => String(message.id));
    const everySelected = ids.length > 0 && ids.every((id) => state.selected.has(id));
    state.selected.clear();
    if (!everySelected) ids.forEach((id) => state.selected.add(id));
    renderMessages();
  }

  function updateSelectionBar() {
    const bar = state.root?.querySelector("[data-selection-bar]");
    const count = state.root?.querySelector("[data-selection-count]");
    if (!bar) return;
    bar.hidden = !state.selection;
    if (count) count.textContent = String(state.selected.size);
    const remove = bar.querySelector("[data-delete-selected]");
    if (remove) remove.disabled = !state.selected.size;
  }

  function confirmDelete(count) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "tc-confirm-wrap";
      wrap.innerHTML =
        '<section class="tc-confirm">' +
        '<div class="tc-confirm-icon">🗑️</div>' +
        "<h3>Supprimer définitivement ?</h3>" +
        "<p>" +
        count +
        " message" +
        (count > 1 ? "s" : "") +
        " seront supprimés.</p>" +
        "<div>" +
        '<button type="button" data-no><span>❌</span><strong>Annuler</strong></button>' +
        '<button type="button" class="danger" data-yes><span>✔️</span><strong>Confirmer</strong></button>' +
        "</div></section>";
      document.body.appendChild(wrap);

      const finish = (value) => {
        wrap.remove();
        resolve(value);
      };
      wrap.querySelector("[data-no]").onclick = () => finish(false);
      wrap.querySelector("[data-yes]").onclick = () => finish(true);
      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) finish(false);
      });
    });
  }

  async function deleteSelected() {
    const ids = [...state.selected];
    if (!ids.length) return;
    if (!(await confirmDelete(ids.length))) return;

    const button = state.root?.querySelector("[data-delete-selected]");
    if (button) button.disabled = true;

    try {
      await api("team_delete", { message_ids: ids });
      state.selected.clear();
      state.selection = false;
      await load(false);
    } catch (error) {
      alert(error.message || "Suppression impossible.");
      if (button) button.disabled = false;
    }
  }

  async function pickPhoto(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) {
      alert("Format d’image non pris en charge.");
      return;
    }

    try {
      const photo = await compress(file);
      clearPendingPhoto();
      state.pendingPhoto = photo;
      renderPhotoPreview();
    } catch (error) {
      alert(error.message || "Photo impossible à préparer.");
    }

    state.root?.querySelectorAll('input[type="file"]').forEach((input) => {
      input.value = "";
    });
  }

  function clearPendingPhoto() {
    if (state.pendingPhoto?.preview) {
      try {
        URL.revokeObjectURL(state.pendingPhoto.preview);
      } catch {}
    }
    state.pendingPhoto = null;
  }

  function renderPhotoPreview() {
    const box = state.root?.querySelector("[data-photo-preview]");
    if (!box) return;

    if (!state.pendingPhoto) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }

    box.hidden = false;
    box.innerHTML =
      '<img src="' +
      esc(state.pendingPhoto.preview) +
      '" alt=""><button type="button" aria-label="Retirer la photo">×</button>';

    box.querySelector("button").onclick = () => {
      clearPendingPhoto();
      renderPhotoPreview();
    };
  }

  async function compress(file) {
    const image = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const element = new Image();
      element.onload = () => {
        URL.revokeObjectURL(url);
        resolve(element);
      };
      element.onerror = () => {
        URL.revokeObjectURL(url);
        reject(Error("Image illisible."));
      };
      element.src = url;
    });

    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    const ratio = Math.min(1, 1600 / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * ratio));
    const height = Math.max(1, Math.round(originalHeight * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, width, height);

    let quality = 0.82;
    let blob = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 2200000) break;
      quality -= 0.1;
    }

    if (!blob) throw Error("Compression impossible.");
    if (blob.size > 2800000) throw Error("La photo reste trop lourde.");

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }

    return {
      mime: "image/jpeg",
      data: btoa(binary),
      width,
      height,
      preview: URL.createObjectURL(blob),
    };
  }

  async function send(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.body;
    const body = String(input.value || "").trim();
    const photo = state.pendingPhoto;

    if (!body && !photo) return;
    if (!(await ensurePrivacy())) return;

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;

    try {
      await api("team_send", {
        body,
        photo: photo
          ? {
              mime: photo.mime,
              data: photo.data,
              width: photo.width,
              height: photo.height,
            }
          : null,
        reply_to_id: state.replyTo || null,
      });

      input.value = "";
      autoGrow(input);
      clearPendingPhoto();
      renderPhotoPreview();
      state.replyTo = null;
      renderReplyBar();
      await load(false);
      await loadPreview(false);
    } catch (error) {
      alert(error.message || "Envoi impossible.");
    } finally {
      button.disabled = false;
    }
  }

  async function ensurePrivacy() {
    try {
      if (localStorage.getItem(PRIVACY_KEY) === "1") return true;
    } catch {}
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "tc-privacy-wrap";
      wrap.innerHTML =
        '<section class="tc-privacy"><div class="tc-privacy-icon">🔒</div>' +
        "<h3>Avant de publier</h3>" +
        "<p>Aucune donnée patient, information médicale nominative, photo de patient, écran ou document identifiable.</p>" +
        '<div><button type="button" data-no><span>❌</span><strong>Annuler</strong></button>' +
        '<button type="button" class="ok" data-yes><span>✔️</span><strong>Compris</strong></button></div></section>';
      document.body.appendChild(wrap);
      const finish = (value) => {
        if (value) {
          try {
            localStorage.setItem(PRIVACY_KEY, "1");
          } catch {}
        }
        wrap.remove();
        resolve(value);
      };
      wrap.querySelector("[data-no]").onclick = () => finish(false);
      wrap.querySelector("[data-yes]").onclick = () => finish(true);
      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) finish(false);
      });
    });
  }

  function previewText(message) {
    const body = String(message?.body || "").trim();
    if (body) return body;
    if (message?.payload?.photo_url) return "📷 Photo";
    return "Message";
  }

  function previewMarkup(data) {
    const messages = data?.messages || [];
    const canWrite = data?.can_write !== false && data?.access_mode !== "read";
    const recent = messages.slice(-4);
    let rows = "";
    recent.forEach((message, index) => {
      const clipped = recent.length === 4 && index === 0 ? " is-peek" : "";
      rows +=
        '<div class="tc-preview-message' +
        clipped +
        '"><b>' +
        esc(agentName(message.sender)) +
        "</b><span>" +
        esc(previewText(message)) +
        "</span><time>" +
        esc(fmtTime(message.created_at)) +
        "</time></div>";
    });
    if (!recent.length && canWrite) {
      rows =
        '<div class="tc-preview-empty-suggestions">' +
        SUGGESTIONS.slice(0, 4)
          .map(
            (item) =>
              '<button type="button" data-preview-suggestion="' +
              esc(item.key) +
              '">' +
              esc(item.label) +
              "</button>",
          )
          .join("") +
        "</div>";
    }
    if (!recent.length && !canWrite)
      rows = '<div class="tc-preview-readonly-empty" aria-hidden="true"><span>◎</span></div>';
    return (
      '<section class="tc-home-preview" data-preview-open tabindex="0" role="button" aria-label="Ouvrir Terrain">' +
      '<header><div><small>ÉQUIPE</small><strong>Terrain</strong></div>' +
      (canWrite
        ? '<button type="button" data-preview-quick aria-label="Partager une information">＋</button>'
        : '<span class="tc-preview-lock">Lecture</span>') +
      "</header>" +
      '<div class="tc-preview-window">' +
      rows +
      "</div>" +
      '<footer><span>Fil équipe</span><b>Ouvrir ›</b></footer>' +
      "</section>"
    );
  }

  function renderPreview() {
    const root = previewState.root;
    if (!root) return;
    root.innerHTML = previewMarkup(previewState.data || {});
  }

  async function loadPreview(quiet = false) {
    if (!previewState.root || previewState.loading) return;
    previewState.loading = true;
    try {
      const data = await api("team_thread");
      previewState.data = data;
      const signature = dataSignature(data) + "|" + String(data.access_mode || "");
      if (!quiet || signature !== previewState.signature) {
        previewState.signature = signature;
        renderPreview();
      }
    } catch (error) {
      if (!quiet && previewState.root)
        previewState.root.innerHTML =
          '<section class="tc-home-preview tc-preview-error"><header><div><small>ÉQUIPE</small><strong>Terrain</strong></div></header></section>';
    } finally {
      previewState.loading = false;
    }
  }

  function mountPreview(root) {
    if (!root) return;
    if (previewState.root !== root) {
      stopPreview();
      previewState.root = root;
      previewState.data = null;
      previewState.signature = "";
      root.innerHTML =
        '<section class="tc-home-preview tc-preview-loading"><header><div><small>ÉQUIPE</small><strong>Terrain</strong></div></header></section>';
      root.onclick = (event) => {
        const suggestion = event.target.closest?.("[data-preview-suggestion]");
        if (suggestion) {
          event.stopPropagation();
          openQuickComposer(suggestion.dataset.previewSuggestion);
          return;
        }
        if (event.target.closest?.("[data-preview-quick]")) {
          event.stopPropagation();
          openQuickComposer();
          return;
        }
        if (event.target.closest?.("[data-preview-open]"))
          window.dispatchEvent(new CustomEvent("stip:team-chat-open"));
      };
      root.onkeydown = (event) => {
        if ((event.key === "Enter" || event.key === " ") && event.target.closest?.("[data-preview-open]")) {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("stip:team-chat-open"));
        }
      };
    }
    loadPreview(false);
    if (!previewState.timer) {
      previewState.timer = setInterval(() => {
        if (!previewState.root?.isConnected) {
          stopPreview();
          return;
        }
        if (!document.hidden) loadPreview(true);
      }, 4500);
    }
  }

  function stopPreview() {
    if (previewState.timer) clearInterval(previewState.timer);
    previewState.timer = null;
  }

  function unmountPreview() {
    stopPreview();
    previewState.root = null;
    previewState.data = null;
    previewState.signature = "";
  }

  function unmountFull() {
    stop();
    state.root = null;
    state.selection = false;
    state.selected.clear();
    state.replyTo = null;
  }

  async function openQuickComposer(initialKey = "") {
    let data = previewState.data || state.data;
    try {
      if (!data) data = await api("team_thread");
    } catch (error) {
      alert(error.message || "Terrain indisponible.");
      return;
    }
    const canWrite = data?.can_write !== false && data?.access_mode !== "read";
    if (!canWrite) {
      alert("Terrain est en lecture seule pour cet accès.");
      return;
    }

    document.querySelector(".tc-quick-wrap")?.remove();
    const wrap = document.createElement("div");
    wrap.className = "tc-quick-wrap";
    wrap.innerHTML =
      '<section class="tc-quick-sheet"><header><div><small>ÉQUIPE</small><h3>Partager sur Terrain</h3></div><button type="button" data-quick-close aria-label="Fermer">×</button></header>' +
      '<div class="tc-quick-suggestions">' +
      SUGGESTIONS.map(
        (item) =>
          '<button type="button" data-quick-suggestion="' +
          esc(item.key) +
          '">' +
          esc(item.label) +
          "</button>",
      ).join("") +
      '</div><form data-quick-form><textarea name="body" rows="3" maxlength="2000" placeholder="Votre information…"></textarea>' +
      '<button type="submit">Publier</button></form></section>';
    document.body.appendChild(wrap);

    const textarea = wrap.querySelector("textarea");
    const setSuggestion = (key) => {
      const item = SUGGESTIONS.find((x) => x.key === key);
      if (!item) return;
      textarea.value = item.key === "free" ? "" : item.prefix;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    };
    if (initialKey) setSuggestion(initialKey);
    else setTimeout(() => textarea.focus(), 30);

    const close = () => wrap.remove();
    wrap.querySelector("[data-quick-close]").onclick = close;
    wrap.addEventListener("click", (event) => {
      if (event.target === wrap) close();
      const suggestion = event.target.closest?.("[data-quick-suggestion]");
      if (suggestion) setSuggestion(suggestion.dataset.quickSuggestion);
    });
    wrap.querySelector("[data-quick-form]").onsubmit = async (event) => {
      event.preventDefault();
      const body = String(textarea.value || "").trim();
      if (!body) return;
      if (!(await ensurePrivacy())) return;
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await api("team_send", { body });
        close();
        await loadPreview(false);
      } catch (error) {
        alert(error.message || "Publication impossible.");
        button.disabled = false;
      }
    };
  }

  function stopAll() {
    stop();
    stopPreview();
    state.root = null;
    state.data = null;
    state.replyTo = null;
    previewState.root = null;
    previewState.data = null;
  }

  function openPhoto(url) {
    if (!url) return;

    const wrap = document.createElement("div");
    wrap.className = "tc-lightbox";
    wrap.innerHTML =
      '<button type="button" aria-label="Fermer">×</button><img src="' +
      esc(url) +
      '" alt="Photo">';
    document.body.appendChild(wrap);

    const close = () => wrap.remove();
    wrap.querySelector("button").onclick = close;
    wrap.addEventListener("click", (event) => {
      if (event.target === wrap) close();
    });
  }

  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const host = image.closest?.(".tc-avatar");
      if (!host) return;
      host.textContent = host.dataset.avatarFallback || "ST";
    },
    true,
  );

  window.addEventListener("stip:session-ended", () => {
    stopAll();
    clearPendingPhoto();
  });

  window.STIPTeamChat = {
    mount,
    mountPreview,
    unmountFull,
    unmountPreview,
    openQuickComposer,
    refresh: () => load(false),
    stop: stopAll,
  };
})();