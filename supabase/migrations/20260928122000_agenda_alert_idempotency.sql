-- Make agenda alert delivery idempotent under overlapping cron/manual scans.

alter table public.stip_agenda_alert_deliveries
  add column if not exists claimed_at timestamptz;

alter table public.stip_agenda_alert_deliveries
  drop constraint if exists stip_agenda_alert_deliveries_status_check;

alter table public.stip_agenda_alert_deliveries
  add constraint stip_agenda_alert_deliveries_status_check
  check (status in ('pending','processing','sent','cloche_only','acknowledged','dismissed','resolved'));

create or replace function public.stip_agenda_alert_claim(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare claimed integer;
begin
  update public.stip_agenda_alert_deliveries
     set status = 'processing', claimed_at = now()
   where id = p_id
     and processed_at is null
     and (
       status = 'pending'
       or (status = 'processing' and claimed_at < now() - interval '10 minutes')
     );
  get diagnostics claimed = row_count;
  return claimed = 1;
end;
$$;

revoke all on function public.stip_agenda_alert_claim(uuid) from public, anon, authenticated;
grant execute on function public.stip_agenda_alert_claim(uuid) to service_role;

with ranked as (
  select
    n.id,
    row_number() over (
      partition by n.agent_id, n.metadata->>'alert_key'
      order by
        case when exists (
          select 1 from public.stip_agenda_alert_deliveries d
          where d.notification_id = n.id
        ) then 0 else 1 end,
        n.created_at,
        n.id
    ) as rn
  from public.stip_notifications n
  where n.type = 'agenda_alert'
    and nullif(n.metadata->>'alert_key','') is not null
)
delete from public.stip_notifications n
using ranked r
where n.id = r.id
  and r.rn > 1;

create unique index if not exists stip_notifications_agenda_alert_unique
on public.stip_notifications(agent_id, (metadata->>'alert_key'))
where type = 'agenda_alert' and nullif(metadata->>'alert_key','') is not null;
