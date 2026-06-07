# SpO2 Lab safety spec v0.1

## 1. Purpose

SpO2 Lab is a separate experimental safety branch for exploring whether manual
or explicitly user-triggered SpO2 measurement is possible on Amazfit Active 2 /
Zepp OS without destabilizing the watch.

SpO2 Lab is not part of HealthSync Core. It is not part of production ingest,
clinical workflows, patient-facing reporting, or HealthSync's stable Supabase
pipeline.

This document is a safety specification only. It does not authorize code
changes, database migrations, active SpO2 measurement, or production export.
In v0.1, no SpO2 sensor API call, passive read, historical read, active test
pulse, or storage/export implementation is approved.

Companion documentation:

- `docs/spo2-lab-api-inventory-v0.1.md` inventories documented Zepp OS SpO2
  capabilities as a blocklist, not an implementation plan.
- `docs/spo2-lab-risk-model-v0.1.md` describes safety risks and controls; it
  does not authorize any SpO2 API call.

## 2. Non-goals

SpO2 Lab v0.1 explicitly does not include:

- Active SpO2 measurement inside HealthSync Core.
- Background or continuous SpO2 measurement.
- Sleep-time active SpO2 measurement.
- Silent background sensor activation.
- Medical diagnosis.
- Automatic health recommendations.
- Patient-facing SpO2 interpretation.
- Production database writes.
- Changes to Google Apps Script.
- Changes to `public.healthsync_ingest()`.
- Changes to the current Supabase schema.
- Production integration with HealthSync ingest.
- Any `BloodOxygen` API call, including passive or historical reads.
- Any SpO2 data export, even if marked experimental.

## 3. Safety boundaries

Any future SpO2 Lab implementation, if later approved, must remain manual-only
and explicitly triggered by the user. This v0.1 document does not approve that
implementation.

Required safety boundaries:

- No automatic SpO2 calls on page init.
- No SpO2 sensor object creation on page init.
- No background active measurement.
- No silent measurement.
- No frequent polling.
- No sleep-time active measurement in v0.1.
- No long-running red/IR LED activation.
- No repeated measurement loop unless separately reviewed and approved.
- Always stop the sensor after any future test pulse.
- Always enforce cooldown between future test pulses.
- Prefer shortest possible diagnostic pulse if active measurement is ever
  implemented.
- Show clear experimental warnings before any measurement action.
- Protect battery and device stability over data collection.
- Treat failed or unstable API behavior as a stop condition.
- Store or export only the minimum data needed for debugging.
- Never present SpO2 values as clinically validated.
- Never generate patient-facing medical interpretation from SpO2 Lab data.

Privacy boundaries:

- No secrets in source code or docs.
- No raw tokens, Supabase keys, or service-role keys.
- Raw payload JSON is allowed only when justified for debugging and only in an
  experimental, non-production context.
- Any future data export must be reviewed separately before implementation.

## 4. Possible future data model, documentation only

This section is non-binding and not implemented.

No migration is added by this spec. No production table is created. These fields
are only a starting point for future design review if SpO2 Lab becomes safe
enough to prototype.

Do not create these fields, tables, events, or exports from this document alone.
They require a later reviewed implementation plan and explicit approval.

Possible future event or table fields:

- `measured_at`
- `spo2_percent`
- `source_device`
- `measurement_mode`
- `user_triggered`
- `signal_quality` if available from Zepp OS
- `duration_sec`
- `ret_code`
- `ret_status`
- `battery_level`
- `confidence`
- `clinical_use`
- `notes`
- `raw_payload_jsonb` only if justified for debugging

Required fixed values for any future experimental record:

```text
confidence = experimental
clinical_use = not_validated
user_triggered = true
```

Potential `measurement_mode` values, subject to future review:

```text
manual_diagnostic_pulse
passive_read_only
system_history_read_only
```

Forbidden future modes without separate explicit approval:

```text
background_continuous
sleep_active
production_sync
clinical_monitoring
```

## 5. Implementation gates before any code

No SpO2 Lab code may be written until these gates are reviewed:

