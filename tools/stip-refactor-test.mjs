import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const root=new URL('..',import.meta.url).pathname;
const read=file=>readFileSync(join(root,file),'utf8');
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message)};

const home=read('home-shell.js');
const responsable=read('responsable-home.js');
const loader=read('stip-loader.js');

check(/today\s*=\s*dateObj\(parisIso\(\)\)/.test(home),'Le bloc mois doit rester ancré sur la date réelle.');
check(home.indexOf('class="hc-month-open"')<home.indexOf('class="hc-days hc-days-seven'),'Le mois complet doit précéder la ligne des jours.');
check(!loader.includes('signature-success-ui.js'),'Le chargeur référence encore le script absent signature-success-ui.js.');
check(!responsable.includes('dashboardMode'),'Le chargement Responsable dépend encore du paramètre dashboard.');
check(responsable.includes('await load()'),'Le cockpit Responsable ne déclenche pas son chargement principal.');
check(existsSync(join(root,'esprit-equipe.html')),'La page unifiée Esprit d’équipe est absente.');
check(home.includes('Esprit d’équipe'),'L’accueil ne référence pas Esprit d’équipe.');
check(!home.includes('hc-calendar-edge'),'Une bulle calendrier flottante reste active.');
check(home.includes('Synchroniser mon calendrier'),'L’entrée calendrier centrale n’a pas son libellé validé.');
const planningHome=read('planning-home.js');
check(!planningHome.includes('Envoyer PDF'),'L’action obsolète Envoyer PDF est encore affichée.');
check(planningHome.includes('Aperçu A4 paysage'),'L’aperçu PDF A4 paysage n’est pas explicite.');
check(read('planning-print-reference.js').includes('@page{size:A4 landscape'),'L’aperçu imprimable a perdu le format A4 paysage.');

for(const htmlName of readdirSync(root).filter(name=>name.endsWith('.html'))){
  const html=read(htmlName);
  for(const match of html.matchAll(/<script[^>]+src=["']([^"'?]+)[^"']*["']/g)){
    const src=match[1];
    if(/^(?:https?:)?\/\//.test(src))continue;
    check(existsSync(join(root,dirname(htmlName),src)),`${htmlName} référence un script absent : ${src}`);
  }
}

for(const file of ['home-shell.js','responsable-home.js','access-runtime.js','admin-access-requests-home.js']){
  const source=read(file);
  check(source.includes('X-STIP-Session')||source.includes('x-stip-session'),`${basename(file)} a perdu la session STIP.`);
}

if(failures.length){
  console.error(failures.map(x=>`FAIL — ${x}`).join('\n'));
  process.exit(1);
}
console.log('OK — invariants de refonte STIP vérifiés.');
