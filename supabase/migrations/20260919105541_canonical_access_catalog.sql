create table if not exists public.stip_app_catalog (
  app_key text primary key,
  label text not null,
  help text not null default '',
  route_key text,
  level_mode text not null default 'single'
    check (level_mode in ('single','visitor_pro','pro_only')),
  sort_order integer not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.stip_app_catalog enable row level security;
revoke all on table public.stip_app_catalog from anon, authenticated;

insert into public.stip_app_catalog(app_key,label,help,route_key,level_mode,sort_order)
values
  ('profile_photo','Modifier sa photo','Autorise le changement de photo depuis la fiche.',null,'single',10),
  ('planning_personal','Planning perso','Planning individuel et aperçu mensuel.','planning/personal','single',20),
  ('planning_team','Planning équipe','Planning collectif.','planning/team','single',30),
  ('change_app','Changement','Échanges et demandes de modification.','planning/change','single',40),
  ('calendar_subscribe','Synchroniser mon calendrier','Synchronise les horaires et événements STIP avec le calendrier du téléphone.','planning/calendar','single',50),
  ('agent_dates','Date des agents','Dates, visites médicales, formations et stagiaires.','agent-dates.html','single',60),
  ('contacts','Contacts','Annuaire et numéros utiles.','contacts/directory','single',70),
  ('responsable','Responsable','Cockpit et outils de pilotage.','responsable.html','visitor_pro',80),
  ('notes','Prendre des notes','Notes confidentielles, disponibles uniquement en niveau Pro.',null,'pro_only',90),
  ('nouveaux_arrivants','Nouvel agent','Parcours nouvel arrivant.',null,'single',100),
  ('file_upload','Importer','Importer les fichiers autorisés.',null,'single',110),
  ('activity','Esprit d’équipe','Vue globale avec Équipe, Activité et Assistant.','esprit-equipe.html','visitor_pro',120),
  ('admin','Admin','Administration STIP, séparée de la gestion des accès.',null,'single',130),
  ('places','Visiter les lieux','Guide des lieux et services avec une profondeur Visiteur ou Pro.','places-app.html','visitor_pro',140),
  ('assistant_enabled','Assistant STIP','Recommandations intégrées à Esprit d’équipe.','esprit-equipe.html?view=assistant','single',150),
  ('access_manage','Accès','Gérer les codes, applications et niveaux.', 'access-manage.html','single',160)
on conflict (app_key) do update set
  label=excluded.label,
  help=excluded.help,
  route_key=excluded.route_key,
  level_mode=excluded.level_mode,
  sort_order=excluded.sort_order,
  active=true,
  updated_at=now();

insert into public.stip_access_role_presets(role_key,label,permissions,updated_at)
values
  ('visiteur','Visiteur',jsonb_build_object(
    'places',true,
    '__levels',jsonb_build_object('places','visitor')
  ),now()),
  ('brancardier','Brancardier',jsonb_build_object(
    'planning_personal',true,'planning_team',true,'change_app',true,
    'calendar_subscribe',true,'contacts',true,'nouveaux_arrivants',true,
    'activity',true,'places',true,'assistant_enabled',true,'profile_photo',true,
    '__levels',jsonb_build_object('activity','visitor','places','visitor')
  ),now()),
  ('chef_equipe','Chef d’équipe',jsonb_build_object(
    'planning_personal',true,'planning_team',true,'change_app',true,
    'calendar_subscribe',true,'contacts',true,'responsable',true,'notes',true,
    'nouveaux_arrivants',true,'activity',true,'places',true,
    'assistant_enabled',true,'profile_photo',true,
    '__levels',jsonb_build_object('responsable','pro','notes','pro','activity','pro','places','pro')
  ),now()),
  ('responsable','Responsable',jsonb_build_object(
    'planning_personal',true,'planning_team',true,'change_app',true,
    'calendar_subscribe',true,'contacts',true,'responsable',true,
    'nouveaux_arrivants',true,'file_upload',true,'activity',true,
    'places',true,'assistant_enabled',true,'profile_photo',true,
    '__levels',jsonb_build_object('responsable','visitor','activity','pro','places','pro')
  ),now()),
  ('cadre','Cadre',jsonb_build_object(
    'contacts',true,'responsable',true,'nouveaux_arrivants',true,
    'file_upload',true,'activity',true,'places',true,'assistant_enabled',true,
    '__levels',jsonb_build_object('responsable','visitor','activity','pro','places','pro')
  ),now()),
  ('admin','Admin',jsonb_build_object(
    'planning_personal',true,'planning_team',true,'change_app',true,
    'calendar_subscribe',true,'agent_dates',true,'contacts',true,
    'responsable',true,'notes',true,'nouveaux_arrivants',true,
    'file_upload',true,'activity',true,'admin',true,'places',true,
    'assistant_enabled',true,'access_manage',true,'profile_photo',true,
    '__levels',jsonb_build_object('responsable','pro','notes','pro','activity','pro','places','pro')
  ),now())
on conflict (role_key) do update set
  label=excluded.label,
  permissions=excluded.permissions,
  updated_at=now();

comment on table public.stip_app_catalog is
  'Catalogue canonique des applications STIP et de leurs niveaux réellement supportés.';
