-- Planning changes: snapshot one or more official chef/cadre mail recipients.
-- Only professional addresses returned by contacts_ghe are persisted by stip-change.

alter table public.stip_change_requests
  add column if not exists routed_recipients jsonb not null default '[]'::jsonb;

create index if not exists stip_change_requests_routed_recipients_gin
  on public.stip_change_requests using gin (routed_recipients);
