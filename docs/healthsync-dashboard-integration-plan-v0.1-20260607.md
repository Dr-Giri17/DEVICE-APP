# HealthSync Dashboard Integration Plan v0.1 — 2026-06-07

## Status

This is a documentation-only integration plan for bringing confirmed HealthSync metrics into a future BodyDharma / HOS dashboard layer.

No application code is changed by this document.

## Current confirmed HealthSync baseline

HealthSync Core is stable and frozen.

Confirmed working path:

Amazfit Active 2 / Zepp OS HealthSync -> Google Apps Script Web App -> public.healthsync_ingest() -> Supabase HealthSync tables.

Confirmed live metrics reaching Supabase:

- heart_rate
- steps
- calories
- blood_oxygen
- has_sleep_data
- sleep_score
- sleep_minutes
- deep_sleep_minutes

Admin observability view is live:

`public.healthsync_latest_daily_metrics_admin`

## Dashboard source of truth

For the first dashboard integration slice, use:

`public.healthsync_latest_daily_metrics_admin`

This view already exposes:

- created_at
- event_time
- ingest_delay_seconds
- heart_rate
- steps
- calories
- blood_oxygen
- sleep_score
- sleep_minutes
- deep_sleep_minutes
- checkup_reading_count
- has_checkup_readings
- contains_rmssd
- contains_rr_count
- contains_stress
- payload_summary

Do not query raw device payloads directly from the frontend unless explicitly reviewed later.

## Proposed dashboard cards

### 1. Latest Sync Status

Purpose: show whether the watch is currently syncing into Supabase.

Fields:

- event_time
- created_at
- ingest_delay_seconds
- source freshness status

Suggested UI states:

- Fresh: latest event within expected sync window
- Delayed: latest event older than expected
- Stale: no recent sync
- Unknown: missing data

### 2. Daily Recovery Snapshot

Purpose: show high-level passive recovery context without clinical interpretation.

Fields:

- heart_rate
- blood_oxygen
- sleep_score
- sleep_minutes
- deep_sleep_minutes

Important: do not generate treatment recommendations from these fields in v0.1.

### 3. Activity Snapshot

Purpose: show simple daily movement context.

Fields:

- steps
- calories

Calories currently appear as 0 in live HealthSync payloads and should be treated as low-confidence until validated.

### 4. HRV Investigation Status

Purpose: show that HRV is not yet available, rather than silently hiding it.

Fields:

- has_checkup_readings
- checkup_reading_count
- contains_rmssd
- contains_rr_count
- contains_stress

Suggested UI copy:

HRV/RMSSD not yet available from current HealthSync payload.

Do not display fake, estimated, or inferred HRV values.

## Safety boundaries

Dashboard v0.1 must remain observation-only.

Do not add:

- diagnosis
- automatic treatment recommendations
- red flag interpretation
- recovery prescriptions
- HRV inference
- SpO2 Lab measurement features
- active measurement triggers
- production changes to HealthSync Core

## Data interpretation boundaries

### Heart rate

Can be shown as a passive current/context metric.

Do not diagnose tachycardia/bradycardia automatically.

### Blood oxygen

Can be shown as `blood_oxygen` from HealthSync daily payload.

Do not treat this as SpO2 Lab data.

Do not trigger clinical alerts from it in v0.1.

### Sleep metrics

Can be shown descriptively:

- sleep score
- sleep minutes
- deep sleep minutes

Do not create automatic sleep prescriptions in v0.1.

### HRV/RMSSD

Current status: Investigation.

Do not show HRV cards as if HRV is available.

Only display HRV when a live payload or normalized row confirms rmssd / rr_count.

## Recommended implementation order

### Slice 1 — Read-only dashboard panel

Add a clinician/admin-facing HealthSync panel using the admin view.

Minimum fields:

- latest sync time
- ingest delay
- heart rate
- blood oxygen
- sleep score
- sleep duration
- deep sleep duration
- HRV availability status

### Slice 2 — Freshness and data quality indicators

Add simple labels:

- Fresh
- Delayed
- Stale
- Missing
- Low confidence

### Slice 3 — Patient/client mapping review

Before using this with multiple clients, review:

- organization_id mapping
- patient_id mapping
- who owns the watch/device
- whether the payload should be linked to Vladimir only or other clients later

### Slice 4 — Optional trend charts

Only after stable read-only cards exist:

- heart_rate trend
- blood_oxygen trend
- sleep_score trend
- sleep_minutes trend
- steps trend

## Out of scope for v0.1

- HRV implementation
- SpO2 Lab implementation
- active watch measurement triggers
- notification logic
- clinical recommendations
- AI reasoning over HealthSync values
- client-facing interpretation
- production HOS intervention selection

## Open questions

1. Should the first dashboard panel live in BodyDharma app or HOS dashboard?
2. Should it be admin-only first?
3. Should it be linked only to Vladimir initially?
4. How should stale sync status be defined?
5. Should HealthSync values be copied into daily_logs later, or remain in HealthSync-specific tables/views?

## Current recommendation

Use HealthSync-specific tables/views as the source of truth for now.

Do not copy HealthSync values into general daily_logs until dashboard needs and patient mapping are reviewed.

Keep the first UI integration admin-facing, read-only, and non-clinical.

## Documentation status

Documentation-only plan.

No source code changes.
No HealthSync Core changes.
No Apps Script changes.
No Supabase RPC changes.
No production ingest changes.
No secrets added.
