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
check(
  homeModeBody.indexOf('planningWeekSeparator()') >= 0 &&
  homeModeBody.indexOf('${weekWidget()}') > homeModeBody.indexOf('planningWeekSeparator()') &&
  homeModeBody.indexOf('AU MOIS') > homeModeBody.indexOf('${weekWidget()}') &&
  homeModeBody.indexOf('${planningCalendarOverview()}') > homeModeBody.indexOf('AU MOIS'),
  'L’accueil doit conserver l’ordre validé : semaine puis vue mensuelle.'
);
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
check(
  !spiritHtml.includes('data-team-tab=') &&
  spirit.includes('function mergedDayRows') &&
  spirit.includes('function teamDaySummary'),
  'Esprit d’équipe doit rester une vue unique qui fusionne Équipe, Activité et Assistant.'
);
check(spirit.includes('action: "spirit_week"'),'Esprit d’équipe ne réutilise plus le moteur de planning équipe.');
check(spirit.includes('Array.from({ length: 7 }'),'Esprit d’équipe ne construit plus les sept journées.');
check(spirit.includes('loadCore(addDays(state.weekStart, -7))')&&spirit.includes('loadCore(addDays(state.weekStart, 7))'),'Le préchargement des semaines adjacentes a disparu.');

const selector=read('stip-agent-selector.js');
const shiftRegistry=read('shift-registry.js');
check(
  selector.includes('STIPShiftRegistry?.resolve') &&
  selector.includes('STIPShiftRegistry?.time') &&
  ['J4','M','J','S','N'].every(code=>shiftRegistry.includes(`return "${code}"`)),
  'Le sélecteur commun ne consomme plus le registre central des shifts.'
);
check(selector.includes('sas-absence-divider')&&selector.includes('sas-absent'),'Le sélecteur commun ne sépare plus les absents.');
check(
  read('stip-agent-selector.css').includes('aspect-ratio:4/5') &&
  read('stip-agent-selector.css').includes('object-fit:cover') &&
  read('stip-agent-selector.css').includes('object-position:50% var(--sas-photo-y,42%)'),
  'Le mur commun a perdu le portrait ovale 4:5 ou la protection anti-déformation des images.'
);
check(read('responsable-agents.js').includes('STIPAgentSelector.mount'),'Responsable ne réutilise plus le sélecteur commun.');
check(
  selector.includes('data-sas-filter="first"') &&
  selector.includes('data-sas-filter="last"') &&
  selector.includes('data-sas-filter="ghe"') &&
  selector.includes('sas-wall-grid') &&
  selector.includes('mountWall') &&
  selector.includes('openPicker'),
  'Le modèle commun Rechercher un agent a perdu son mur de portraits ou ses filtres.'
);
const responsableHtml=read('responsable.html');
const responsableAgenda=read('responsable-agenda.js');
check(
  responsableHtml.includes('id="taAgent" type="hidden"') &&
  responsableHtml.includes('id="taAgentPicker"') &&
  !responsableHtml.includes('<select id="taAgent"') &&
  responsableAgenda.includes('STIPAgentSelector.openPicker'),
  'Ajouter un événement utilise de nouveau le sélecteur natif au lieu du modèle Rechercher un agent.'
);
check(
  selector.includes('function refreshBody()') &&
  selector.includes('state.query = event.target.value;') &&
  !selector.includes('state.query = event.target.value;\n        render();'),
  'Le sélecteur commun recrée encore le champ de recherche à chaque caractère.'
);
check(
  responsableAgenda.includes('call("manager_agents")') &&
  responsableAgenda.includes('async function ensureAgents()') &&
  !responsableAgenda.includes('directoryCall()'),
  'Ajouter un événement ne repose plus sur la source manager_agents ou peut encore ouvrir un mur vide.'
);
check(
  read('responsable-tabs.js').includes('responsable-agenda.js?v=20260924-agent-picker-stable3'),
  'Le chemin Agenda peut encore charger une ancienne version du moteur de sélection.'
);
check(
  read('responsable-agenda-home.js').includes('STIPResponsableTabs?.openAgendaAdd') &&
  responsableAgenda.includes('window.STIPResponsableAgenda = {') &&
  responsableAgenda.includes('openAdd(date = "")'),
  'Le bouton Ajouter peut encore forcer une navigation complète au lieu d’ouvrir Agenda en place.'
);
check(
  read('supabase/functions/stip-actions/index.ts').includes('telephone,avatar_url,profile_photo_url'),
  'manager_agents ne fournit plus les photos nécessaires au mur des agents.'
);

