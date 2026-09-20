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
const homeModeBody=home.slice(home.indexOf('function homeModeBody()'),home.indexOf('function render()',home.indexOf('function homeModeBody()')));
check(homeModeBody.indexOf('${planningMonthTitle()}')<homeModeBody.indexOf('${weekWidget()}'),'Le mois complet doit précéder la ligne des jours.');
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

check(/class="[^"]*as-day\b/.test(read('assistant.js')),'Assistant ne regroupe plus les sujets par journée.');
check(/id="dayCard"[\s\S]*id="insightSection"/.test(read('cadre-activite.html')),'Activité sépare de nouveau l’analyse du conteneur de journée.');
check(/class="[^"]*op-day\b/.test(read('responsable-intelligence.js')),'Le cockpit Responsable ne regroupe plus les signaux par journée.');

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


/* Décisions finales 20/09/2026 */
const quick=read('quick-access.js');
const quickUniversal=read('quick-access-universal.js');
const accessManage=read('access-manage.js');
const patterns=read('stip-patterns.css');
const loadingCss=read('stip-loading.css');
const loadingJs=read('stip-loading.js');

check(home.includes('class="hc-profile-bell"')&&home.includes('🔔')&&home.includes('data-home-mode="notifications"'),'La cloche de communication n’est plus intégrée au profil.');
check(home.includes('["apps", "Applications", ICON.homeApps]')&&home.includes('["planning", "Mon profil", ICON.homeHome]')&&home.includes('app("tomorrow", "Actions", "tomorrow", "tomorrow")'),'La navigation principale Applications / Mon profil et l’accès Actions ne sont plus conformes.');
check(!home.includes('quick-card.svg')&&!home.includes('home-planning.webp'),'Les anciens visuels Profil/Planning sont revenus dans l’accueil.');
check(home.includes('hcProfileActions')&&home.includes('Se déconnecter complètement')&&home.includes('hcCommunicationHub'),'La Cloche ne conserve plus le centre À traiter, le profil secondaire ou le hub de communication.');
check(!home.includes('id="cpBell"'),'La cloche est revenue dans l’en-tête de l’accueil.');
check(!quick.includes('data-qs="public"')&&!quickUniversal.includes('data-u="public"'),'Le raccourci bas gauche supprimé est revenu.');
check(!quick.includes('data-qs="profile"')&&!quickUniversal.includes('data-u="profile"'),'La maison basse supprimée est revenue.');
check(!existsSync(join(root,'images/icone_app/quick-card.svg'))&&!existsSync(join(root,'images/icone_app/quick-home.svg'))&&!existsSync(join(root,'images/icone_app/home-planning.webp')),'Un ancien visuel de navigation supprimé existe encore.');
check(existsSync(join(root,'images/icone_app/home-home.webp'))&&existsSync(join(root,'images/icone_app/home-apps.webp')),'Les visuels Mon profil/Applications validés sont absents.');
check(!quick.includes('Suggestions selon votre usage')&&!quickUniversal.includes('Suggestions selon votre usage'),'Les suggestions automatiques de favoris sont revenues.');
check(quick.includes('Parcourir les applications')&&quick.includes('+ Ajouter')&&quick.includes('Construisez votre STIP'),'Les états du panneau Applications ne suivent plus les libellés validés.');
check(accessManage.includes('>MINI</button>')&&accessManage.includes('>MAXI</button>'),'La gestion des accès n’affiche plus MINI / MAXI.');
check(accessManage.includes('sortPeople'),'La liste Accès n’est plus triée alphabétiquement côté interface.');
check(['stip-time-surface','stip-person-surface','stip-action-surface','stip-catalog-surface','stip-cockpit-surface'].every(key=>patterns.includes(key)),'Une famille visuelle commune STIP a disparu.');
check(read('stip-theme.css').includes('stip-patterns.css'),'Le thème maître ne charge plus les familles visuelles communes.');
check(loadingJs.includes('const VISIBLE=new Set()'),'Le HUD global de chargement peut redevenir visible.');
check(loadingCss.includes('#stipLoadHud{display:none!important}'),'Le HUD global de chargement n’est plus neutralisé.');

const tomorrowCss=read('tomorrow-hub.css');
check(!tomorrowCss.includes('var(--stip-surface)8f8'),'Pour demain contient une valeur CSS invalide.');
check(tomorrowCss.includes('var(--stip-bg)')&&tomorrowCss.includes('var(--stip-surface)'),'Pour demain ne consomme plus le thème maître STIP.');

const accessManageSource=read('access-manage.js');
const accessManageEdge=read('supabase/functions/stip-access-manage/index.ts');
check(accessManageSource.includes('ESPRIT_KEYS')&&accessManageSource.includes('product_bundle: "esprit"'),'Accès ne regroupe plus Planning équipe / Activité / Assistant derrière Esprit d’équipe.');
check(accessManageSource.includes('levels: false')&&accessManageSource.includes('MAXI n’est pas proposé'),'Esprit d’équipe affiche de nouveau un faux niveau MAXI.');
check(accessManageEdge.includes('requestedPermissions')&&accessManageEdge.includes('b.permissions'),'La création d’accès ignore de nouveau les applications choisies.');

check(read('assistant.js').includes('as-day stip-time-surface'),'Assistant ne réutilise plus la famille visuelle Temps.');
check(read('esprit-equipe.js').includes('team-day stip-time-surface'),'Esprit d’équipe ne réutilise plus la famille visuelle Temps.');
check(read('responsable-intelligence.js').includes('op-day stip-time-surface'),'Responsable Intelligence ne réutilise plus la famille visuelle Temps.');
check(read('cadre-activite.html').includes('activity-day stip-time-surface'),'Activité ne réutilise plus la famille visuelle Temps.');

