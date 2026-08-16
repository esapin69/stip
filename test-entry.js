(() => {
  'use strict';

  const grid = document.getElementById('moduleGrid');
  const empty = document.getElementById('emptyPermissions');
  if (!grid) return;

  function addTestCard() {
    if (grid.querySelector('[data-stip-test]')) return;

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
  }

  new MutationObserver(addTestCard).observe(grid, { childList: true });
  addTestCard();
})();
