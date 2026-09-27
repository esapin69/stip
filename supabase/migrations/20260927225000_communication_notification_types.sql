insert into public.stip_notification_types(
  event_key,
  label,
  description,
  push_enabled,
  default_user_enabled,
  active,
  sort_order
)
values
  ('team_chat_received','Chat équipe','Notification native pour un nouveau message du chat équipe STIP.',true,true,true,20),
  ('wheelchair_received','Fauteuils','Notification native pour un nouveau signalement fauteuil STIP.',true,true,true,30)
on conflict (event_key) do update set
  label=excluded.label,
  description=excluded.description,
  push_enabled=excluded.push_enabled,
  default_user_enabled=excluded.default_user_enabled,
  active=true,
  sort_order=excluded.sort_order,
  updated_at=now();
