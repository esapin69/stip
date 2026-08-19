(() => {
  'use strict';

  const PDF_API = 'https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-pdf';
  const STORAGE_KEY = 'stip_session_v1';
  let running = false;

  function selectedMonth() {
    return document.querySelector('#planningWorkspace .pill-btn.active[data-month]')?.dataset.month || '';
  }

  async function openPlanningPdf(button) {
    if (running) return;
    const month = selectedMonth();
    if (!month) {
      alert('Choisis d’abord le mois à imprimer.');
      return;
    }

    const session = localStorage.getItem(STORAGE_KEY) || '';
    if (!session) {
      alert('Session STIP expirée. Reconnecte-toi.');
      return;
    }

    running = true;
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Création du PDF…';

    const pdfWindow = window.open('', '_blank');
    if (pdfWindow) {
      try {
        pdfWindow.document.title = 'Planning PDF';
        pdfWindow.document.body.innerHTML = '<p style="font-family:system-ui;padding:24px">Création du planning PDF à partir du planning STIP actuel…</p>';
      } catch (_) {}
    }

    try {
      const response = await fetch(PDF_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-STIP-Session': session
        },
        body: JSON.stringify({ month })
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `PDF indisponible (${response.status})`);
      }

      const blob = await response.blob();
      if (!blob.type.includes('pdf')) throw new Error('Le moteur n’a pas retourné un PDF valide.');
      const url = URL.createObjectURL(blob);

      if (pdfWindow) pdfWindow.location.replace(url);
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (error) {
      if (pdfWindow) pdfWindow.close();
      alert(error instanceof Error ? error.message : 'Impossible de créer le PDF.');
    } finally {
      running = false;
      button.disabled = false;
      button.textContent = oldText || 'Créer le PDF';
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#printNow');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPlanningPdf(button);
  }, true);
})();
