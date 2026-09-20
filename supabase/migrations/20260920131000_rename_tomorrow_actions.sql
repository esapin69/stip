update public.stip_app_catalog
set label = 'Actions',
    help = 'Préparer et organiser les jours à venir à partir du planning, des événements et des notes personnelles.',
    active = true,
    updated_at = now()
where app_key = 'tomorrow';

comment on table public.stip_app_catalog is
  'Catalogue canonique des applications STIP. L''app_key tomorrow est présentée aux utilisateurs sous le nom Actions.';
