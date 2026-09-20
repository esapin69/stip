alter table public.stip_tomorrow_notes
  add column if not exists client_id text;

create unique index if not exists stip_tomorrow_notes_owner_client_uidx
  on public.stip_tomorrow_notes(owner_agent_id, client_id);

comment on column public.stip_tomorrow_notes.client_id is
  'Identifiant local stable utilisé pour migrer sans doublon les anciennes notes navigateur vers Supabase.';
