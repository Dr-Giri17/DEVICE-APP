# HealthSync token rotation and test-row cleanup runbook - 2026-06-06

## Scope

This is an operational runbook only.

Do not change HealthSync Core. Do not change `public.healthsync_ingest()` behavior.
Do not add or activate SpO2 measurement logic. SpO2 Lab remains a future
separate safety branch.

Do not commit secrets to GitHub:

- `SUPABASE_ANON_KEY`
- `HEALTHSYNC_INGEST_TOKEN`
- Supabase service role keys

## Current safe baseline

HealthSync 1.14.0 Supabase-primary ingest is working after the Zepp/watch
update.

Current path:

```text
Amazfit Active 2 / Zepp OS HealthSync
-> Google Apps Script Web App
-> public.healthsync_ingest(p_token text, p_payload jsonb)
-> healthsync_device_events
-> healthsync_daily_metrics
-> healthsync_checkup_readings when checkupReadings are present
```

Google Sheets remains fallback/debug only.

Recent real watch payload visible through admin views:

```text
HR 85
steps 2338
calories 0
has_sleep_data true
sleepScore 65
sleepMinutes 330
deepSleepMinutes 49
checkup_reading_count 0
```

Known test payload to identify:

```text
HR 77
steps 1234
```

## Identify suspected test rows

Use the admin/debug views first. These queries are read-only.

### Device events

```sql
select
  event_id,
  received_at,
  event_time,
  event_date_utc,
  device_source,
  app_name,
  app_version,
  event_type,
  heart_rate,
  steps,
  calories,
  has_sleep_data,
  checkup_reading_count,
  payload_fingerprint,
  payload_summary
from public.healthsync_recent_device_events_admin
where heart_rate = 77
  and steps = 1234
order by received_at desc;
```

### Daily metrics

```sql
select
  metric_id,
  matched_source_event_id,
  event_time,
  metric_date,
  heart_rate,
  steps,
  calories,
  has_sleep_data,
  sleep_score,
  sleep_minutes,
  deep_sleep_minutes,
  source,
  created_at,
  payload_fingerprint,
  payload_summary
from public.healthsync_recent_daily_metrics_admin
where heart_rate = 77
  and steps = 1234
order by created_at desc;
```

### Optional base-table confirmation

Run this only after the admin views show a suspected test row.

```sql
select
  id,
  organization_id,
  patient_id,
  event_time,
  created_at,
  event_type,
  payload
from public.healthsync_device_events
where event_type = 'health'
  and payload ->> 'heartRate' = '77'
  and payload ->> 'steps' = '1234'
order by created_at desc;

select
  id,
  organization_id,
  patient_id,
  event_time,
  entry_date,
  heart_rate,
  steps,
  calories,
  has_sleep_data,
  created_at,
  raw_payload
from public.healthsync_daily_metrics
where heart_rate = 77
  and steps = 1234
order by created_at desc;
```

## Cleanup recommendation

Do not run destructive SQL automatically.

Recommended sequence:

1. Confirm the row is the known test payload using both admin view output and
   base-table details.
2. Record the `event_id`, `metric_id`, timestamps, and payload fingerprint.
3. Prefer marking or archiving if a future metadata column exists.
4. Delete only after manual confirmation that the rows are test data and not a
   real watch reading.

The current HealthSync tables do not include an `is_test` or `archived_at`
column. Adding one is a separate schema-change task. Until then, deletion is
the only direct cleanup method, and it should be done manually.

### Manual delete template

Replace the UUIDs with manually confirmed IDs. Keep the transaction open until
the `select` results look correct.

```sql
begin;

-- Replace these placeholders after manual confirmation.
delete from public.healthsync_daily_metrics
where id in (
  '00000000-0000-0000-0000-000000000000'::uuid
)
returning id, event_time, entry_date, heart_rate, steps, created_at;

delete from public.healthsync_device_events
where id in (
  '00000000-0000-0000-0000-000000000000'::uuid
)
returning id, event_time, event_type, payload ->> 'heartRate' as heart_rate,
  payload ->> 'steps' as steps, created_at;

-- If anything looks wrong:
-- rollback;

-- If everything is confirmed:
-- commit;
```

## Rotate `HEALTHSYNC_INGEST_TOKEN`