1. Confirm Zepp OS BloodOxygen API capability on Amazfit Active 2.
2. Confirm whether the API can read SpO2 passively without starting the red/IR
   LED.
3. Confirm whether active measurement is available only through the system app.
4. Confirm current device behavior after the Zepp app/watch update.
5. Confirm whether prior third-party API instability still appears.
6. Confirm battery impact of any proposed test pulse.
7. Confirm sensor temperature / device stability behavior.
8. Confirm permission model and whether additional app permissions are needed.
9. Confirm whether data can be exported without touching HealthSync Core.
10. Confirm that Google Apps Script and `public.healthsync_ingest()` remain
    unchanged.
11. Create a separate implementation plan.
12. Review and approve the implementation plan before code changes.
13. Create or update a later safety spec version that explicitly authorizes the
    proposed implementation scope.
14. Confirm that v0.1 documentation-only status is no longer being used as the
    implementation authorization.

This section is a blocker checklist, not an implementation instruction. Passing
the checklist does not by itself authorize code changes.

Minimum review questions:

- Does opening the page instantiate `BloodOxygen`?
- Does any code run automatically without a user tap?
- Can the sensor stay active longer than the reviewed maximum?
- Is there a hard timeout?
- Is `stop()` guaranteed after success, failure, timeout, and page destroy?
- Is there a cooldown?
- Does the implementation avoid HealthSync Core?
- Does the implementation avoid production ingest?
- Does the implementation avoid patient-facing interpretation?
- Does the implementation avoid creating any Supabase migration unless that
  migration has separate explicit approval?

## 6. Automation / AI guardrails

Codex, Claude, or any other coding agent must treat this document as a safety
boundary, not an implementation request.

Agents must not infer permission to:

- Add SpO2 measurement code.
- Instantiate `BloodOxygen`.
- Add polling loops.
- Add background services.
- Add Google Apps Script routes for SpO2 Lab.
- Add Supabase migrations for SpO2 Lab.
- Add production ingest paths.
- Convert conceptual fields into schema.

If asked to implement SpO2 Lab from this document alone, the correct behavior is
to stop and request a separate approved implementation plan.

## 7. Branch policy

Future SpO2 work must happen only in a dedicated experimental branch.

Branch requirements:

- Use an `experiment/` branch name.
- Keep implementation isolated from HealthSync Core.
- Do not modify stable sync pages.
- Do not modify Google Apps Script.
- Do not modify `public.healthsync_ingest()`.
- Do not add Supabase production migrations.
- Do not merge into the production HealthSync path without separate review.

Any production integration requires:

1. Separate design review.
2. Separate safety review.
3. Explicit approval.
4. Manual test evidence from Amazfit Active 2.
5. Confirmation that stable HealthSync ingest remains unaffected.

## 8. Current safe baseline

HealthSync 1.14.0 Supabase-primary ingest is confirmed working after Zepp app /
watch update and after ingest-token rotation.

Current stable path:

```text
Amazfit Active 2 / Zepp OS HealthSync
-> Google Apps Script Web App
-> public.healthsync_ingest(p_token text, p_payload jsonb)
-> healthsync_device_events
-> healthsync_daily_metrics
-> healthsync_checkup_readings when checkupReadings are present
```

Google Sheets remains fallback/debug only.

Admin/debug observability is live:

```text
public.healthsync_recent_device_events_admin
public.healthsync_recent_daily_metrics_admin
public.healthsync_recent_checkup_readings_admin
```

Latest confirmed post-rotation event:

```text
received_at: 2026-06-06 12:14:11 UTC
event_time: 2026-06-06 12:14:06 UTC
heart_rate: 83
steps: 2983
sleepScore: 66
sleepMinutes: 378
deepSleepMinutes: 56
checkup_reading_count: 0
```

This baseline must not be disturbed by SpO2 Lab.

## Final safety statement

SpO2 Lab v0.1 is documentation-only. It does not add code, migrations,
production ingest, active measurement, background measurement, medical
interpretation, or patient-facing recommendations.

HealthSync Core remains stable-only.
