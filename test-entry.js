(() => {
  'use strict';

  const grid = document.getElementById('moduleGrid');
  const empty = document.getElementById('emptyPermissions');
  if (!grid) return;

  const ACCESS_API = 'https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access';
  const STORAGE = 'stip_session_v1';
  let checking = false;

  async function canSeeTest() {
    const token = localStorage.getItem(STORAGE) || '';
    if (!token) return false;
    try {
      const r = await fetch(ACCESS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-STIP-Session': token
        },
        body: JSON.stringify({ action: 'me' })
      });
      const j = await r.json().catch(() => ({}));
      return !!(r.ok && !j.error && j.permissions?.test);
    } catch {
      return false;
    }
  }

  async function syncTestCard() {
    if (checking) return;
    checking = true;
    try {
      const existing = grid.querySelector('[data-stip-test]');
      const allowed = await canSeeTest();
      if (!allowed) {
        existing?.remove();
        return;
      }
      if (existing) return;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'module-card';
      card.dataset.stipTest = '1';
      card.setAttribute('aria-label', 'Ouvrir le prototype fictif Test');
      card.innerHTML = '<span class="num">07 · LAB</span><strong>Test</strong><small>Explorer une nouvelle façon d’utiliser STIP.</small>';
      card.addEventListener('click', () => {
        window.location.href = 'test.html';
      });

      grid.appendChild(card);
      empty?.classList.add('hidden');
    } finally {
      checking = false;
    }
  }

  new MutationObserver(syncTestCard).observe(grid, { childList: true });
  syncTestCard();
})();
