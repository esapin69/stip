-- STIP agenda vigilance.
-- Canonical inputs: planning + formations + stip_agent_agenda_items + stagiaires + shift definitions.
-- One engine fans out to Cloche STIP, native phone push and Responsable > Suivi.

create table if not exists public.stip_agenda_alert_tokens (
  token_hash text primary key,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.stip_agenda_alert_tokens enable row level security;
revoke all on table public.stip_agenda_alert_tokens from anon, authenticated;

create table if not exists public.stip_agenda_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  recipient_agent_id uuid not null references public.agents(id) on delete cascade,
  subject_agent_id uuid references public.agents(id) on delete cascade,
  source_type text not null check (source_type in ('formation','agenda','intern','planning','event_pair')),
  source_ref uuid not null,
  event_at timestamptz not null,
  stage text not null check (stage in ('watch','advance','urgent')),
  notification_id uuid references public.stip_notifications(id) on delete set null,
  push_sent boolean not null default false,
  status text not null default 'pending' check (status in ('pending','sent','cloche_only','acknowledged','dismissed','resolved')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (alert_key, recipient_agent_id, stage)
);

create index if not exists stip_agenda_alert_deliveries_event_idx on public.stip_agenda_alert_deliveries(event_at desc);
create index if not exists stip_agenda_alert_deliveries_recipient_idx on public.stip_agenda_alert_deliveries(recipient_agent_id, created_at desc);
create index if not exists stip_agenda_alert_deliveries_alert_idx on public.stip_agenda_alert_deliveries(alert_key);

alter table public.stip_agenda_alert_deliveries enable row level security;
revoke all on table public.stip_agenda_alert_deliveries from anon, authenticated;

insert into public.stip_notification_types(event_key,label,description,push_enabled,default_user_enabled,active,sort_order,updated_at)
values ('agenda_alert','Alertes agenda & incohérences','Rappels et alertes prioritaires issus du croisement planning, formations, visites, stagiaires et événements STIP.',true,true,true,40,now())
on conflict (event_key) do update set
  label=excluded.label,
  description=excluded.description,
  push_enabled=true,
  default_user_enabled=true,
  active=true,
  sort_order=40,
  updated_at=now();

do $setup$
declare cron_token text;
begin
  select decrypted_secret into cron_token from vault.decrypted_secrets where name = 'stip_agenda_alert_cron_token' limit 1;
  if cron_token is null or length(cron_token) < 40 then
    cron_token := encode(gen_random_bytes(32), 'hex');
    perform vault.create_secret(cron_token,'stip_agenda_alert_cron_token','Jeton privé du moteur de vigilance agenda STIP');
  end if;
  update public.stip_agenda_alert_tokens set active = false where active = true;
  insert into public.stip_agenda_alert_tokens(token_hash, active)
  values (encode(digest(cron_token, 'sha256'), 'hex'), true)
  on conflict (token_hash) do update set active = true, expires_at = null;
end
$setup$;

do $cron_setup$
begin
  if exists (select 1 from cron.job where jobname = 'stip-agenda-alerts-five-minutes') then
    perform cron.unschedule('stip-agenda-alerts-five-minutes');
  end if;
  perform cron.schedule(
    'stip-agenda-alerts-five-minutes',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := 'https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agenda-alerts',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-stip-alert-token', (
            select decrypted_secret from vault.decrypted_secrets
             where name = 'stip_agenda_alert_cron_token' limit 1
          )
        ),
        body := '{"action":"scan"}'::jsonb,
        timeout_milliseconds := 60000
      );
    $job$
  );
end
$cron_setup$;
