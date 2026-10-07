(() => {
  let installPrompt = null;
  const button = document.getElementById("installWebApp");
  const help = document.getElementById("installHelp");
  if (!button || !help) return;

  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !window.MSStream;

  const isAndroid = () => /android/i.test(navigator.userAgent);

  const showHelp = (html) => {
    help.innerHTML = html;
    help.hidden = false;
  };

  const markInstalled = () => {
    button.textContent = "GHE est déjà installée";
    button.disabled = true;
    showHelp("<strong>Déjà installée</strong>Vous pouvez ouvrir GHE depuis l’icône présente sur votre écran d’accueil.");
  };

  if ("serviceWorker" in navigator) {
    addEventListener("load", () => {
      navigator.serviceWorker.register("/stip-sw.js", { updateViaCache: "none" }).catch(() => {});
    }, { once: true });
  }

  if (isStandalone()) {
    markInstalled();
    return;
  }

  addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    button.textContent = "Installer GHE";
    button.disabled = false;
  });

  addEventListener("appinstalled", () => {
    installPrompt = null;
    markInstalled();
  });

  button.addEventListener("click", async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice.catch(() => null);
      if (result?.outcome === "accepted") markInstalled();
      installPrompt = null;
      return;
    }

    if (isIOS()) {
      showHelp("<strong>Sur iPhone / Safari</strong>Appuyez sur le bouton Partager, puis sur <em>Sur l’écran d’accueil</em>, et confirmez avec <em>Ajouter</em>.");
      return;
    }

    if (isAndroid()) {
      showHelp("<strong>Sur Android</strong>Ouvrez le menu du navigateur (⋮), puis choisissez <em>Installer l’application</em> ou <em>Ajouter à l’écran d’accueil</em>.");
      return;
    }

    showHelp("<strong>Installation</strong>Utilisez le menu de votre navigateur puis choisissez l’option permettant d’installer l’application ou de l’ajouter à l’écran d’accueil.");
  });
})();
