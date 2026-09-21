alter table public.agents
  add column if not exists quotite smallint;

alter table public.agents
  drop constraint if exists agents_quotite_range;

alter table public.agents
  add constraint agents_quotite_range
  check (quotite is null or quotite between 1 and 100);

comment on column public.agents.quotite is
  'Quotité contractuelle importée du planning source, en pourcentage. Ne décrit aucun motif médical.';
