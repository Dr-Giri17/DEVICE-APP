# HealthSync → Supabase checkpoint — 2026-06-05

## Status

HealthSync Core stable sync is confirmed working with Supabase primary ingest and Google Sheets fallback/debug.

Repository: `Dr-Giri17/DEVICE-APP`

Branch: `claude/amazfit-active-2-app-r56Yp`

Device app: HealthSync 1.14.0

App ID: `1115576`

Supabase project: OS Healthcare

Project ID: `fanoxbxkxbrvthwpvfkn`

## Confirmed working path

```text
Amazfit Active 2 / Zepp OS HealthSync 1.14.0
→ Google Apps Script Web App
→ public.healthsync_ingest(p_token text, p_payload jsonb)
→ healthsync_device_events
→ healthsync_daily_metrics
→ healthsync_checkup_readings when payload includes checkupReadings
```

Google Sheets remains fallback/debug.

## Validation result

After Apps Script redeploy and `SYNC NOW` from the watch, Supabase showed:

```text
healthsync_device_events     3
healthsync_daily_metrics     3
healthsync_checkup_readings  0
spo2_*                       0
```

Latest real watch payload observed:

```text
event_type: health
heart_rate: 85
steps: 2338
calories: 0
has_sleep_data: true
checkup_count: 0
```

`checkupReadings = 0` is acceptable for this checkpoint because the active watch payload did not include checkup rows. Daily health snapshot ingestion is confirmed.

## Issues fixed during checkpoint

1. Missing Google Apps Script Script Properties.
2. Missing Apps Script OAuth scope for `UrlFetchApp.fetch`:
   `https://www.googleapis.com/auth/script.external_request`.
3. Broken `appsscript.json` manifest caused by multiple JSON objects being pasted together.
4. Supabase RPC could not resolve `digest(text, text)` because `pgcrypto` functions are in the `extensions` schema.

## Durable fixes now documented in repo

- `google-apps-script/appsscript.json`
- `supabase/migrations/20260605_fix_healthsync_ingest_digest_schema.sql`

## Secrets policy

Do not commit these values to GitHub:

- `SUPABASE_ANON_KEY`
- `HEALTHSYNC_INGEST_TOKEN`

They must remain only in Google Apps Script:

```text
Project Settings → Script Properties
```

Because the token/key were exposed during debugging in chat, rotate the ingest token after the pipeline is stable.

## Current architectural decision

HealthSync Core remains stable-only:

- heart rate
- steps
- calories
- sleep duration / sleep score
- checkup readings when available
- Google Sheets fallback/debug
- Supabase primary ingest

SpO2 active measurement must remain outside HealthSync Core until safety testing is complete.

Recommended future direction: separate `SpO2 Lab` experimental module/app.

## Next recommended tasks

1. Keep HealthSync Core unchanged.
2. Remove or mark the test payload row (`HR 77`, `steps 1234`) as test data.
3. Rotate ingest token and update Google Apps Script Script Properties.
4. Add a small admin query/view later for recent HealthSync events.
5. Start SpO2 Lab only as a separate experimental safety branch, not inside Core.