check(/class="[^"]*as-day\b/.test(read('assistant.js')),'Assistant ne regroupe plus les sujets par journée.');
check(/id="dayCard"[\s\S]*id="insightSection"/.test(read('cadre-activite.html')),'Activité sépare de nouveau l’analyse du conteneur de journée.');
check(/class="[^"]*op-day\b/.test(read('responsable-intelligence.js')),'Le cockpit Responsable ne regroupe plus les signaux par journée.');

const theme=read('stip-theme-base.css');
check(theme.includes('--stip-bg:#f6f7f8'),'Le fond maître neutre n’est plus appliqué.');
check(theme.includes('--stip-accent:#176b93'),'L’accent bleu HCL n’est plus appliqué.');
check(!read('assistant.css').trimStart().startsWith(':root'),'Assistant recrée une palette locale.');
check(!read('responsable-home.css').trimStart().startsWith(':root'),'Responsable recrée une palette locale.');

const navigation=read('stip-navigation.js');
const appRuntime=read('app.js');
check(
  appRuntime.includes("if(route()===target){restore();return}") &&
  appRuntime.includes("if(r==='fauteuils'){showOnly('homeView');emitRoute(r);restoreScroll(r);return}"),
  'Le routeur principal peut de nouveau ignorer une ré-entrée ou perdre la route Fauteuils.'
);
check(
  home.includes('if ((window.STIPRouter?.get?.() || "home") === "fauteuils")') &&
  home.includes('window.STIPRouter?.set?.("home", { replace: true, keepScroll: true })'),
  'Quitter Fauteuils ne resynchronise plus la route avec le mode d’accueil.'
);
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


/* Décisions validées 20–22/09/2026 */
const quick=read('quick-access.js');
const quickUniversal=read('quick-access-universal.js');
const accessManage=read('access-manage.js');
const patterns=read('stip-patterns.css');
const loadingCss=read('stip-loading.css');
const loadingJs=read('stip-loading.js');

check(home.includes('hc-profile-bell')&&home.includes('🔔')&&home.includes('data-home-mode="notifications"'),'La cloche de communication n’est plus intégrée à la barre d’accueil.');
check(
  home.includes('{ key: "apps", label: "Applications", art: ICON.homeApps, mode: "home" }') &&
  home.includes('{ key: "planning", label: "Mon profil", art: ICON.homeHome, mode: "home" }') &&
  home.includes('{ key: "team", label: "Esprit d’équipe", art: ICON.team, mode: "home" }') &&
  home.includes('app("tomorrow", "Actions", "tomorrow", "tomorrow")'),
  'La navigation principale Applications / Mon profil / Esprit d’équipe et l’accès Actions ne sont plus conformes.'
);
check(!home.includes('quick-card.svg')&&!home.includes('home-planning.webp'),'Les anciens visuels Profil/Planning sont revenus dans l’accueil.');
check(
  home.includes('function notificationsPane()') &&
  home.includes('id="hcProfileActions"') &&
  home.includes('id="hcCommunicationHub"'),
  'La Cloche ne conserve plus le centre À traiter ou le hub de communication.'
);
check(!home.includes('id="cpBell"'),'La cloche est revenue dans l’en-tête de l’accueil.');
check(!quick.includes('data-qs="public"')&&!quickUniversal.includes('data-u="public"'),'Le raccourci bas gauche supprimé est revenu.');
check(!quick.includes('data-qs="profile"')&&!quickUniversal.includes('data-u="profile"'),'La maison basse supprimée est revenue.');
check(!existsSync(join(root,'images/icone_app/quick-card.svg'))&&!existsSync(join(root,'images/icone_app/quick-home.svg'))&&!existsSync(join(root,'images/icone_app/home-planning.webp')),'Un ancien visuel de navigation supprimé existe encore.');
check(existsSync(join(root,'images/icone_app/home-home.webp'))&&existsSync(join(root,'images/icone_app/home-apps.webp')),'Les visuels Mon profil/Applications validés sont absents.');
check(!quick.includes('Suggestions selon votre usage')&&!quickUniversal.includes('Suggestions selon votre usage'),'Les suggestions automatiques de favoris sont revenues.');
check(
  quick.includes('Parcourir les applications') &&
  quick.includes('Construisez votre STIP') &&
  quick.includes('aria-label="Ajouter une application"') &&
  quick.includes('stip-store-browse-plus') &&
  quick.includes('<strong>Ajouter</strong>'),
  'Les états du panneau Applications ne suivent plus les libellés validés.'
);
check(accessManage.includes('>MINI</button>')&&accessManage.includes('>MAXI</button>'),'La gestion des accès n’affiche plus MINI / MAXI.');
check(
  accessManage.includes('STIPAgentSelector.mountWall') &&
  read('access-manage.html').includes('stip-agent-selector.js?v=20260924-shared-wall1'),
  'ADMIN > Accès ne réutilise plus le mur canonique des agents.'
);
check(
  !accessManage.includes('function sortPeople(') &&
  !accessManage.includes('function groupedPeopleHtml(') &&
  !read('access-manage.css').includes('.access-person-grid'),
  'ADMIN > Accès a recréé une copie locale du mur des agents.'
);
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

