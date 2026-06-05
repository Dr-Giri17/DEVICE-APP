-- HealthSync recent admin/debug views
--
-- Admin/debug only:
-- - Do not use these views for client-facing health interpretation.
-- - Do not use these views for clinical decision-making.
-- - These views do not trigger active SpO2 measurement.
-- - HealthSync Core and public.healthsync_ingest() are intentionally untouched.
--
-- Deployment:
-- Copy/paste this file into the Supabase SQL Editor, or apply it as a
-- migration. It is idempotent where possible via CREATE OR REPLACE VIEW.

create or replace view public.healthsync_recent_device_events_admin
with (security_invoker = true)
as
select
  e.id as event_id,
  e.organization_id,
  e.patient_id,
  e.created_at as received_at,
  e.event_time,
  (e.event_time at time zone 'UTC')::date as event_date_utc,
  e.device_source,
  e.app_name,
  e.app_version,
  e.event_type,
  e.confidence,
  e.clinical_use,
  md5(e.payload::text) as payload_fingerprint,
  case
    when nullif(e.payload ->> 'heartRate', '') ~ '^[0-9]+$'
      then (e.payload ->> 'heartRate')::integer
  end as heart_rate,
  case
    when nullif(e.payload ->> 'steps', '') ~ '^[0-9]+$'
      then (e.payload ->> 'steps')::integer
  end as steps,
  case
    when nullif(e.payload ->> 'calories', '') ~ '^[0-9]+([.][0-9]+)?$'
      then (e.payload ->> 'calories')::numeric
  end as calories,
  case lower(nullif(e.payload ->> 'hasSleepData', ''))
    when 'true' then true
    when 'false' then false
    else null
  end as has_sleep_data,
  case
    when jsonb_typeof(e.payload -> 'checkupReadings') = 'array'
      then jsonb_array_length(e.payload -> 'checkupReadings') > 0
    else false
  end as has_checkup_readings,
  case
    when jsonb_typeof(e.payload -> 'checkupReadings') = 'array'
      then jsonb_array_length(e.payload -> 'checkupReadings')
    else 0
  end as checkup_reading_count,
  e.payload ->> 'status' as payload_status,
  e.payload ->> 'error' as payload_error,
  jsonb_strip_nulls(jsonb_build_object(
    'type', e.payload -> 'type',
    'timestamp', e.payload -> 'timestamp',
    'heartRate', e.payload -> 'heartRate',
    'steps', e.payload -> 'steps',
    'calories', e.payload -> 'calories',
    'hasSleepData', e.payload -> 'hasSleepData',
    'sleepScore', e.payload -> 'sleepScore',
    'sleepMinutes', e.payload -> 'sleepMinutes',
    'deepSleepMinutes', e.payload -> 'deepSleepMinutes'
  )) as payload_summary
from public.healthsync_device_events e
where e.created_at >= now() - interval '30 days';

comment on view public.healthsync_recent_device_events_admin is
  'Admin/debug only: recent HealthSync device events with safe payload summaries. Not for client-facing health interpretation. Does not trigger active SpO2 measurement.';

comment on column public.healthsync_recent_device_events_admin.payload_fingerprint is
  'Debug-only MD5 fingerprint of stored JSONB payload text. This is not a persisted ingest deduplication key.';


create or replace view public.healthsync_recent_daily_metrics_admin
with (security_invoker = true)
as
select
  m.id as metric_id,
  m.organization_id,
  m.patient_id,
  source_event.event_id as matched_source_event_id,
  m.event_time,
  m.entry_date as metric_date,
  m.heart_rate,
  m.steps,
  m.calories,
  m.blood_oxygen,
  m.has_sleep_data,
  m.sleep_score,
  m.sleep_minutes,
  m.deep_sleep_minutes,
  m.source,
  m.confidence,
  m.clinical_use,
  m.created_at,
  md5(m.raw_payload::text) as payload_fingerprint,
  jsonb_strip_nulls(jsonb_build_object(
    'type', m.raw_payload -> 'type',
    'timestamp', m.raw_payload -> 'timestamp',
    'hasSleepData', m.raw_payload -> 'hasSleepData',
    'checkupReadingCount',
      case
        when jsonb_typeof(m.raw_payload -> 'checkupReadings') = 'array'
          then jsonb_array_length(m.raw_payload -> 'checkupReadings')
        else 0
      end
  )) as payload_summary
from public.healthsync_daily_metrics m
left join lateral (
  select e.id as event_id
  from public.healthsync_device_events e
  where e.organization_id = m.organization_id
    and e.patient_id is not distinct from m.patient_id
    and e.event_type = 'health'
    and e.event_time = m.event_time
  order by e.created_at desc
  limit 1
) source_event on true
where m.created_at >= now() - interval '30 days';

comment on view public.healthsync_recent_daily_metrics_admin is
  'Admin/debug only: recent normalized HealthSync daily metrics. Not for client-facing health interpretation. Does not trigger active SpO2 measurement.';

comment on column public.healthsync_recent_daily_metrics_admin.matched_source_event_id is
  'Best-effort source event match by organization, patient, event type, and exact event_time; no source-event foreign key currently exists.';


create or replace view public.healthsync_recent_checkup_readings_admin
with (security_invoker = true)
as
select
  c.id as reading_id,
  c.organization_id,
  c.patient_id,
  c.reading_time,
  c.sync_date,
  c.heart_rate,
  c.steps,
  c.calories,
  c.spo2,
  c.stress,
  c.rmssd,
  c.rr_count,
  c.confidence,
  c.clinical_use,
  c.created_at,
  md5(c.raw_payload::text) as payload_fingerprint,
  jsonb_strip_nulls(jsonb_build_object(
    't', c.raw_payload -> 't',
    'hr', c.raw_payload -> 'hr',
    'steps', c.raw_payload -> 'steps',
    'cal', c.raw_payload -> 'cal',
    'spo2', c.raw_payload -> 'spo2',
    'stress', c.raw_payload -> 'stress',
    'rmssd', c.raw_payload -> 'rmssd',
    'rrCount', c.raw_payload -> 'rrCount'
  )) as payload_summary
from public.healthsync_checkup_readings c
where c.created_at >= now() - interval '30 days';

comment on view public.healthsync_recent_checkup_readings_admin is
  'Admin/debug only: recent HealthSync checkup readings when present. Empty results are expected when watch payloads contain no checkupReadings. Not for client-facing health interpretation. Does not trigger active SpO2 measurement.';


revoke all on public.healthsync_recent_device_events_admin from public, anon, authenticated;
revoke all on public.healthsync_recent_daily_metrics_admin from public, anon, authenticated;
revoke all on public.healthsync_recent_checkup_readings_admin from public, anon, authenticated;

grant select on public.healthsync_recent_device_events_admin to service_role;
grant select on public.healthsync_recent_daily_metrics_admin to service_role;
grant select on public.healthsync_recent_checkup_readings_admin to service_role;
