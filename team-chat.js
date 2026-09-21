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
  };

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
      ]),
    );
  }

  function shellMarkup() {
    return (
      '<section class="tc-shell">' +
      '<header class="tc-head">' +
      '<div><small>ÉQUIPE</small><h2>Chat équipe</h2></div>' +
      '<div class="tc-head-actions">' +
      '<button type="button" data-install aria-label="Ajouter le raccourci téléphone">📱</button>' +
      '<button type="button" data-refresh aria-label="Actualiser">↻</button>' +
      '<button type="button" data-select hidden>Sélectionner</button>' +
      "</div></header>" +
      '<main class="tc-feed" data-feed><p class="tc-loading">Chargement…</p></main>' +
      '<section class="tc-selection-bar" data-selection-bar hidden>' +
      '<button type="button" data-select-all>Tout sélectionner</button>' +
      '<strong data-selection-count>0</strong>' +
      '<button type="button" class="danger" data-delete-selected>Supprimer</button>' +
      '<button type="button" data-selection-close>Annuler</button>' +
      "</section>" +
      '<section class="tc-photo-preview" data-photo-preview hidden></section>' +
      '<form class="tc-composer" data-form>' +
      '<input type="file" accept="image/*" capture="environment" data-camera hidden>' +
      '<input type="file" accept="image/*" data-gallery hidden>' +
      '<button type="button" class="tc-media-btn" data-camera-open aria-label="Prendre une photo">📷</button>' +
      '<button type="button" class="tc-media-btn" data-gallery-open aria-label="Choisir une photo">▧</button>' +
      '<textarea name="body" rows="1" maxlength="2000" placeholder="Message…"></textarea>' +
      '<button type="submit" class="tc-send" aria-label="Envoyer">↑</button>' +
      "</form>" +
      "</section>"
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
    root.querySelector("[data-install]")?.addEventListener("click", () => {
      location.href = "/team-chat.html";
    });
    root.querySelector("[data-refresh]")?.addEventListener("click", () => load(false));
    root.querySelector("[data-select]")?.addEventListener("click", () => toggleSelection(true));
    root.querySelector("[data-selection-close]")?.addEventListener("click", () => toggleSelection(false));
    root.querySelector("[data-select-all]")?.addEventListener("click", selectAll);
    root.querySelector("[data-delete-selected]")?.addEventListener("click", deleteSelected);

    root.querySelector("[data-camera-open]")?.addEventListener("click", () => {
      root.querySelector("[data-camera]")?.click();
    });
    root.querySelector("[data-gallery-open]")?.addEventListener("click", () => {
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
      if (photo) openPhoto(photo.dataset.photoUrl);
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
      const selectButton = state.root.querySelector("[data-select]");
      if (selectButton) selectButton.hidden = !data.admin;

      const signature = dataSignature(data);
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

    if (!messages.length) {
      feed.innerHTML =
        '<div class="tc-empty"><span>💬</span><strong>Aucun message pour l’instant</strong><small>Le premier message de l’équipe apparaîtra ici.</small></div>';
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

      row += "<time>" + esc(fmtTime(message.created_at)) + "</time></div></article>";
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

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;

    try {
      let photoPath = null;
      if (photo) {
        const uploaded = await api("team_photo_upload", {
          mime: photo.mime,
          data: photo.data,
          width: photo.width,
          height: photo.height,
        });
        photoPath = uploaded.path;
      }

      await api("team_send", {
        body,
        photo_path: photoPath,
      });

      input.value = "";
      autoGrow(input);
      clearPendingPhoto();
      renderPhotoPreview();
      await load(false);
    } catch (error) {
      alert(error.message || "Envoi impossible.");
    } finally {
      button.disabled = false;
    }
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
    stop();
    clearPendingPhoto();
    state.data = null;
    state.root = null;
  });

  window.STIPTeamChat = {
    mount,
    refresh: () => load(false),
    stop,
  };
})();