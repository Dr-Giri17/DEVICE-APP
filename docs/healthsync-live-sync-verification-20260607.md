# HealthSync Live Sync Verification — 2026-06-07

## Scope

This document records a live verification checkpoint for the Zepp OS / Amazfit Active 2 HealthSync pipeline used by HOS / BodyDharma.

This is a documentation-only checkpoint. It does not authorize or imply any code changes.

## Repository context

Repository: `Dr-Giri17/DEVICE-APP`

Primary HealthSync branch context: `claude/amazfit-active-2-app-r56Yp`

Related established checkpoints:

- Supabase-primary ingest confirmed working after Zepp app / watch update.
- Ingest token rotated and confirmed by real watch sync.
- Admin observability views are live.
- SpO2 Lab is separate and experimental only; it must not be mixed into HealthSync Core.

## Confirmed architecture

Current working path:

```text
Amazfit Active 2 / Zepp OS HealthSync
→ Google Apps Script Web App
→ public.healthsync_ingest(p_token text, p_payload jsonb)
→ healthsync_device_events
→ healthsync_daily_metrics
→ healthsync_checkup_readings only when checkupReadings are present
```

Google Sheets remains fallback/debug only.

## Live sync evidence

On 2026-06-07 local morning, the watch/device logs showed a HealthSync payload being generated and sent.

Device log payload timestamp:

```text
2026-06-06T23:12:03.115Z
```

Observed device log payload fields:

```json
{
  "type": "health",
  "timestamp": "2026-06-06T23:12:03.115Z",
  "heartRate": 67,
  "steps": 81,
  "calories": 0,
  "bloodOxygen": 99,
  "hasSleepData": true,
  "sleepScore": 75,
  "sleepMinutes": 464,
  "deepSleepMinutes": 97,
  "checkupReadings": null
}
```

Supabase received the corresponding payload in `public.healthsync_daily_metrics`:

```text
created_at: 2026-06-06 23:12:05.646299+00
event_time: 2026-06-06 23:12:03.115+00
heart_rate: 67
steps: 81
calories: 0
blood_oxygen: 99
has_sleep_data: true
sleep_score: 75
sleep_minutes: 464
deep_sleep_minutes: 97
checkupReadings: null
contains_rmssd: false
contains_rrCount: false
contains_stress: false
```

The event was received approximately 2.5 seconds after the device log timestamp, confirming that the watch → Apps Script → Supabase primary ingest path is functioning.

## Important findings

### 1. Primary ingest works

The live payload shown in the Zepp OS JS App Log matches the Supabase row by timestamp and values.

This confirms that HealthSync can successfully send current watch health payloads into Supabase.

### 2. Blood oxygen is now confirmed in daily metrics

`bloodOxygen` from the watch payload is being stored as `blood_oxygen` in `public.healthsync_daily_metrics`.

Confirmed value in this checkpoint:

```text
blood_oxygen: 99
```

This is a useful production-path confirmation for daily SpO2-like blood oxygen data already present in the HealthSync daily payload.

This does not change the SpO2 Lab safety boundary. SpO2 Lab remains separate and experimental-only.

### 3. HRV / RMSSD is still absent from the live payload

The live payload did not include HRV/RMSSD fields.

Confirmed absent in the Supabase row:

```text
contains_rmssd: false
contains_rrCount: false
contains_stress: false
checkupReadings: null
```

This means HRV/RMSSD is not currently arriving through the regular daily HealthSync payload.

### 4. `checkupReadings` remains null

Although the database schema and ingest path have support for `healthsync_checkup_readings`, this live sync did not produce normalized checkup rows.

Current state after this verification:

```text
public.healthsync_checkup_readings total rows: 0
rows_with_rmssd: 0
rows_with_rr_count: 0
rows_with_stress: 0
rows_with_spo2: 0
```

### 5. Wi-Fi timeout appears non-blocking for primary ingest

The device/app logs may show a later Wi-Fi timeout or service-side noise, but the primary payload was still received by Supabase.

Therefore, the observed Wi-Fi timeout should not currently be treated as proof that HealthSync ingest failed.

The more reliable success indicator is the Supabase row matching the device log timestamp and payload values.

## Current interpretation

HealthSync primary ingest is working.

Confirmed metrics currently reaching Supabase include:

- heart rate
- steps
- calories
- blood oxygen
- sleep data flag
- sleep score
- sleep minutes
- deep sleep minutes

HRV/RMSSD is not currently confirmed in live payloads.

The issue is not the Supabase ingest path. The issue is that the current HealthSync payload does not contain HRV/RMSSD/checkup readings.

## Safety boundaries

No changes are authorized by this checkpoint to:

- HealthSync Core
- `google-apps-script/Code.gs`
- `public.healthsync_ingest()`
- Supabase migrations
- production ingest behavior
- SpO2 Lab experimental branch
- active SpO2 measurement logic
- HRV implementation logic

Do not add active measurements or production HRV/SpO2 features based on this checkpoint alone.

## Safe next steps

1. Keep HealthSync Core stable.
2. Do not implement HRV mapping until a live payload with HRV/RMSSD is confirmed.
3. Continue observing whether `checkupReadings` ever becomes a non-empty array.
4. If future logs show `checkupReadings` with `rmssd`, `rrCount`, or `stress`, then run a separate review before any schema, mapping, dashboard, or clinical interpretation changes.
5. If HRV remains absent, investigate alternative sources separately:
   - Zepp / phone-side export
   - Health Connect
   - Google Fit, if available
   - separate experimental Zepp OS HRV branch only after safety review

## Documentation status

Documentation-only checkpoint.

No source code changes.
No Apps Script changes.
No Supabase migrations.
No HealthSync Core changes.
No secrets added.
