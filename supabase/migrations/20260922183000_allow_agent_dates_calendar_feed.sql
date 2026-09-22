alter table public.stip_calendar_feeds
  drop constraint if exists stip_calendar_feeds_kind_check;

alter table public.stip_calendar_feeds
  add constraint stip_calendar_feeds_kind_check
  check (
    kind = any (
      array[
        'personal'::text,
        'team'::text,
        'formations'::text,
        'stagiaires'::text,
        'agent_dates'::text
      ]
    )
    or kind ~ '^agent:[0-9a-fA-F-]{36}$'::text
  );
