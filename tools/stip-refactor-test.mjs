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

const spiritHtml=read('esprit-equipe.html');
const spirit=read('esprit-equipe.js');
check(spiritHtml.indexOf('data-team-tab="team"')<spiritHtml.indexOf('data-team-tab="activity"'),'Esprit d’équipe ne présente plus Équipe en premier.');
check(spirit.includes('action: "spirit_week"'),'Esprit d’équipe ne réutilise plus le moteur de planning équipe.');
check(spirit.includes('Array.from({ length: 7 }'),'Esprit d’équipe ne construit plus les sept journées.');
check(spirit.includes('loadCore(addDays(state.weekStart, -7))')&&spirit.includes('loadCore(addDays(state.weekStart, 7))'),'Le préchargement des semaines adjacentes a disparu.');

const selector=read('stip-agent-selector.js');
check(['M','J','J4','S','N'].every(code=>new RegExp(`\\b${code}: \\{ label:`).test(selector)),'Le sélecteur commun a perdu un horaire de référence.');
check(selector.includes('sas-absence-divider')&&selector.includes('sas-absent'),'Le sélecteur commun ne sépare plus les absents.');
check(read('responsable-agents.js').includes('STIPAgentSelector.mount'),'Responsable ne réutilise plus le sélecteur commun.');

check(read('assistant.js').includes('class="as-day"'),'Assistant ne regroupe plus les sujets par journée.');
check(/id="dayCard"[\s\S]*id="insightSection"/.test(read('cadre-activite.html')),'Activité sépare de nouveau l’analyse du conteneur de journée.');
check(read('responsable-intelligence.js').includes('class="op-day"'),'Le cockpit Responsable ne regroupe plus les signaux par journée.');

const theme=read('stip-theme-base.css');
check(theme.includes('--stip-bg:#f6f7f8'),'Le fond maître neutre n’est plus appliqué.');
check(theme.includes('--stip-accent:#176b93'),'L’accent bleu HCL n’est plus appliqué.');
check(!read('assistant.css').trimStart().startsWith(':root'),'Assistant recrée une palette locale.');
check(!read('responsable-home.css').trimStart().startsWith(':root'),'Responsable recrée une palette locale.');

const navigation=read('stip-navigation.js');
check(navigation.includes('stip_navigation_context_v2'),'Le contrat de navigation contextualisée est absent.');
check(['scrollY','fields','panel','register','remember'].every(key=>navigation.includes(key)),'Le contrat de navigation ne couvre plus tous les contextes validés.');
check(spirit.includes('weekStart: state.weekStart'),'Esprit d’équipe ne mémorise plus la semaine courante.');

check(read('responsable-intelligence.js').includes('h.dataset.ready'),'Le cockpit perd son contenu pendant les actualisations.');
check(read('responsable.html').includes('cockpit-placeholder'),'Le cockpit ne réserve plus ses zones de chargement.');
check(read('assistant.html').includes('as-feed-skeleton'),'Assistant ne réserve plus son flux initial.');

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
