-- Préparation NON APPLIQUÉE : ne pas exécuter tant que les contrôles ne sont pas satisfaisants.
-- Cette intervention sécurise le cron existant au lieu de créer un second nettoyage.
BEGIN;
DO $create_secret$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'stip_tableau_purge_cron_token'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32),'hex'),
      'stip_tableau_purge_cron_token',
      'Authentification interne de stip-team-chat-purge'
    );
  END IF;
END
$create_secret$;
CREATE OR REPLACE FUNCTION public.stip_authorize_tableau_purge(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $authorize$
DECLARE expected_secret text;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  SELECT ds.decrypted_secret INTO expected_secret
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'stip_tableau_purge_cron_token'
  LIMIT 1;
  IF expected_secret IS NULL THEN RETURN false; END IF;
  RETURN extensions.digest(p_token,'sha256') =
         extensions.digest(expected_secret,'sha256');
END
$authorize$;
REVOKE ALL ON FUNCTION public.stip_authorize_tableau_purge(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stip_authorize_tableau_purge(text)
  TO service_role;

-- Remplacer uniquement la commande du job existant, sans changer sa fréquence.
DO $replace_job$
DECLARE current_job bigint;
BEGIN
  SELECT jobid INTO current_job
  FROM cron.job
  WHERE jobname = 'stip-tableau-midnight-reset' AND active = true;
  IF current_job IS NULL THEN
    RAISE EXCEPTION 'Cron STIP actuel introuvable / inactif : annulation';
  END IF;
  PERFORM cron.alter_job(
    job_id => current_job,
    command => $job$
      SELECT net.http_post(
        url := 'https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-team-chat-purge',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-stip-cron-token',
          (SELECT decrypted_secret FROM vault.decrypted_secrets
           WHERE name = 'stip_tableau_purge_cron_token' LIMIT 1)
        ),
        body := '{"action":"purge"}'::jsonb
      ) AS request_id;
    $job$
  );
END
$replace_job$;
COMMIT;

-- Contrôles SQL en lecture seule à exécuter après migration :
-- SELECT has_function_privilege('anon', 'public.stip_authorize_tableau_purge(text)', 'EXECUTE') AS anon_allowed,
--        has_function_privilege('authenticated', 'public.stip_authorize_tableau_purge(text)', 'EXECUTE') AS authenticated_allowed,
--        has_function_privilege('service_role', 'public.stip_authorize_tableau_purge(text)', 'EXECUTE') AS service_role_allowed;
-- SELECT public.stip_authorize_tableau_purge('bad-token') AS bad_token_rejected;
-- Ne JAMAIS afficher la valeur decrypted_secret ni le jeton d'authentification.
