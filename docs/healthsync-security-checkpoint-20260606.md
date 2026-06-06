# HealthSync security checkpoint — 2026-06-06

## Status

HealthSync 1.14.0 Supabase-primary ingest is confirmed working after Zepp app / watch update and after ingest-token rotation.

Repository: `Dr-Giri17/DEVICE-APP`

Branch: `claude/amazfit-active-2-app-r56Yp`

Device/app path:

```text
Amazfit Active 2 / Zepp OS HealthSync
-> Google Apps Script Web App
-> public.healthsync_ingest(p_token text, p_payload jsonb)
-> healthsync_device_events
-> healthsync_daily_metrics
-> healthsync_checkup_readings when checkupReadings are present
```

Google Sheets remains fallback/debug only.

## Completed work

### 1. Admin observability layer is live

The following Supabase admin/debug views were added and applied:

- `public.healthsync_recent_device_events_admin`
- `public.healthsync_recent_daily_metrics_admin`
- `public.healthsync_recent_checkup_readings_admin`

These views are admin/debug only. They are not client-facing and are not for clinical decision-making.

### 2. Ingest token rotation completed

The new ingest token row is active and was confirmed by a real watch sync.

Confirmed new token row metadata:

```text
name: healthsync-watch-rotated-20260606
active: true
last_used_at: 2026-06-06 12:14:11 UTC
```

The old token row was deactivated after the new token was confirmed working.

Confirmed old token row metadata:

```text
name: amazfit-active-2-healthsync-v1
active: false
last_used_at: 2026-06-06 07:21:26 UTC
```

No raw tokens, token hashes, Supabase anon keys, or service-role keys are stored in this document.

### 3. Post-rotation watch sync confirmed

Latest confirmed post-rotation HealthSync event:

```text
received_at: 2026-06-06 12:14:11 UTC
event_time: 2026-06-06 12:14:06 UTC
heart_rate: 83
steps: 2983
calories: 0
has_sleep_data: true
sleepScore: 66
sleepMinutes: 378
deepSleepMinutes: 56
checkup_reading_count: 0
```

This confirms:

```text
Amazfit Active 2 -> HealthSync -> Apps Script with rotated token -> Supabase ingest -> admin views
```

## Security / safety confirmations

- HealthSync Core was not changed.
- `google-apps-script/Code.gs` was not changed for token rotation.
- `public.healthsync_ingest()` behavior was not changed for token rotation.
- No active SpO2 measurement logic was added.
- SpO2 Lab remains a future separate safety branch.
- No `.zab` build was required for token rotation.
- No destructive cleanup SQL was applied during this checkpoint.
- Raw secrets must remain only in secure operational storage / Google Apps Script Script Properties, never in GitHub.

## Known test row

The known suspected test payload remains intentionally left in place for now:

```text
heart_rate: 77
steps: 1234
event_time: 2026-06-05 13:36:14 UTC
```

Reason: it does not block ingest, and physical deletion is not necessary for the current security checkpoint.

Future cleanup should prefer a non-destructive schema approach such as `is_test`, `archived_at`, or `excluded_from_analysis` before deleting historical rows. Direct delete should only be done after manual confirmation using the runbook.

## Current checkpoint decision

HealthSync Core remains stable-only:

- heart rate
- steps
- calories
- sleep score / duration / deep sleep when available
- checkup readings when payload includes them
- Supabase primary ingest
- Google Sheets fallback/debug
- admin observability views

Active SpO2 measurement is still excluded from HealthSync Core.

## Recommended next steps

1. Keep HealthSync Core unchanged.
2. Do not delete the known test row unless clean production history becomes necessary.
3. If test-data handling becomes important, add a small explicit schema flag instead of deleting rows first.
4. Start SpO2 Lab only as a separate experimental safety branch, not inside HealthSync Core.