check(
  /\bshowProfile\s*=\s*state\.homeMode\s*===\s*"planning"/.test(home) &&
  /showProfile\s*\?\s*profile\(\)(?:\s*\+\s*[A-Za-z0-9_$]+\([^)]*\))*\s*:\s*""/.test(home),
  'La carte identité doit rester sous les accès rapides et uniquement dans Mon profil.'
);
const notificationsBlock=home.slice(home.indexOf('function notificationsPane()'),home.indexOf('function homeModeBody()'));
check(!notificationsBlock.includes('${profile()}'),'La carte identité est dupliquée dans la page Notifications.');
const homeCss=read('home-shell.css');
check(home.includes('function planningCalendarOverview')&&home.includes('hc-date-jump-permanent'),'Le calendrier mensuel permanent a disparu du planning.');
check(!home.includes('data-date-jump-toggle')&&!home.includes('data-cal-close'),'Le calendrier mensuel ne doit plus fonctionner comme un pop-up refermable.');
check(
  home.includes('work: Boolean(workIcon)') &&
  home.includes('shift.work') &&
  home.includes('hc-date-jump-dot stip-month-dot shift-${esc(shift.type)}'),
  'Le calendrier doit réserver la pastille colorée aux shifts réellement travaillés.'
);
check(
  home.includes('hc-date-jump-day-number') &&
  home.includes('hc-date-jump-marker') &&
  !home.includes('function calendarShiftPill'),
  'Le calendrier doit garder le numéro du jour lisible et le repère de shift séparé.'
);
const homePlanningBlock=home.slice(home.indexOf('function homeModeBody()'),home.indexOf('function render()'));
check(!homePlanningBlock.includes('planningMonthTitle()')&&!homePlanningBlock.includes('homeDayStrip('),'L’ancien bloc semaine/jours doit avoir disparu de la page d’accueil.');
check(
  homePlanningBlock.indexOf('weekWidget()') >= 0 &&
  homePlanningBlock.indexOf('planningCalendarOverview()') > homePlanningBlock.indexOf('weekWidget()') &&
  homePlanningBlock.indexOf('hc-planning-legend-separator') > homePlanningBlock.indexOf('planningCalendarOverview()'),
  'La hiérarchie validée doit rester : semaine, mois, puis légende.'
);
const weekWidgetBlock=home.slice(home.indexOf('function weekWidget()'),home.indexOf('function nativeFuture()',home.indexOf('function weekWidget()')));
check(weekWidgetBlock.includes('weekDaysLandscape(w)'),'Le bloc piloté par le calendrier doit conserver la vue complète de la semaine.');
check(home.includes('weekStart = w[0]?.iso')&&home.includes('return start <= weekEnd && end >= weekStart'),'Les événements doivent suivre la semaine sélectionnée par le calendrier.');
check(
  !home.includes('data-cal-today') &&
  home.includes('firstMondayOfMonth(state.dateJumpMonth)'),
  'Le calendrier mensuel ne doit plus afficher le bouton Aujourd’hui redondant ; les flèches doivent recaler la semaine.'
);
check(
  homeCss.includes('.hc-date-jump-dot.shift-morning') &&
  homeCss.includes('.hc-date-jump-dot.shift-night'),
  'Les couleurs des pastilles de shifts du calendrier ont disparu.'
);
check(
  homeCss.includes('.hc-calendar-driven-planning .hc-planning-week-subblock') &&
  homeCss.includes('.hc-calendar-driven-planning .hc-planning-month-subblock'),
  'Les surfaces Semaine et Mois du planning ne sont plus reliées par la hiérarchie commune.'
);
check(
  home.includes('state.dayFocus = iso') &&
  home.includes('state.weekOffset = Math.round((targetMonday - currentMonday) / 604800000)') &&
  home.includes('data-cal-day='),
  'Choisir un jour du calendrier doit recaler la semaine affichée et mémoriser le jour sélectionné.'
);
check(
  homeCss.includes('.hc-days-landscape .hc-day-landscape.selected') &&
  homeCss.includes('.hc-days-landscape .hc-day-landscape.selected::after'),
  'Le jour actif de la semaine a perdu son regroupement visuel.'
);
check(
  home.includes('stip-month-calendar') &&
  home.includes('hc-date-jump-grid stip-month-grid') &&
  patterns.includes('.stip-month-calendar .stip-month-day{') &&
  patterns.includes('.stip-month-calendar .stip-month-day-number'),
  'Le calendrier mensuel permanent a quitté le gabarit mensuel commun.'
);
check(
  home.includes('hc-week-events-slot') &&
  home.includes('hc-week-event-chip') &&
  homeCss.includes('.hc-calendar-driven-planning .hc-days-landscape .hc-week-events-slot') &&
  homeCss.includes('.hc-calendar-driven-planning .hc-days-landscape .hc-week-event-chip'),
  'Les repères événement intégrés dans les cartes de shift ont disparu.'
);
check(
  home.includes('hc-planning-week-separator stip-section-separator') &&
  home.includes('hc-planning-month-separator stip-section-separator') &&
  homeCss.includes('.hc-calendar-driven-planning .hc-planning-week-subblock') &&
  homeCss.includes('.hc-calendar-driven-planning .hc-planning-month-subblock'),
  'La séparation visuelle Semaine / Mois a régressé.'
);
check(
  home.includes('leading = (first.getDay() + 6) % 7') &&
  home.includes('gridStart = day === 1 ?') &&
  home.includes('grid-column-start:${leading + 1}'),
  'Le calendrier mensuel doit aligner correctement le premier jour sur la semaine.'
);
check(
  home.includes('data-cal-month="${monthKeyOf(d)}"') &&
  home.includes('data-cal-day="${iso}"'),
  'Chaque jour du mois doit conserver ses métadonnées de navigation.'
);
check(home.includes('dateJumpPanel.dataset.calendarMonth ||')&&home.includes('return jumpToDate(day.dataset.calDay)'),'Sélectionner une semaine via un jour du mois voisin ne doit pas faire sauter le calendrier vers ce mois.');
check(
  patterns.includes('.stip-month-calendar .stip-month-day.is-selected') &&
  patterns.includes('.stip-month-calendar .stip-month-day.is-today'),
  'Le calendrier doit distinguer visuellement le jour sélectionné et aujourd’hui.'
);

