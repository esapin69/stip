(() => {
  'use strict';

  const PDF_API = 'https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-planning-pdf';
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
    button.textContent = 'Préparation du PDF…';

    // Ouvert pendant le clic utilisateur pour éviter le blocage des pop-ups sur iPhone/iPad.
    const pdfWindow = window.open('', '_blank');
    if (pdfWindow) {
      try {
        pdfWindow.document.title = 'Planning PDF';
        pdfWindow.document.body.innerHTML = '<p style="font-family:system-ui;padding:24px">Préparation du planning PDF…</p>';
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
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error || !result.url) {
        throw new Error(result.error || `PDF indisponible (${response.status})`);
      }

      if (pdfWindow) pdfWindow.location.replace(result.url);
      else window.location.href = result.url;
    } catch (error) {
      if (pdfWindow) pdfWindow.close();
      alert(error instanceof Error ? error.message : 'Impossible de créer le PDF.');
    } finally {
      running = false;
      button.disabled = false;
      button.textContent = oldText || 'Imprimer / PDF';
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#printNow');
    if (!button) return;

    // Intercepte l’ancien window.print() sans modifier app.js.
    event.preventDefault();
    event.stopImmediatePropagation();
    openPlanningPdf(button);
  }, true);
})();
