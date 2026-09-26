-- Contrôle STIP : sortie organisationnelle et surveillance locale permanente.
-- Étend le moteur existant admin_cleanup_* ; ne crée pas de système parallèle.

insert into public.admin_cleanup_sources(source_key, source_type, label, locator, mode, config)
values
  (
    'supabase:organization',
    'supabase_db',
    'Supabase · Organisation & quotas',
    'faotatqzupbcwxjqxmcj',
    'connector_assisted',
    jsonb_build_object(
      'scope','organization',
      'plan','pro',
      'edge_function_quota_cycle',2000000,
      'realtime_message_quota_cycle',5000000,
      'storage_quota_bytes',107374182400,
      'database_quota_bytes_per_project',8589934592
    )
  ),
  (
    'system:communication',
    'url',
    'STIP · Communication technique',
    'control.html',
    'automatic',
    jsonb_build_object('scope','system_health')
  )
on conflict (source_key) do update
set label = excluded.label,
    locator = excluded.locator,
    mode = excluded.mode,
    config = public.admin_cleanup_sources.config || excluded.config,
    active = true,
    updated_at = now();

update public.admin_cleanup_settings
set config = config || jsonb_build_object(
  'supabase_plan_reference','pro',
  'supabase_storage_quota_bytes',107374182400,
  'supabase_db_quota_bytes',8589934592,
  'supabase_warn_percent',70,
  'supabase_critical_percent',90,
  'external_review_max_age_hours',24,
  'scan_frequency_hours',6
),
updated_at = now()
where singleton = true;