/* Contrat commun de tous les tableaux calendrier 1 mois. */
const agentMonthSource=read('agent-agenda-view.js');
const agentMonthCss=read('agent-agenda-view.css');
const planningUiSource=read('planning-ui.js');
const responsableMonthSource=read('responsable-agenda-home.js');
const responsableMonthCss=read('responsable-agenda-home.css');
check(
  theme.includes('--stip-month-icon-size:1.32rem') &&
  patterns.includes('.stip-month-calendar .stip-month-day.is-weekend .stip-month-day-number') &&
  patterns.includes('font-size:var(--stip-month-icon-size)!important'),
  'Le contrat calendrier 1 mois doit rester centralisé dans le thème partagé.'
);
check(
  home.includes('stip-month-calendar') &&
  planningHome.includes('stip-month-calendar') &&
  agentMonthSource.includes('stip-month-calendar') &&
  read('esprit-equipe.html').includes('stip-month-calendar') &&
  planningUiSource.includes('stip-month-calendar') &&
  responsableMonthSource.includes('stip-month-calendar'),
  'Un calendrier mensuel a quitté le contrat visuel commun.'
);
check(
  home.includes('weekend ? "is-weekend" : ""') &&
  planningHome.includes('weekend ? "weekend is-weekend" : ""') &&
  agentMonthSource.includes('weekend?"is-weekend":""') &&
  read('esprit-equipe.js').includes('weekend ? "is-weekend" : ""') &&
  planningUiSource.includes("weekend?' is-weekend':''") &&
  responsableMonthSource.includes('weekend ? "is-weekend" : ""'),
  'Les chiffres de samedi et dimanche doivent tous passer par la règle rouge commune.'
);
check(
  !theme.includes('.ph-day-head.weekend{color') &&
  !planningHome.includes('.ph-day-head.weekend{color'),
  'Les libellés SA/DI ne doivent pas hériter du rouge réservé aux chiffres des week-ends.'
);
check(
  !/\.hc-date-jump-(?:icon|events)\{[^}]*font-size/s.test(homeCss) &&
  !/\.aav-cal-shift\{[^}]*font-size/s.test(agentMonthCss) &&
  !/\.aav-cal-day small\{[^}]*font-size/s.test(agentMonthCss) &&
  !/\.team-cal-(?:icon|events|status)[^{]*\{[^}]*font-size/s.test(read('esprit-equipe.css')),
  'Une page redéfinit encore localement la taille des icônes du calendrier mensuel.'
);
check(
  home.includes('stip-month-dot') &&
  agentMonthSource.includes('stip-month-dot') &&
  !patterns.includes('.stip-month-dot{'),
  'Les pastilles de couleur doivent garder leur gabarit local actuel et rester la seule exception de taille.'
);
check(
  theme.includes('--stip-month-number-lift:0px') &&
  theme.includes('--stip-month-grid-column-gap:5px') &&
  theme.includes('--stip-month-grid-row-gap:10px') &&
  theme.includes('--stip-month-cell-min-height:88px') &&
  theme.includes('--stip-month-cell-height:88px') &&
  theme.includes('--stip-month-number-row:22px') &&
  theme.includes('--stip-month-visual-row:22px') &&
  theme.includes('--stip-month-events-row:24px') &&
  theme.includes('--stip-month-internal-gap:6px') &&
  theme.includes('--stip-month-event-gap:6px') &&
  theme.includes('--stip-month-event-offset:0px') &&
  patterns.includes('.stip-month-calendar .stip-month-grid') &&
  patterns.includes('.stip-month-calendar .stip-month-day{') &&
  patterns.includes('gap:var(--stip-month-event-gap)!important'),
  'Les espacements communs du calendrier mensuel ont disparu.'
);
check(
  home.includes('hc-date-jump-grid stip-month-grid') &&
  planningHome.includes('ph-month-grid stip-month-grid') &&
  agentMonthSource.includes('aav-calendar stip-month-grid') &&
  read('esprit-equipe.js').includes('team-date-jump-grid stip-month-grid') &&
  planningUiSource.includes('pui-calendar stip-month-grid') &&
  responsableMonthSource.includes('rr-month-grid stip-month-grid'),
  'Un calendrier mensuel ne consomme plus la grille commune.'
);
check(
  patterns.includes('.stip-month-calendar .stip-month-day.is-selected:not(.is-today)') &&
  patterns.includes('transform:scale(1.15)!important') &&
  patterns.includes('.stip-month-calendar .stip-month-day.is-today') &&
  patterns.includes('.stip-month-calendar .stip-month-primary') &&
  home.includes('hc-date-jump-marker stip-month-primary') &&
  planningHome.includes('ph-shift-slot stip-month-primary') &&
  planningUiSource.includes('stip-month-primary') &&
  agentMonthSource.includes('aav-cal-shift stip-month-primary') &&
  read('esprit-equipe.js').includes('team-cal-marker stip-month-primary') &&
  responsableMonthSource.includes('rr-month-primary stip-month-primary') &&
  agentMonthSource.includes('today is-today') &&
  agentMonthSource.includes('selected is-selected') &&
  responsableMonthSource.includes('today is-today') &&
  responsableMonthSource.includes('selected is-selected'),
  'Le jour mensuel choisi doit reprendre le zoom de sélection sans grossir automatiquement aujourd’hui.'
);
check(
  homeCss.includes('.hc-week-nav-global{\n width:100%!important;') &&
  !homeCss.includes('.hc-date-jump-icon{\n box-sizing:border-box!important;') &&
  !homeCss.includes('.hc-calendar-driven-planning .hc-date-jump-permanent .hc-date-jump-grid{gap:') &&
  !homeCss.includes('height:59px!important;min-height:59px!important') &&
  !homeCss.includes('margin-top:8px!important;gap:8px!important'),
  'La feuille Home est de nouveau corrompue ou recrée un espacement mensuel local.'
);
check(
  !/\.hc-date-jump-grid>button\{[^}]*grid-template-rows/s.test(homeCss) &&
  !/\.aav-cal-day\{[^}]*grid-template-rows/s.test(agentMonthCss) &&
  !/\.team-date-jump-grid>button\{[^}]*grid-template-rows/s.test(read('esprit-equipe.css')) &&
  !/\.rr-month-grid\s*>\s*button\s*\{[^}]*grid-template-rows/s.test(responsableMonthCss) &&
  !/\.ph-day-cell\{[^}]*display:flex/s.test(planningHome),
  'Une page recrée encore localement la géométrie du calendrier mensuel au lieu du template commun.'
);

const espritHtml=read('esprit-equipe.html');
const espritJs=read('esprit-equipe.js');
check(['stip-time-stack','stip-time-month','stip-time-week','stip-time-days'].every(key=>patterns.includes(key)),'La navigation temporelle canonique 2/3 niveaux a disparu du thème partagé.');
check(
  espritHtml.includes('id="teamDutyChiefTodayHost"') &&
  espritJs.includes('function weekControlsMarkup()') &&
  espritJs.includes('id="teamWeekControls"') &&
  espritJs.includes('id="teamDays"') &&
  espritJs.includes('body = weekControlsMarkup() + daySeparator + staffing + teamDaySummary(bundle, day)') &&
  /class="[^"]*\bteam-month-zone\b[^"]*"/.test(espritHtml) &&
  espritHtml.includes('id="teamDateJumpPanel"'),
  'Esprit d’équipe a perdu la hiérarchie validée Aujourd’hui / Cette semaine / shifts / Ce mois.'
);
check(espritJs.includes('function monthContext')&&espritJs.includes('dayFocus'),'Esprit d’équipe ne conserve plus le contexte mois/semaine/jour.');
check(!espritJs.includes('scrollIntoView({ behavior: "smooth", block: "start" })'),'Le filtre Jour d’Esprit d’équipe ne doit plus faire défiler la page vers une journée plus bas.');
check(read('THEME_FIRST.md').includes('Navigation temporelle canonique'),'Le contrat THEME_FIRST ne documente plus le filtre temporel de référence.');
check(
  read('THEME_FIRST.md').includes('Calendrier 1 mois canonique') &&
  read('THEME_FIRST.md').includes('stip-month-calendar') &&
  read('THEME_FIRST.md').includes('stip-month-primary'),
  'Le contrat THEME_FIRST ne documente plus le template obligatoire des calendriers mensuels.'
);

const espritInteractiveHtml=read('esprit-equipe.html');
const espritInteractiveJs=read('esprit-equipe.js');
const espritInteractiveCss=read('esprit-equipe.css');
check(
  !espritInteractiveHtml.includes('id="teamCurrent"') &&
  espritInteractiveJs.includes('day === today ? "today" : ""'),
  'Esprit d’équipe doit signaler Aujourd’hui dans la ligne des jours sans bouton redondant.'
);
check(espritInteractiveJs.includes('data-team-shift')&&espritInteractiveJs.includes('aria-expanded'),'Les shifts Esprit d’équipe ne sont plus interactifs.');
check(espritInteractiveJs.includes('data-team-agent')&&espritInteractiveJs.includes('openAgentSheet'),'Les agents Esprit d’équipe ne sont plus ouvrables.');
check(!espritInteractiveHtml.includes('team-live-wheelchair'),'Le raccourci Fauteuils ne doit plus être forcé dans Esprit d’équipe.');
check(espritInteractiveCss.includes('.team-shift-head')&&espritInteractiveCss.includes('.team-agent-overlay'),'Le relief interactif Esprit d’équipe a disparu.');

check(
  !espritInteractiveHtml.includes('data-team-tab=') &&
  !espritInteractiveHtml.includes('team-tabs stip-levels') &&
  espritInteractiveJs.includes('function mergedDayRows') &&
  espritInteractiveJs.includes('function teamDaySummary'),
  'Les anciens onglets Équipe / Activité / Assistant ne doivent plus réapparaître : leurs informations sont fusionnées dans la vue unique.'
);
check(!espritHtml.includes('<i></i><i></i>')&&espritHtml.includes('Chargement de la journée sélectionnée'),'Le chargement Esprit d’équipe ne doit plus simuler plusieurs journées.');
check(espritJs.includes('const day = state.dayFocus') && !espritJs.includes('.map((day) => renderer(bundle, day))'),'Esprit d’équipe doit afficher uniquement la journée sélectionnée.');
check(
  espritJs.includes('tab: "team"') &&
  !espritJs.includes('function activityDay') &&
  !espritJs.includes('function assistantDay'),
  'Esprit d’équipe doit rester sur sa vue unique sans restaurer les anciens onglets.'
);
check(
  espritJs.includes('capture: () => ({') &&
  espritJs.includes('weekStart: state.weekStart') &&
  espritJs.includes('dayFocus: state.dayFocus'),
  'Esprit d’équipe doit mémoriser la semaine et le jour sélectionnés pendant la navigation.'
);
check(espritInteractiveCss.includes('background:var(--shift);')&&espritInteractiveCss.includes('color:#fff;')&&espritInteractiveCss.includes('color-mix(in srgb,var(--shift) 32%'),'Les shifts Esprit d’équipe ont perdu leur contraste fort.');
check(
  !espritInteractiveHtml.includes('team-tabs stip-levels'),
  'Le segmented control obsolète Équipe / Activité / Assistant est revenu dans Esprit d’équipe.'
);


/* Garde-fous Visiter les lieux — MASTER PDF complet */
const placesExportMasterGuard=read('places-export.html');
const placesEdgeMasterGuard=read('supabase/functions/stip-places/index.ts');
const placesAgentsMasterGuard=read('AGENTS.md');
check(
  placesExportMasterGuard.includes('action:"master_pdf_link"') &&
  !placesExportMasterGuard.includes('action:"export_pdf"') &&
  placesExportMasterGuard.includes('PDF officiel vient du MASTER Drive intact'),
  'Le PDF proposé doit continuer à utiliser le MASTER Drive officiel sans génération Supabase.'
);
check(
  placesExportMasterGuard.includes('.selection-summary[hidden]') &&
  placesExportMasterGuard.includes('pdfFormat.disabled=!pdfAllowed'),
  'Le formulaire Export a reperdu ses états de sélection ou peut afficher un faux état déjà complété.'
);
check(
  placesEdgeMasterGuard.includes("action==='master_pdf_link'") &&
  placesEdgeMasterGuard.includes("session.app_level!=='pro'") &&
  placesEdgeMasterGuard.includes("const MASTER_DRIVE_ID='14V7-N2L37ZHWTWZm3qPCQhXjNRRXdJ5o'"),
  'Le lien du MASTER PDF n’est plus servi par stip-places avec contrôle professionnel.'
);
check(
  placesAgentsMasterGuard.includes('## 15. Visiter les lieux — PDF MASTER, pages fixes et dictionnaires') &&
  placesAgentsMasterGuard.includes('Aucune information opérationnelle utile n’est supprimée'),
  'Le contrat PDF fixe + dictionnaire dynamique n’est plus documenté.'
);

if(failures.length){
  console.error(failures.map(x=>`FAIL — ${x}`).join('\n'));
  process.exit(1);
}
console.log('OK — invariants de refonte STIP vérifiés.');


// Pending-work audit: agent calendar + Responsable shift drill-down
const agentAgenda=read('agent-agenda-view.js');
const calendarSubs=read('calendar-subscriptions.js');
const respStaffing=read('responsable-staffing.js');
check(
  agentAgenda.includes('data-aav-subscribe') &&
  agentAgenda.includes('tools.quickAgent') &&
  calendarSubs.includes('async function quickAgent'),
  'La fiche agent a reperdu l’abonnement individuel à son planning.'
);
check(
  respStaffing.includes('data-rs-shift=') &&
  respStaffing.includes('function openShiftAnalysis') &&
  respStaffing.includes('rs-shift-overlay'),
  'Les indicateurs de shift Responsable doivent rester cliquables avec leur analyse terrain.'
);


/* Contrat canonique Visiter les lieux / Chat fauteuil / exports */
const placesCanonicalHtml=read('places.html');
const placesExportHtml=read('places-export.html');
const wheelchairChatCanonical=read('team-chat.js');
const wheelchairEdgeCanonical=read('supabase/functions/stip-messages/index.ts');
const placesEdgeCanonical=read('supabase/functions/stip-places/index.ts');
const agentsContract=read('AGENTS.md');

check(
  !wheelchairChatCanonical.includes('const WHEELCHAIR_LOCATIONS = {') &&
  wheelchairChatCanonical.includes('api("wheelchair_catalog")') &&
  wheelchairChatCanonical.includes('async function loadWheelchairCatalog()'),
  'Chat fauteuil a recréé un catalogue de lieux local au lieu de consommer le référentiel canonique.'
);
check(
  wheelchairEdgeCanonical.includes('async function wheelchairCatalog()') &&
  wheelchairEdgeCanonical.includes('db.from("stip_places")') &&
  wheelchairEdgeCanonical.includes('if(a==="wheelchair_catalog")'),
  'stip-messages ne sert plus le catalogue fauteuil depuis stip_places.'
);
check(
  placesEdgeCanonical.includes("action==='export_xlsx'") &&
  placesEdgeCanonical.includes("action==='export_pdf'") &&
  placesEdgeCanonical.includes('PDF dynamique désactivé') &&
  placesEdgeCanonical.includes('XLSX.write'),
  'Le tableur doit rester canonique et toute génération PDF dynamique doit rester bloquée tant que le template dictionnaire n’est pas validé.'
);
check(
  placesCanonicalHtml.includes('href="places-export.html"') &&
  placesCanonicalHtml.includes("exportLink.hidden=d?.access_level!=='pro'"),
  'Visiter les lieux ne protège plus l’entrée Export par le niveau professionnel confirmé par le serveur.'
);
check(
  placesExportHtml.includes('action:"master_pdf_link"') &&
  placesExportHtml.includes('action:"export_xlsx"') &&
  !placesExportHtml.includes('action:"export_pdf"') &&
  placesExportHtml.includes('x-stip-session'),
  'La page Export doit utiliser le MASTER Drive pour le PDF et Supabase uniquement pour le tableur.'
);
check(
  agentsContract.includes('## 14. Visiter les lieux — canonical data and export contract') &&
  agentsContract.includes('Do not operate Vercel directly'),
  'Le contrat GitHub/Supabase de Visiter les lieux n’est plus documenté dans AGENTS.md.'
);
