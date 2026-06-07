# SpO2 Lab risk model v0.1

## Status

This risk model is documentation-only. It does not authorize implementation.
It must not be interpreted as approval to call any SpO2 API.

SpO2 Lab remains experimental-only and separate from HealthSync Core.

## Risk scale

| Level | Meaning |
|---|---|
| Low | Documentation concern or manageable operational risk. |
| Medium | Could affect privacy, user understanding, or future scope. |
| High | Could affect device stability, ingest integrity, or safety boundaries. |
| Critical | Could reproduce known unsafe behavior or contaminate production systems. |

## 1. Battery risk

Risk level: high

Risk:

- Active optical SpO2 measurement may consume more power than passive health
  reads.
- Repeated attempts may drain battery unexpectedly.
- Low battery may increase device instability.

v0.1 controls:

- No SpO2 API calls are authorized.
- No active test pulse is authorized.
- No polling loop is authorized.
- No background measurement is authorized.

Future gates before any implementation:

- Define minimum battery threshold.
- Define maximum active duration.
- Define cooldown.
- Define hard stop behavior.
- Test only on a non-critical device after review.

## 2. Active optical sensor measurement risk

Risk level: critical

Risk:

- Active SpO2 measurement may use red/IR optical hardware.
- Prior third-party API experiments may have left the watch unstable or caused
  fast failures.
- Long-running activation may heat the sensor area or trigger device reboot.

v0.1 controls:

- `BloodOxygen.start()` is forbidden.
- Legacy `spo2.start()` is forbidden.
- `hmSensor.id.SPO2` is forbidden.
- No page may instantiate SpO2 sensor objects.

Future gates before any implementation:

- Confirm Amazfit Active 2 behavior after current Zepp/watch update.
- Confirm whether the system app is the only safe active measurement path.
- Confirm whether any third-party active measurement is still unstable.
- Require explicit review before even a single manual diagnostic pulse.

## 3. Invalid wearing / invalid signal / timeout risk

Risk level: high

Risk:

- RetCode states such as invalid wearing, invalid signal, timeout, failure, low
  value, or high value can be misread as valid health information.
- A "continue measuring" state can encourage longer polling.
- Repeated invalid states may indicate user positioning, sensor contact, or API
  instability rather than true physiology.

v0.1 controls:

- RetCode reads are forbidden.
- No SpO2 value interpretation is authorized.
- No user-facing result display is authorized.

Future gates before any implementation:

- Define exact retCode handling before code.
- Treat non-success states as stop conditions.
- Never treat retCode `1` as a valid measurement.
- Never display a value without explicit validation and disclaimer.

## 4. Background / continuous measurement risk

Risk level: critical

Risk:

- Background or continuous measurement could silently activate hardware.
- App Service behavior may persist beyond a visible page.
- Measurement during sleep or without immediate user awareness is outside the
  v0.1 safety boundary.

v0.1 controls:

- No background measurement.
- No App Service SpO2 work.
- No sleep-time active measurement.
- No silent measurement.
- No repeated protocol loop.

Future gates before any implementation:

- Background SpO2 remains forbidden unless a later safety review explicitly
  changes this policy.
- Any App Service use must be reviewed independently.

## 5. Privacy and consent risk

Risk level: high

Risk:

- SpO2 is sensitive health data.
- Historical reads could expose data collected outside explicit SpO2 Lab user
  intent.
- Raw payloads could include timestamps, device metadata, and health values.

v0.1 controls:

- No SpO2 reads are authorized.
- No historical reads are authorized.
- No storage/export is authorized.
- No raw payload capture is authorized.

Future gates before any implementation:

- Define explicit user consent language.
- Define data minimization rules.
- Define retention rules.
- Define whether raw payload JSON is justified.
- Keep `confidence = experimental` and `clinical_use = not_validated`.

## 6. Medical interpretation / false reassurance risk

Risk level: critical

Risk:

- A displayed SpO2 value can be interpreted as medical guidance.
- Normal-looking values can create false reassurance.
- Abnormal-looking values can create unnecessary anxiety.
- Watch sensor readings are not clinical diagnostics.

v0.1 controls:

- No patient-facing SpO2 interpretation.
- No diagnosis.
- No automatic recommendations.
- No clinical labels.
- No production reporting.

Future gates before any implementation:

- Add explicit non-clinical disclaimer text.
- Avoid "normal", "safe", "danger", or diagnosis language.
- Do not generate recommendations from SpO2 Lab data.

## 7. Export / storage risk

Risk level: high

Risk:

- Export paths can quickly become production ingest.
- Storing experimental values may contaminate health history.
- Raw JSON can store more data than intended.

v0.1 controls:

- No storage.
- No export.
- No Google Apps Script changes.
- No Supabase migration.
- No production ingest.

Future gates before any implementation:

- Define storage separately from measurement.
- Prefer local-only debug until reviewed.
- Require explicit approval before any Supabase table, view, or RPC change.
- Require explicit approval before any Google Apps Script route change.

## 8. Production ingest contamination risk

Risk level: critical

Risk:

- Experimental SpO2 values could enter `healthsync_device_events`,
  `healthsync_daily_metrics`, or future patient-facing views.
- Experimental data could be mistaken for stable HealthSync Core data.
- Existing Supabase-primary ingest is working and must not be disturbed.

v0.1 controls:

- No production database writes.
- No changes to `public.healthsync_ingest()`.
- No changes to Google Apps Script.
- No changes to HealthSync Core.
- No SpO2 production sync.

Future gates before any implementation:

- Keep experimental data physically and semantically separate.
- Use explicit `experimental` and `not_validated` markers.
- Require separate review before any production integration.

## 9. HealthSync Core separation risk

Risk level: critical

Risk:

- Adding SpO2 Lab to stable HealthSync Core could break confirmed sync for
  heart rate, steps, calories, sleep, and checkup readings.
- Core instability would damage the confirmed Supabase-primary pipeline.

v0.1 controls:

- HealthSync Core is out of scope.
- No stable sync page changes.
- No app-side request changes.
- No Apps Script changes.
- No ingest RPC changes.

Future gates before any implementation:

- Use a dedicated experimental branch.
- Keep any future prototype isolated from Core.
- Verify stable Core diff is empty before review.

## 10. AI-agent misinterpretation risk

Risk level: high

Risk:

- A coding agent may treat API inventory as permission to implement.
- Conceptual field lists may be converted into migrations prematurely.
- "Manual-only" language may be misread as authorization for a manual test
  pulse.

v0.1 controls:

- API inventory is a blocklist, not an implementation plan.
- Risk model is a safety boundary, not an implementation plan.
- No code may be written from these documents alone.
- Future implementation requires separate explicit approval.

Future gates before any implementation:

- Restate prohibitions in every implementation prompt.
- Require a reviewed plan before code.
- Confirm no source, Apps Script, migration, or ingest changes happen without
  explicit scope.

## Final risk statement

SpO2 Lab v0.1 has no approved implementation path.

The safest state is the current state:

```text
HealthSync Core stable
Supabase-primary ingest stable
SpO2 Lab documentation-only
No SpO2 API calls
No SpO2 production ingest
```

Any future change must prove that it preserves this baseline before code is
written.
