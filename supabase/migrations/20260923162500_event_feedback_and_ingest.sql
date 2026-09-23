-- Canonical STIP event import guard + universal post-event feedback.
-- New/unknown events stay usable without requiring a pre-declared family.

create table if not exists public.stip_event_feedback (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  event_key text not null,
  event_type text not null default 'event',
  attendance text not null,
  rating smallint,
  follow_up boolean not null default false,
  custom_answer text,
  note text,
  event_snapshot jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stip_event_feedback_event_key_len check (char_length(event_key) between 3 and 180),
  constraint stip_event_feedback_type_len check (char_length(event_type) between 1 and 60),
  constraint stip_event_feedback_attendance check (attendance in ('absent','problem','ok')),
  constraint stip_event_feedback_rating check (rating is null or rating between 1 and 5),
  constraint stip_event_feedback_note_len check (note is null or char_length(note) <= 500),
  constraint stip_event_feedback_custom_answer_len check (custom_answer is null or char_length(custom_answer) <= 240),
  constraint stip_event_feedback_rating_by_presence check (
    (attendance = 'absent' and rating is null)
    or
    (attendance in ('problem','ok') and rating between 1 and 5)
  ),
  unique (agent_id, event_key)
);

alter table public.stip_event_feedback enable row level security;
revoke all on table public.stip_event_feedback from anon, authenticated;

create index if not exists stip_event_feedback_agent_time_idx
  on public.stip_event_feedback (agent_id, submitted_at desc);

comment on table public.stip_event_feedback is
  'Retours courts après événement. Écriture/lecture applicative uniquement via les Edge Functions STIP.';

alter table public.stip_agent_agenda_items
  add column if not exists feedback_enabled boolean not null default true,
  add column if not exists feedback_question text,
  add column if not exists import_key text;

update public.stip_agent_agenda_items
set feedback_enabled = false
where display_mode = 'day_note'
  and feedback_enabled = true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stip_agent_agenda_feedback_question_len'
      and conrelid = 'public.stip_agent_agenda_items'::regclass
  ) then
    alter table public.stip_agent_agenda_items
      add constraint stip_agent_agenda_feedback_question_len
      check (feedback_question is null or char_length(feedback_question) <= 240);
  end if;
end $$;

create unique index if not exists stip_agent_agenda_import_key_uidx
  on public.stip_agent_agenda_items (agent_id, import_key)
  where import_key is not null;

create or replace function public.stip_guard_agenda_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.title := nullif(btrim(coalesce(new.title, '')), '');
  if new.title is null then
    raise exception 'EVENT_TITLE_REQUIRED';
  end if;
  new.title := left(new.title, 180);
  new.body := nullif(left(btrim(coalesce(new.body, '')), 1800), '');
  new.location := nullif(left(btrim(coalesce(new.location, '')), 240), '');
  new.feedback_question := nullif(left(btrim(coalesce(new.feedback_question, '')), 240), '');

  new.display_mode := case
    when new.display_mode = 'day_note' then 'day_note'
    else 'event'
  end;

  new.importance := case
    when new.importance in ('normal','important','urgent') then new.importance
    else 'normal'
  end;

  new.event_kind := case lower(coalesce(new.event_kind, 'autre'))
    when 'rendezvous' then 'rendezvous'
    when 'formation' then 'formation'
    when 'reunion' then 'reunion'
    when 'information' then 'information'
    else 'autre'
  end;

  if new.display_mode = 'day_note' then
    new.all_day := true;
    new.feedback_enabled := false;
  end if;

  if new.import_key is not null then
    new.import_key := nullif(
      left(
        regexp_replace(lower(btrim(new.import_key)), '[^a-z0-9:_-]+', '_', 'g'),
        240
      ),
      ''
    );
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists stip_guard_agenda_event_trg on public.stip_agent_agenda_items;
create trigger stip_guard_agenda_event_trg
before insert or update on public.stip_agent_agenda_items
for each row execute function public.stip_guard_agenda_event();

comment on column public.stip_agent_agenda_items.feedback_question is
  'Question personnalisée facultative et courte. Le formulaire universel fonctionne sans elle.';
comment on column public.stip_agent_agenda_items.import_key is
  'Clé stable d import externe pour éviter les doublons entre comptes ou automatisations.';

