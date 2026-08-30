from pathlib import Path
p=Path('places.html')
s=p.read_text()

css='''\n    .guide-placeholder{padding:11px 12px;border:1px dashed #c3d6db;border-radius:11px;background:#f8fbfc;color:#71868d;font-size:.76rem;line-height:1.4;font-weight:700}.guide-placeholder.internal{border-color:#ef9a9a;background:#fff5f5;color:#a92b2b}.service-guide-empty-note{margin:8px 0 0;color:#71868d;font-size:.7rem;line-height:1.35;font-weight:700}\n'''
if '.guide-placeholder{' not in s:
    s=s.replace('</style>',css+'</style>',1)

start=s.index('function guideBlock(title,body){')
end=s.index('\nfunction completionRowHtml',start)
new=r'''function guidePlaceholder(text='Information en cours de préparation.'){return `<div class="guide-placeholder">${esc(text)}</div>`}
function guideBlock(title,body,always=false){if(!body&&!always)return'';return `<section class="guide-block"><h2>${esc(title)}</h2>${body||guidePlaceholder()}</section>`}
function publicContactValues(p,prefixes){return tagValuesFor(p,prefixes)}
function publicContactItemHtml(label,value,kind='text'){const v=String(value||'').trim();if(!v)return'';let href='';if(kind==='phone')href=`tel:${v.replace(/[^+0-9]/g,'')}`;else if(kind==='email')href=`mailto:${v}`;else if(kind==='url')href=/^https?:\/\//i.test(v)?v:`https://${v}`;return `<div class="public-contact-item"><span>${esc(label)}</span>${href?`<a href="${esc(href)}"${kind==='url'?' target="_blank" rel="noopener"':''}>${esc(v)}</a>`:`<strong>${esc(v)}</strong>`}</div>`}
function looksLikeLocationOnly(text){const n=norm(text);if(!n)return true;const locationWords=['etage','rdc','rdj','niveau','ascenseur','entree','couloir','aile','batiment','hospitalisation','hdj','unite'];const meaningful=n.split(' ').filter(Boolean);if(meaningful.length<=5&&locationWords.some(w=>n.includes(w)))return true;return /^(rdc|rdj|tm|\d+(er|e)? etage|\d+e?)$/.test(n)}
function servicePurposeValues(p){const tagged=tagValuesFor(p,['purpose:','about:','service_about:','public_info:']);if(tagged.length)return tagged;const out=[];if(p.official_name&&norm(p.official_name)!==norm(p.display_name)&&!looksLikeLocationOnly(p.official_name))out.push(p.official_name);if(p.details&&!looksLikeLocationOnly(p.details))out.push(p.details);return [...new Set(out)]}
function serviceGuideData(p){return{routeMarkup:routesHtml(p),nearMarkup:relationsHtml(p),arrival:tagValuesFor(p,['arrival:','arrivee:','repere_arrivee:']),inside:tagValuesFor(p,['inside:','dans_service:']),landmarks:tagValuesFor(p,['landmark:','repere:']),access:tagValuesFor(p,['accessibility:','accessibilite:']),purpose:servicePurposeValues(p),rdv:publicContactValues(p,['rdv:','appointment:','booking:']),publicPhone:publicContactValues(p,['public_phone:','phone_public:','tel_public:']),publicEmail:publicContactValues(p,['public_email:','email_public:']),publicUrl:publicContactValues(p,['public_url:','website:','site_web:'])}}
function publicServiceIntroHtml(p,g){const introBody=g.purpose.length?valuesHtml(g.purpose):guidePlaceholder('Présentation du service à compléter.');const contacts=[];g.rdv.forEach(v=>contacts.push(publicContactItemHtml('Prendre rendez-vous',v,'text')));g.publicPhone.forEach(v=>contacts.push(publicContactItemHtml('Téléphone',v,'phone')));g.publicEmail.forEach(v=>contacts.push(publicContactItemHtml('E-mail',v,'email')));g.publicUrl.forEach(v=>contacts.push(publicContactItemHtml('Site / rendez-vous en ligne',v,'url')));const contactBody=contacts.length?`<div class="public-contact-grid">${contacts.join('')}</div>`:guidePlaceholder('Coordonnées publiques et rendez-vous à compléter.');return `<section class="service-intro"><h2>À quoi sert ce service ?</h2>${introBody}</section><section class="service-intro"><h2>Venir ici / prendre rendez-vous</h2>${contactBody}${contacts.length?'<p class="service-audience-note">Coordonnées destinées au public. Les contacts professionnels internes sont séparés plus bas après connexion STIP.</p>':''}</section>`}
function serviceGuideHtml(p){const g=serviceGuideData(p),inside=g.inside.length?valuesHtml(g.inside):'',landmarks=g.landmarks.length?valuesHtml(g.landmarks):'',access=g.access.length?valuesHtml(g.access):'',arrival=g.arrival.length?valuesHtml(g.arrival):'';return `${publicServiceIntroHtml(p,g)}<section class="service-guide"><h2 class="service-guide-title">Se repérer dans ce lieu</h2><div class="guide-stack">${guideBlock('Comment y aller',g.routeMarkup,true)}${guideBlock('À proximité',g.nearMarkup,true)}${guideBlock('Reconnaître l’arrivée',arrival,true)}${guideBlock('Dans le service',inside,true)}${guideBlock('Repères et équipements utiles',landmarks,true)}${guideBlock('Accessibilité',access,true)}</div></section>`}
'''
s=s[:start]+new+s[end:]

# Make progress status match the new purpose logic.
s=s.replace("const purposeDone=g.purpose.length>0||!!p.details||!!p.summary,publicContactDone=", "const purposeDone=g.purpose.length>0,publicContactDone=",1)

s='\n'.join(line.rstrip() for line in s.splitlines())+'\n'
p.write_text(s)
