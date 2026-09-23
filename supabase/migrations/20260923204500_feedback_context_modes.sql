alter table public.stip_event_feedback
  add column if not exists reason_code text;

alter table public.stip_event_feedback
  drop constraint if exists stip_event_feedback_rating_by_presence;

alter table public.stip_event_feedback
  add constraint stip_event_feedback_rating_by_presence check (
    (attendance = 'absent' and rating is null)
    or
    (
      attendance in ('problem','ok')
      and (rating is null or rating between 1 and 5)
    )
  );

alter table public.stip_event_feedback
  drop constraint if exists stip_event_feedback_reason_code_len;

alter table public.stip_event_feedback
  add constraint stip_event_feedback_reason_code_len check (
    reason_code is null or char_length(reason_code) <= 48
  );

comment on column public.stip_event_feedback.reason_code is
  'Motif court contextualisant le retour. La liste admissible dépend de la famille d événement et est validée côté Edge Function.';
