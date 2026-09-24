insert into public.stip_app_catalog
  (app_key, label, help, route_key, level_mode, sort_order, active)
values
  (
    'agent_directory',
    'Équipe',
    'Voir les présents, les absents et joindre rapidement un collègue.',
    'agents',
    'single',
    35,
    true
  )
on conflict (app_key) do update
set label = excluded.label,
    help = excluded.help,
    route_key = excluded.route_key,
    level_mode = excluded.level_mode,
    sort_order = excluded.sort_order,
    active = excluded.active;
