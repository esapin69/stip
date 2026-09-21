
alter table public.stip_agent_agenda_items
  add column if not exists event_kind text,
  add column if not exists icon text;

comment on column public.stip_agent_agenda_items.event_kind is
  'Neutral event category used for display, e.g. rendezvous, formation, reunion, information, autre.';
comment on column public.stip_agent_agenda_items.icon is
  'Optional display icon chosen by the creator. UI supplies a default when omitted.';
