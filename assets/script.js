function partagerPage(texte = "Accès à cette ressource STIP") {
  const data = {
    title: document.title,
    text: texte,
    url: window.location.href
  };

  if (navigator.share) {
    navigator.share(data).catch(() => {});
  } else {
    navigator.clipboard.writeText(window.location.href)
      .then(() => alert("Lien copié."))
      .catch(() => prompt("Copiez ce lien :", window.location.href));
  }
}