create or replace function public.admin_cleanup_record_observation(
  p_source_key text,
  p_fingerprint text,
  p_category text,
  p_title text,
  p_question text,
  p_context_text text default '',
  p_facts jsonb default '[]'::jsonb,
  p_metrics jsonb default '{}'::jsonb,
  p_evidence jsonb default '[]'::jsonb,
  p_uncertainties jsonb default '[]'::jsonb,
  p_proposed_action text default '',
  p_proposed_plan jsonb default '[]'::jsonb,
  p_evidence_score integer default 80,
  p_status text default 'open',
  p_source_status text default 'observed'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_status text := lower(coalesce(p_status, 'open'));
  v_score integer := greatest(0, least(100, coalesce(p_evidence_score, 80)));
begin
  if v_status not in ('open','validated','modify_requested','refused','delete_approved','executing','done','execution_failed','superseded') then
    raise exception 'Statut de dossier invalide: %', v_status;
  end if;

  if not exists (
    select 1 from public.admin_cleanup_sources where source_key = p_source_key and active = true
  ) then
    raise exception 'Source de contrôle inconnue: %', p_source_key;
  end if;

  insert into public.admin_cleanup_cases(
    fingerprint,
    evidence_hash,
    source_key,
    category,
    status,
    title,
    question,
    context_text,
    facts,
    metrics,
    evidence,
    uncertainties,
    proposed_action,
    proposed_plan,
    evidence_score,
    first_seen_at,
    last_seen_at,
    last_changed_at
  )
  values(
    p_fingerprint,
    md5(
      coalesce(p_title,'') || '|' ||
      coalesce(p_question,'') || '|' ||
      coalesce(p_facts,'[]'::jsonb)::text || '|' ||
      coalesce(p_metrics,'{}'::jsonb)::text || '|' ||
      coalesce(p_evidence,'[]'::jsonb)::text
    ),
    p_source_key,
    p_category,
    v_status,
    p_title,
    p_question,
    coalesce(p_context_text,''),
    coalesce(p_facts,'[]'::jsonb),
    coalesce(p_metrics,'{}'::jsonb),
    coalesce(p_evidence,'[]'::jsonb),
    coalesce(p_uncertainties,'[]'::jsonb),
    coalesce(p_proposed_action,''),
    coalesce(p_proposed_plan,'[]'::jsonb),
    v_score,
    now(),
    now(),
    now()
  )
  on conflict (fingerprint) do update
  set evidence_hash = excluded.evidence_hash,
      source_key = excluded.source_key,
      category = excluded.category,
      status = excluded.status,
      title = excluded.title,
      question = excluded.question,
      context_text = excluded.context_text,
      facts = excluded.facts,
      metrics = excluded.metrics,
      evidence = excluded.evidence,
      uncertainties = excluded.uncertainties,
      proposed_action = excluded.proposed_action,
      proposed_plan = excluded.proposed_plan,
      evidence_score = excluded.evidence_score,
      last_seen_at = now(),
      last_changed_at = case
        when public.admin_cleanup_cases.evidence_hash is distinct from excluded.evidence_hash
          or public.admin_cleanup_cases.status is distinct from excluded.status
        then now()
        else public.admin_cleanup_cases.last_changed_at
      end
  returning id into v_id;

  update public.admin_cleanup_sources
  set last_scan_at = now(),
      last_status = p_source_status,
      last_error = null,
      updated_at = now()
  where source_key = p_source_key;

  insert into public.admin_cleanup_case_events(case_id, event_type, actor, payload)
  values(
    v_id,
    'observation_recorded',
    'system',
    jsonb_build_object('source_key',p_source_key,'status',v_status,'observed_at',now())
  );

  return v_id;
end;
$$;

revoke all on function public.admin_cleanup_record_observation(
  text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,integer,text,text
) from public, anon, authenticated;
grant execute on function public.admin_cleanup_record_observation(
  text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,text,jsonb,integer,text,text
) to service_role;

create or replace function public.admin_cleanup_system_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  cfg jsonb := '{}'::jsonb;
  storage_bytes bigint := 0;
  storage_objects bigint := 0;
  storage_buckets bigint := 0;
  db_bytes bigint := 0;
  storage_quota bigint := 107374182400;
  db_quota bigint := 8589934592;
  warn_percent numeric := 70;
  critical_percent numeric := 90;
  storage_percent numeric := 0;
  db_percent numeric := 0;
  scan_hours integer := 6;
  external_hours integer := 24;
  last_completed timestamptz;
  stuck_runs bigint := 0;
  open_cases bigint := 0;
  external_stale bigint := 0;
  org_config jsonb := '{}'::jsonb;
  org_observed_at timestamptz;
  org_status text;
  health_status text := 'ok';
  messages jsonb := '[]'::jsonb;
begin
  select coalesce(config,'{}'::jsonb)
    into cfg
  from public.admin_cleanup_settings
  where singleton = true;

  storage_quota := coalesce((cfg->>'supabase_storage_quota_bytes')::bigint, storage_quota);
  db_quota := coalesce((cfg->>'supabase_db_quota_bytes')::bigint, db_quota);
  warn_percent := coalesce((cfg->>'supabase_warn_percent')::numeric, warn_percent);
  critical_percent := coalesce((cfg->>'supabase_critical_percent')::numeric, critical_percent);
  scan_hours := coalesce((cfg->>'scan_frequency_hours')::integer, scan_hours);
  external_hours := coalesce((cfg->>'external_review_max_age_hours')::integer, external_hours);

  select
    coalesce(sum(case when (metadata->>'size') ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0),
    count(*)::bigint,
    count(distinct bucket_id)::bigint
  into storage_bytes, storage_objects, storage_buckets
  from storage.objects;

  db_bytes := pg_database_size(current_database());

  if storage_quota > 0 then
    storage_percent := round((storage_bytes::numeric * 100) / storage_quota, 2);
  end if;
  if db_quota > 0 then
    db_percent := round((db_bytes::numeric * 100) / db_quota, 2);
  end if;

  select max(completed_at)
    into last_completed
  from public.admin_cleanup_scan_runs
  where status in ('completed','completed_with_warnings');

  select count(*)::bigint
    into stuck_runs
  from public.admin_cleanup_scan_runs
  where status = 'running'
    and started_at < now() - interval '30 minutes';

  select count(*)::bigint
    into open_cases
  from public.admin_cleanup_cases
  where status = 'open';

  select count(*)::bigint
    into external_stale
  from public.admin_cleanup_sources
  where active = true
    and mode = 'connector_assisted'
    and (
      last_scan_at is null
      or last_scan_at < now() - make_interval(hours => external_hours)
    );

  select coalesce(config,'{}'::jsonb), last_scan_at, last_status
    into org_config, org_observed_at, org_status
  from public.admin_cleanup_sources
  where source_key = 'supabase:organization';

  if stuck_runs > 0 or storage_percent >= critical_percent or db_percent >= critical_percent then
    health_status := 'critical';
  elsif storage_percent >= warn_percent
     or db_percent >= warn_percent
     or last_completed is null
     or last_completed < now() - make_interval(hours => scan_hours * 2)
     or external_stale > 0
  then
    health_status := 'warning';
  end if;

  if stuck_runs > 0 then
    messages := messages || jsonb_build_array(
      format('%s contrôle(s) sont bloqués depuis plus de 30 minutes.', stuck_runs)
    );
  end if;
  if storage_percent >= warn_percent then
    messages := messages || jsonb_build_array(
      format('Storage Supabase à %s%% de la référence de quota.', storage_percent)
    );
  end if;
  if db_percent >= warn_percent then
    messages := messages || jsonb_build_array(
      format('Base Supabase à %s%% de la référence de quota.', db_percent)
    );
  end if;
  if last_completed is null or last_completed < now() - make_interval(hours => scan_hours * 2) then
    messages := messages || jsonb_build_array(
      'Le contrôle automatique local n’a pas produit de résultat assez récent.'
    );
  end if;
  if external_stale > 0 then
    messages := messages || jsonb_build_array(
      format('%s source(s) externe(s) doivent être revues avec les connecteurs.', external_stale)
    );
  end if;

  return jsonb_build_object(
    'status', health_status,
    'generated_at', now(),
    'plan_reference', coalesce(cfg->>'supabase_plan_reference','inconnu'),
    'storage_bytes', storage_bytes,
    'storage_objects', storage_objects,
    'storage_buckets', storage_buckets,
    'storage_quota_bytes', storage_quota,
    'storage_percent', storage_percent,
    'db_bytes', db_bytes,
    'db_quota_bytes', db_quota,
    'db_percent', db_percent,
    'scan_frequency_hours', scan_hours,
    'last_completed_scan', last_completed,
    'stuck_scan_runs', stuck_runs,
    'open_cases', open_cases,
    'external_sources_stale', external_stale,
    'organization_observation', jsonb_build_object(
      'config', coalesce(org_config,'{}'::jsonb),
      'observed_at', org_observed_at,
      'status', org_status
    ),
    'messages', messages
  );
end;
$$;

revoke all on function public.admin_cleanup_system_summary() from public, anon, authenticated;
grant execute on function public.admin_cleanup_system_summary() to service_role;

create or replace function public.admin_cleanup_local_health_scan(
  p_trigger text default 'cron',
  p_actor text default 'system'
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  run_id uuid;
  repaired_stuck integer := 0;
  before_summary jsonb;
  after_summary jsonb;
  storage_percent numeric := 0;
  db_percent numeric := 0;
  warn_percent numeric := 70;
  external_stale integer := 0;
begin
  before_summary := public.admin_cleanup_system_summary();

  update public.admin_cleanup_scan_runs
  set status = 'failed',
      error_text = coalesce(error_text,'Contrôle interrompu : aucune exécution n’a clôturé cette demande dans les 30 minutes.'),
      completed_at = now(),
      summary = coalesce(summary,'{}'::jsonb) || jsonb_build_object('auto_closed_at',now())
  where status = 'running'
    and started_at < now() - interval '30 minutes';
  get diagnostics repaired_stuck = row_count;

  insert into public.admin_cleanup_scan_runs(trigger_kind,status,scope,summary,started_at)
  values(
    coalesce(nullif(p_trigger,''),'cron'),
    'running',
    array['supabase_db','supabase_storage','system'],
    jsonb_build_object('actor',coalesce(nullif(p_actor,''),'system'),'local_health',true),
    now()
  )
  returning id into run_id;

  update public.admin_cleanup_sources
  set last_scan_at = now(),
      last_status = 'completed',
      last_error = null,
      updated_at = now()
  where source_key in ('supabase:db','supabase:storage','system:communication');

  after_summary := public.admin_cleanup_system_summary();
  storage_percent := coalesce((after_summary->>'storage_percent')::numeric,0);
  db_percent := coalesce((after_summary->>'db_percent')::numeric,0);
  external_stale := coalesce((after_summary->>'external_sources_stale')::integer,0);

  select coalesce((config->>'supabase_warn_percent')::numeric,70)
    into warn_percent
  from public.admin_cleanup_settings
  where singleton = true;

  if storage_percent >= warn_percent then
    perform public.admin_cleanup_record_observation(
      'supabase:storage',
      'system:supabase-storage-capacity',
      'capacity_warning',
      'Le Storage Supabase approche de sa limite de référence',
      'Faut-il réduire ou déplacer les fichiers avant d’atteindre le quota ?',
      'Alerte automatique du moteur de contrôle.',
      jsonb_build_array('Le volume total des objets Storage a dépassé le seuil de vigilance configuré.'),
      jsonb_build_object(
        'bytes',(after_summary->>'storage_bytes')::bigint,
        'percent',storage_percent,
        'quota_bytes',(after_summary->>'storage_quota_bytes')::bigint
      ),
      jsonb_build_array('Mesure calculée directement depuis storage.objects.'),
      '[]'::jsonb,
      'Identifier les plus gros buckets et les copies reconstruisibles avant toute suppression.',
      jsonb_build_array('Lister les buckets','Tracer les références','Optimiser ou déplacer','Supprimer uniquement après preuve'),
      96,
      'open',
      'warning'
    );
  else
    update public.admin_cleanup_cases
    set status = 'done',
        result = result || jsonb_build_object('auto_resolved_at',now(),'reason','usage_below_warning_threshold'),
        last_changed_at = now()
    where fingerprint = 'system:supabase-storage-capacity'
      and status = 'open';
  end if;

  if db_percent >= warn_percent then
    perform public.admin_cleanup_record_observation(
      'supabase:db',
      'system:supabase-db-capacity',
      'capacity_warning',
      'La base Supabase approche de sa limite de référence',
      'Faut-il nettoyer ou archiver certaines données avant d’atteindre le quota ?',
      'Alerte automatique du moteur de contrôle.',
      jsonb_build_array('La taille de la base a dépassé le seuil de vigilance configuré.'),
      jsonb_build_object(
        'bytes',(after_summary->>'db_bytes')::bigint,
        'percent',db_percent,
        'quota_bytes',(after_summary->>'db_quota_bytes')::bigint
      ),
      jsonb_build_array('Mesure calculée par pg_database_size sur la base active.'),
      '[]'::jsonb,
      'Identifier les tables les plus lourdes et la rétention réellement nécessaire.',
      jsonb_build_array('Mesurer les tables','Vérifier la rétention','Archiver si utile','Ne rien supprimer sans preuve'),
      96,
      'open',
      'warning'
    );
  else
    update public.admin_cleanup_cases
    set status = 'done',
        result = result || jsonb_build_object('auto_resolved_at',now(),'reason','usage_below_warning_threshold'),
        last_changed_at = now()
    where fingerprint = 'system:supabase-db-capacity'
      and status = 'open';
  end if;

  if repaired_stuck > 0 then
    perform public.admin_cleanup_record_observation(
      'system:communication',
      'system:cleanup-pipeline-recovered',
      'system_communication',
      'Le moteur de contrôle avait une demande bloquée',
      'Le défaut de communication du contrôle doit-il être considéré comme résolu ?',
      'Le nouveau contrôle local clôt automatiquement les demandes abandonnées et continue la surveillance.',
      jsonb_build_array(
        format('%s demande(s) de contrôle bloquée(s) ont été clôturées automatiquement.', repaired_stuck),
        'Le moteur local est désormais exécuté périodiquement par pg_cron.'
      ),
      jsonb_build_object('repaired_stuck_runs',repaired_stuck),
      jsonb_build_array('admin_cleanup_scan_runs','pg_cron'),
      '[]'::jsonb,
      'Conserver la surveillance automatique et remonter toute nouvelle interruption dans cette même page.',
      jsonb_build_array('Surveiller la cadence','Alerter si un run reste ouvert plus de 30 min'),
      100,
      'done',
      'recovered'
    );
  end if;

  if external_stale > 0 then
    perform public.admin_cleanup_record_observation(
      'system:communication',
      'system:external-review-stale',
      'system_communication',
      'La revue des plateformes externes doit être actualisée',
      'GPT doit-il contrôler Supabase organisation, Vercel, GitHub et Drive avec les connecteurs disponibles ?',
      'Le moteur local surveille la base et le Storage automatiquement. Les quotas de compte et états externes nécessitent une lecture via connecteurs.',
      jsonb_build_array(
        format('%s source(s) externe(s) n’ont pas été observées dans la fenêtre configurée.', external_stale)
      ),
      jsonb_build_object('stale_sources',external_stale),
      jsonb_build_array('admin_cleanup_sources.mode = connector_assisted'),
      jsonb_build_array('Les métriques de compte ne sont pas toutes exposées à PostgreSQL.'),
      'Confier ce dossier à GPT pour actualiser les métriques externes et enregistrer le résultat dans le moteur de contrôle.',
      jsonb_build_array('Lire les connecteurs','Comparer aux quotas','Enregistrer les observations','Alerter seulement si action utile'),
      100,
      'open',
      'review_required'
    );
  else
    update public.admin_cleanup_cases
    set status = 'done',
        result = result || jsonb_build_object('auto_resolved_at',now(),'reason','external_sources_fresh'),
        last_changed_at = now()
    where fingerprint = 'system:external-review-stale'
      and status = 'open';
  end if;

  update public.admin_cleanup_scan_runs
  set status = case when external_stale > 0 then 'completed_with_warnings' else 'completed' end,
      summary = summary || jsonb_build_object(
        'completed_at',now(),
        'repaired_stuck_runs',repaired_stuck,
        'health',public.admin_cleanup_system_summary()
      ),
      completed_at = now()
  where id = run_id;

  after_summary := public.admin_cleanup_system_summary();

  return jsonb_build_object(
    'run_id',run_id,
    'status',case when external_stale > 0 then 'completed_with_warnings' else 'completed' end,
    'repaired_stuck_runs',repaired_stuck,
    'health',after_summary
  );
end;
$$;

revoke all on function public.admin_cleanup_local_health_scan(text,text) from public, anon, authenticated;
grant execute on function public.admin_cleanup_local_health_scan(text,text) to service_role;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'admin-cleanup-local-health-scan'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'admin-cleanup-local-health-scan',
    '23 */6 * * *',
    'select public.admin_cleanup_local_health_scan(''cron'',''system'');'
  );
end
$$;

select public.admin_cleanup_local_health_scan('migration','system');
