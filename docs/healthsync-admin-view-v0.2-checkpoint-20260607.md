# HealthSync Admin View v0.2 Checkpoint — 2026-06-07

## Status

HealthSync Admin View v0.2 is live in Supabase.

View name:

`public.healthsync_latest_daily_metrics_admin`

This is an admin observability view for recent HealthSync daily metrics. It does not change HealthSync Core, Apps Script, the ingest RPC, or production ingest behavior.

## Purpose

The view gives a quick read-only way to inspect latest HealthSync sync rows without writing ad hoc SQL every time.

It is intended for admin/operator visibility only.

## Confirmed columns

The view exposes:

- metric_id
- organization_id
- patient_id
- matched_source_event_id
- created_at
- event_time
- ingest_delay_seconds
- metric_date
- heart_rate
- steps
- calories
- blood_oxygen
- has_sleep_data
- sleep_score
- sleep_minutes
- deep_sleep_minutes
- source
- confidence
- clinical_use
- checkup_reading_count
- has_checkup_readings
- contains_rmssd
- contains_rr_count
- contains_stress
- payload_fingerprint
- payload_summary

## Latest observed row at creation

Latest sync observed through the view:

- created_at: 2026-06-06 23:12:05 UTC
- event_time: 2026-06-06 23:12:03 UTC
- ingest_delay_seconds: 3
- heart_rate: 67
- steps: 81
- calories: 0
- blood_oxygen: 99
- sleep_score: 75
- sleep_minutes: 464
- deep_sleep_minutes: 97
- checkup_reading_count: 0
- has_checkup_readings: false
- contains_rmssd: false
- contains_rr_count: false
- contains_stress: false

## Permissions checkpoint

Initial default view privileges were too broad.

Permissions were tightened after creation:

- anon: no access
- authenticated: SELECT only
- postgres: owner/admin level privileges
- service_role: backend/service privileges

This keeps the view read-only for authenticated app/admin access and removes anonymous access.

## Interpretation

The view confirms that HealthSync primary ingest is working and that the latest payload is visible quickly with ingest delay, blood oxygen, sleep metrics, and HRV/checkup flags.

HealthSync Core remains stable and frozen.

HRV/RMSSD remains in Investigation because no live payload has yet contained rmssd, rrCount, stress, or non-empty checkupReadings.

SpO2 Lab remains separate experimental work and is not authorized by this admin view.

## Safety boundaries

No changes were made to:

- HealthSync Core
- Google Apps Script Code.gs
- public.healthsync_ingest()
- watch measurement logic
- production payload structure
- SpO2 Lab branch
- HRV implementation logic

## Next safe steps

1. Use the admin view for quick HealthSync sync checks.
2. Keep HRV/RMSSD as Investigation until live source data is confirmed.
3. Keep SpO2 Lab isolated in a separate experimental chat and branch.
4. Do not modify HealthSync Core unless a clear defect is identified and reviewed.