create or replace function public.stip_import_event(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent_id uuid;
  v_agent_source_key text;
  v_title text;
  v_date date;
  v_start time;
  v_end time;
  v_all_day boolean;
  v_feedback boolean;
  v_import_key text;
  v_source_type text;
  v_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'EVENT_PAYLOAD_REQUIRED';
  end if;

  if coalesce(p_payload->>'agent_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_agent_id := (p_payload->>'agent_id')::uuid;
  end if;

  v_agent_source_key := nullif(btrim(coalesce(p_payload->>'agent_source_key','')), '');
  if v_agent_id is null and v_agent_source_key is not null then
    select id into v_agent_id
    from public.agents
    where source_key = v_agent_source_key and actif = true
    limit 1;
  end if;

  if v_agent_id is null then
    raise exception 'EVENT_AGENT_REQUIRED';
  end if;

  if not exists (select 1 from public.agents where id = v_agent_id and actif = true) then
    raise exception 'EVENT_AGENT_UNKNOWN';
  end if;

  v_title := nullif(btrim(coalesce(p_payload->>'title','')), '');
  if v_title is null then
    raise exception 'EVENT_TITLE_REQUIRED';
  end if;

  if coalesce(p_payload->>'event_date','') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'EVENT_DATE_INVALID';
  end if;
  v_date := (p_payload->>'event_date')::date;

  if coalesce(p_payload->>'start_time','') ~ '^\d{2}:\d{2}(:\d{2})?$' then
    v_start := (p_payload->>'start_time')::time;
  end if;
  if coalesce(p_payload->>'end_time','') ~ '^\d{2}:\d{2}(:\d{2})?$' then
    v_end := (p_payload->>'end_time')::time;
  end if;

  v_all_day := lower(coalesce(p_payload->>'all_day','true')) not in ('false','0','no','non');
  v_feedback := lower(coalesce(p_payload->>'feedback_enabled','true')) not in ('false','0','no','non');

  v_source_type := nullif(
    left(
      regexp_replace(lower(btrim(coalesce(p_payload->>'source_type','gpt_import'))), '[^a-z0-9:_-]+', '_', 'g'),
      60
    ),
    ''
  );
  if v_source_type is null then v_source_type := 'gpt_import'; end if;

  v_import_key := nullif(
    left(
      regexp_replace(lower(btrim(coalesce(p_payload->>'import_key',''))), '[^a-z0-9:_-]+', '_', 'g'),
      240
    ),
    ''
  );
  if v_import_key is null then
    v_import_key := 'auto:' || md5(
      v_agent_id::text || '|' ||
      v_date::text || '|' ||
      lower(v_title) || '|' ||
      coalesce(v_start::text,'')
    );
  end if;

  insert into public.stip_agent_agenda_items (
    agent_id,
    created_by_agent_id,
    source_type,
    display_mode,
    title,
    body,
    event_date,
    all_day,
    start_time,
    end_time,
    location,
    importance,
    status,
    event_kind,
    icon,
    feedback_enabled,
    feedback_question,
    import_key
  ) values (
    v_agent_id,
    null,
    v_source_type,
    case when lower(coalesce(p_payload->>'display_mode','event')) = 'day_note' then 'day_note' else 'event' end,
    v_title,
    nullif(p_payload->>'body',''),
    v_date,
    v_all_day,
    v_start,
    v_end,
    nullif(p_payload->>'location',''),
    case when lower(coalesce(p_payload->>'importance','normal')) in ('normal','important','urgent')
      then lower(p_payload->>'importance') else 'normal' end,
    'active',
    lower(coalesce(p_payload->>'event_kind','autre')),
    nullif(p_payload->>'icon',''),
    v_feedback,
    nullif(p_payload->>'feedback_question',''),
    v_import_key
  )
  on conflict (agent_id, import_key) where import_key is not null
  do update set
    source_type = excluded.source_type,
    display_mode = excluded.display_mode,
    title = excluded.title,
    body = excluded.body,
    event_date = excluded.event_date,
    all_day = excluded.all_day,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    location = excluded.location,
    importance = excluded.importance,
    status = 'active',
    event_kind = excluded.event_kind,
    icon = excluded.icon,
    feedback_enabled = excluded.feedback_enabled,
    feedback_question = excluded.feedback_question,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.stip_import_event(jsonb) from public, anon, authenticated;
grant execute on function public.stip_import_event(jsonb) to service_role;

comment on function public.stip_import_event(jsonb) is
  'Point d entrée canonique pour les nouveaux événements importés par GPT/automatisation. Whitelist, normalisation, déduplication et retour universel par défaut.';
