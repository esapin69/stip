function partagerCermep(){
  const partage={
    title:document.title,
    text:"Accès au CERMEP",
    url:window.location.href
  };
  if(navigator.share){
    navigator.share(partage).catch(()=>{});
  }else{
    navigator.clipboard.writeText(window.location.href)
      .then(()=>alert("Lien copié."))
      .catch(()=>prompt("Copiez ce lien :",window.location.href));
  }
}