const tomorrowAppHome=read('home-shell.js');
const tomorrowAppQuick=read('quick-access.js');
const tomorrowAppUniversal=read('quick-access-universal.js');
const tomorrowAppAccess=read('access-runtime.js');
const tomorrowAppUi=read('tomorrow-ui.js');
const tomorrowMigration=read('supabase/migrations/20260920020500_add_tomorrow_app_access.sql');
check(existsSync(join(root,'images/icone_app/pour-demain.svg')),'L’icône Pour demain a disparu.');
check(tomorrowAppHome.includes('app("tomorrow", "Actions"')&&tomorrowAppHome.includes('STIPTomorrowUI?.open'),'Actions / Pour demain n’est plus intégré à la grille Applications.');
check(tomorrowAppQuick.includes('label: "Actions"')&&tomorrowAppQuick.includes('tomorrow: "tomorrow"'),'Actions / Pour demain n’est plus disponible dans les favoris principaux.');
check(tomorrowAppUniversal.includes('index.html?quick=tomorrow')&&tomorrowAppUniversal.includes('tomorrow: "tomorrow"'),'Pour demain n’est plus disponible dans les favoris universels.');
check(tomorrowAppAccess.includes('tomorrow: () => explicit("tomorrow")')&&tomorrowAppAccess.includes('["tomorrow", "Actions", "tomorrow"]'),'Le droit Actions / Pour demain n’est plus relié au runtime Accès.');
check(tomorrowAppUi.includes('app("tomorrow")')&&tomorrowAppUi.includes('p.tomorrow'),'Pour demain n’est plus protégé par son droit dédié.');
check(tomorrowMigration.includes("'tomorrow'")&&tomorrowMigration.includes("level_mode")&&tomorrowMigration.includes("planning_personal"),'La migration canonique Pour demain est incomplète.');

check(!read('index.html').includes('assistant-presence.js'),'assistant-presence.js ne doit plus être chargé sur l’accueil.');

check(!existsSync(join(root,'assistant-presence.js')),'assistant-presence.js doit être supprimé du dépôt.');
check(!existsSync(join(root,'quick-access-icons.css')),'quick-access-icons.css doit être supprimé du dépôt.');
check(!existsSync(join(root,'carousel-fold.js')),'carousel-fold.js doit être supprimé du dépôt.');
check(!read('cadre.html').includes('assistant-presence.js'),'Cadre charge encore l’ancien bandeau Assistant.');
check(!read('responsable.html').includes('assistant-presence.js'),'Responsable charge encore l’ancien bandeau Assistant.');
check(!read('index.html').includes('quick-access-icons.css'),'index.html charge encore la feuille legacy quick-access-icons.css.');

check(home.includes('const markup = `${profile()}${homeModeNav()}<section class="hc-home-mode-content"'),'La carte identité n’est plus placée au-dessus des trois accès rapides.');
const notificationsBlock=home.slice(home.indexOf('function notificationsPane()'),home.indexOf('function homeModeBody()'));
check(!notificationsBlock.includes('${profile()}'),'La carte identité est dupliquée dans la page Notifications.');

const espritHtml=read('esprit-equipe.html');
const espritJs=read('esprit-equipe.js');
check(['stip-time-stack','stip-time-month','stip-time-week','stip-time-days'].every(key=>patterns.includes(key)),'La navigation temporelle canonique 2/3 niveaux a disparu du thème partagé.');
check(espritHtml.includes('teamMonthLabel')&&espritHtml.includes('stip-time-days'),'Esprit d’équipe n’est plus la référence du filtre temporel à trois niveaux.');
check(espritJs.includes('function monthContext')&&espritJs.includes('dayFocus'),'Esprit d’équipe ne conserve plus le contexte mois/semaine/jour.');
check(!espritJs.includes('scrollIntoView({ behavior: "smooth", block: "start" })'),'Le filtre Jour d’Esprit d’équipe ne doit plus faire défiler la page vers une journée plus bas.');
check(read('THEME_FIRST.md').includes('Navigation temporelle canonique'),'Le contrat THEME_FIRST ne documente plus le filtre temporel de référence.');

const espritInteractiveHtml=read('esprit-equipe.html');
const espritInteractiveJs=read('esprit-equipe.js');
const espritInteractiveCss=read('esprit-equipe.css');
check(espritInteractiveHtml.includes('id="teamCurrent"'),'Esprit d’équipe a perdu le raccourci Aujourd’hui.');
check(espritInteractiveJs.includes('data-team-shift')&&espritInteractiveJs.includes('aria-expanded'),'Les shifts Esprit d’équipe ne sont plus interactifs.');
check(espritInteractiveJs.includes('data-team-agent')&&espritInteractiveJs.includes('openAgentSheet'),'Les agents Esprit d’équipe ne sont plus ouvrables.');
check(espritInteractiveCss.includes('.team-shift-head')&&espritInteractiveCss.includes('.team-agent-overlay'),'Le relief interactif Esprit d’équipe a disparu.');

check(espritHtml.indexOf('id="teamDays"') < espritHtml.indexOf('class="team-tabs"'),'Les filtres Équipe / Activité / Assistant doivent rester sous le sélecteur de jour.');
check(espritJs.includes('const day = state.dayFocus') && !espritJs.includes('.map((day) => renderer(bundle, day))'),'Esprit d’équipe doit afficher uniquement la journée sélectionnée.');

if(failures.length){
  console.error(failures.map(x=>`FAIL — ${x}`).join('\n'));
  process.exit(1);
}
console.log('OK — invariants de refonte STIP vérifiés.');
