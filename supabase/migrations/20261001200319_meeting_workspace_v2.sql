alter table public.stip_meeting_notes
  add column if not exists phase text not null default 'live',
  add column if not exists lanes jsonb not null default '[{"key":"a","label":"Moi"},{"key":"b","label":"Interlocuteur"},{"key":"suite","label":"Suite"}]'::jsonb,
  add column if not exists finalized_at timestamptz,
  add column if not exists final_mail_sent_at timestamptz,
  add column if not exists final_mail_provider_id text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='stip_meeting_notes_phase_check'
      and conrelid='public.stip_meeting_notes'::regclass
  ) then
    alter table public.stip_meeting_notes
      add constraint stip_meeting_notes_phase_check
      check (phase in ('live','finalized'));
  end if;
end $$;

create table if not exists public.stip_meeting_invites (
  meeting_id uuid not null references public.stip_meeting_notes(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  member_role text not null default 'invitee' check (member_role in ('organizer','invitee')),
  invited_by_agent_id uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (meeting_id,agent_id)
);

create index if not exists stip_meeting_invites_agent_status_idx
  on public.stip_meeting_invites(agent_id,status,updated_at desc);

create table if not exists public.stip_meeting_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.stip_meeting_notes(id) on delete cascade,
  created_by_agent_id uuid not null references public.agents(id) on delete cascade,
  topic text not null default 'À classer',
  lane_key text not null default 'a',
  kind text not null default 'info'
    check (kind in ('info','idea','decision','action','question','verify','waiting','test','important')),
  body text not null,
  visibility text not null default 'private'
    check (visibility in ('private','shared')),
  audience_mode text not null default 'all'
    check (audience_mode in ('all','selected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stip_meeting_items_meeting_idx
  on public.stip_meeting_items(meeting_id,created_at);

create table if not exists public.stip_meeting_item_recipients (
  item_id uuid not null references public.stip_meeting_items(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  status text not null default 'open'
    check (status in ('open','done','acknowledged')),
  response_text text not null default '',
  updated_at timestamptz not null default now(),
  primary key (item_id,agent_id)
);

create index if not exists stip_meeting_item_recipients_agent_idx
  on public.stip_meeting_item_recipients(agent_id,status,updated_at desc);

alter table public.stip_meeting_invites enable row level security;
alter table public.stip_meeting_items enable row level security;
alter table public.stip_meeting_item_recipients enable row level security;

revoke all on public.stip_meeting_invites from public,anon,authenticated;
revoke all on public.stip_meeting_items from public,anon,authenticated;
revoke all on public.stip_meeting_item_recipients from public,anon,authenticated;
grant all on public.stip_meeting_invites to service_role;
grant all on public.stip_meeting_items to service_role;
grant all on public.stip_meeting_item_recipients to service_role;

comment on table public.stip_meeting_invites is
  'Participants autorisés des notes de réunion. Une simple mention dans le contenu ne crée jamais une invitation ni un accès.';
comment on table public.stip_meeting_items is
  'Blocs structurés du tableau de réunion. Les blocs privés sont purgés seulement après export mail confirmé lors de la finalisation.';
comment on table public.stip_meeting_item_recipients is
  'Diffusion explicite des suites de réunion vers les seuls participants ayant accepté leur invitation.';
comment on table public.stip_meeting_notes is
  'Réunions GHE structurées. Le brouillon privé est distinct des suites explicitement partagées aux participants acceptés.';
