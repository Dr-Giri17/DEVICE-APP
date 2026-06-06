# HealthSync Dashboard Integration Plan v0.1 — 2026-06-07

## Status

This is a documentation-only integration plan for bringing confirmed HealthSync metrics into the broader Self-Care Operating System / HealthcareOS dashboard layer.

No application code is changed by this document.

## Architecture clarification

HealthcareOS / Self-Care OS is the shared system layer for:

- data aggregation
- device ingestion
- longitudinal monitoring
- clinical context
- health intelligence
- supervised recommendations
- shared client identity/profile

BodyDharma App is not a completely separate product. It is a physiotherapy and rehabilitation application branch built on the same Self-Care OS / HealthcareOS core.

BodyDharma App owns the rehabilitation workflow:

- rehab cases
- baseline assessment
- posture / movement assessment
- clinical attachments
- clinician notes
- rehab planning
- session workflow

HealthSync is a device ingestion module inside the same broader OS ecosystem. It collects metrics from wearable/device sources and sends confirmed metrics into the HealthcareOS data layer.

The intended relationship is:

Devices / HealthSync -> HealthcareOS Data Layer -> HealthcareOS Intelligence Layer -> BodyDharma App can consume selected summarized context.

Therefore:

- HealthSync raw metrics are primarily owned by HealthcareOS / HOS Data Layer.
- HealthcareOS Dashboard is the primary dashboard target for HealthSync metrics.
- BodyDharma App is a downstream contextual consumer, not the owner of raw wearable metrics.
- BodyDharma should receive selected recovery/load context only when useful for clinician-facing rehab decisions.

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

### Slice 1 — HealthcareOS read-only dashboard panel

Add an admin/clinician-facing HealthSync panel using the admin view.

Primary target:

- HealthcareOS / HOS dashboard

Secondary future consumer:

- BodyDharma App, only through selected recovery/load context from HealthcareOS

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
- how the shared Self-Care OS client profile maps to BodyDharma rehab cases

### Slice 4 — Optional trend charts

Only after stable read-only cards exist:

- heart_rate trend
- blood_oxygen trend
- sleep_score trend
- sleep_minutes trend
- steps trend

### Slice 5 — BodyDharma contextual bridge

Only after HealthcareOS dashboard integration is stable, define a limited bridge into BodyDharma App.

Possible contextual outputs:

- latest recovery context
- sleep quality context
- fatigue/load status
- sync freshness
- missing data warning

BodyDharma must not own or directly reinterpret raw HealthSync metrics in v0.1.

## Out of scope for v0.1

- HRV implementation
- SpO2 Lab implementation
- active watch measurement triggers
- notification logic
- clinical recommendations
- AI reasoning over HealthSync values
- client-facing interpretation
- production HOS intervention selection
- direct BodyDharma ownership of raw wearable metrics

## Open questions

1. Should the first dashboard panel live in HealthcareOS dashboard only, before any BodyDharma bridge?
2. Should it be admin-only first?
3. Should it be linked only to Vladimir initially?
4. How should stale sync status be defined?
5. Should HealthSync values be copied into daily_logs later, or remain in HealthSync-specific tables/views?
6. What summarized recovery/load context should BodyDharma eventually receive from HealthcareOS?

## Current recommendation

Use HealthSync-specific tables/views as the source of truth for now.

Do not copy HealthSync values into general daily_logs until dashboard needs, patient mapping, and HealthcareOS identity mapping are reviewed.

Keep the first UI integration HealthcareOS-facing, admin/clinician-facing, read-only, and non-clinical.

BodyDharma App should be treated as a synchronized rehabilitation branch within the same Self-Care OS ecosystem, not as a separate owner of HealthSync data.

## Documentation status

Documentation-only plan.

No source code changes.
No HealthSync Core changes.
No Apps Script changes.
No Supabase RPC changes.
No production ingest changes.
No secrets added.