The raw token must exist only in Google Apps Script Script Properties. Supabase
stores the token hash in `public.healthsync_ingest_tokens.token_hash`.

### 1. Generate a new random token

Use any trusted password/token generator. Example local command:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Do not paste the generated token into GitHub, docs, commits, issues, or chat.

### 2. Add the new token hash in Supabase

Run this in Supabase SQL Editor. Paste the new raw token only into the SQL
Editor, not into this repository.

```sql
begin;

-- Inspect current token rows first.
select
  id,
  name,
  organization_id,
  patient_id,
  active,
  created_at,
  last_used_at
from public.healthsync_ingest_tokens
order by created_at desc;

-- Insert the rotated token while keeping the old token temporarily active.
-- Replace the token string below inside Supabase SQL Editor only.
insert into public.healthsync_ingest_tokens (
  name,
  token_hash,
  organization_id,
  patient_id,
  active
)
select
  'healthsync-watch-rotated-20260606',
  encode(extensions.digest('<PASTE_NEW_TOKEN_HERE>', 'sha256'), 'hex'),
  organization_id,
  patient_id,
  true
from public.healthsync_ingest_tokens
where active = true
order by created_at desc
limit 1
returning id, name, organization_id, patient_id, active, created_at;

commit;
```

If the project has more than one active token row, pick the intended
organization/patient explicitly instead of using `limit 1`.

### 3. Update Google Apps Script Script Properties

In Google Apps Script:

```text
Project Settings -> Script Properties
```

Update:

```text
HEALTHSYNC_INGEST_TOKEN=<new raw token>
```

Leave these properties unchanged unless they are already wrong:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

Redeploy Apps Script only if the deployment requires it for property changes.
In normal Apps Script behavior, Script Properties are read at runtime, so code
redeploy should not be required for a property-only token rotation.

### 4. Validate with the watch

1. On the Amazfit Active 2, open HealthSync.
2. Tap `SYNC NOW`.
3. Wait for the watch result.
4. In Supabase SQL Editor, verify the latest event:

```sql
select
  event_id,
  received_at,
  event_time,
  heart_rate,
  steps,
  calories,
  has_sleep_data,
  checkup_reading_count,
  payload_summary
from public.healthsync_recent_device_events_admin
order by received_at desc
limit 5;
```

5. Verify daily metrics:

```sql
select
  metric_id,
  matched_source_event_id,
  metric_date,
  event_time,
  heart_rate,
  steps,
  calories,
  has_sleep_data,
  sleep_score,
  sleep_minutes,
  deep_sleep_minutes,
  created_at
from public.healthsync_recent_daily_metrics_admin
order by created_at desc
limit 5;
```

6. Confirm `last_used_at` moved to the new token row:

```sql
select
  id,
  name,
  active,
  created_at,
  last_used_at
from public.healthsync_ingest_tokens
order by created_at desc;
```

### 5. Deactivate the old token

Only after the new token is confirmed working, deactivate the old token.

```sql
begin;

-- Replace with the manually confirmed old token row ID.
update public.healthsync_ingest_tokens
set active = false
where id = '00000000-0000-0000-0000-000000000000'::uuid
returning id, name, active, created_at, last_used_at;

commit;
```

## Rollback plan

If `SYNC NOW` fails after token rotation:

1. Do not change HealthSync Core.
2. Do not change `public.healthsync_ingest()`.
3. Restore the previous raw token in Google Apps Script Script Properties if it
   is still available in a secure password manager.
4. Ensure the previous token row is still `active = true` in
   `public.healthsync_ingest_tokens`.
5. Retry `SYNC NOW`.
6. Check Apps Script logs for Supabase ingest errors.
7. Check Supabase latest rows through:

```sql
select *
from public.healthsync_recent_device_events_admin
order by received_at desc
limit 5;
```

If the previous raw token is not available, keep the old row inactive only if a
new token is confirmed working. Otherwise generate another new token and repeat
the rotation procedure.

## Safety reminders

- Do not commit raw tokens, Supabase anon keys, or service role keys.
- Do not touch HealthSync Core for token rotation.
- Do not modify stable watch sync behavior.
- Do not add active SpO2 measurement.
- Do not start SpO2 Lab in this procedure.
- Do not run destructive cleanup SQL without manual confirmation.
