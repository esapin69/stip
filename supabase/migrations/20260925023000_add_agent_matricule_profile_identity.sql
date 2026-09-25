alter table public.agents
  add column if not exists matricule text;

comment on column public.agents.matricule is
  'Matricule professionnel interne de l''agent. Exposé uniquement dans les vues/actions explicitement autorisées.';

update public.agents
set matricule = '968066',
    updated_at = now()
where source_key = 'sapin_eddy'
  and coalesce(btrim(matricule),'') = '';
