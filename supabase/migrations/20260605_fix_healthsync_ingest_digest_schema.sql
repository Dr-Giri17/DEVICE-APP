-- HealthSync ingest digest schema fix
--
-- Context:
-- Supabase installs pgcrypto functions such as digest(text, text) in the
-- extensions schema. The HealthSync RPC is SECURITY DEFINER and previously
-- used a restricted search_path that did not include extensions, causing:
--   function digest(text, unknown) does not exist
--
-- The live project was fixed on 2026-06-05 by ensuring healthsync_ingest can
-- resolve pgcrypto digest. This migration captures the required durable fix.
--
-- No secrets are stored here. Ingest token and Supabase keys must remain only
-- in Google Apps Script Script Properties.

alter function public.healthsync_ingest(text, jsonb)
  set search_path to 'public', 'extensions', 'pg_temp';

-- Optional hardening for future full function rewrites:
-- inside public.healthsync_ingest(), prefer explicit schema qualification:
--   extensions.digest(p_token, 'sha256')
