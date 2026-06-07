# SpO2 Lab API inventory v0.1

## Status

This inventory is documentation-only. It does not authorize implementation.
It must not be interpreted as approval to call any SpO2 API.

Every BloodOxygen / SPO2 capability listed here is:

```text
FORBIDDEN / NOT AUTHORIZED IN v0.1
```

Do not add SpO2 measurement code. Do not instantiate `BloodOxygen`. Do not use
legacy `hmSensor.id.SPO2`. Do not call system-app navigation APIs for SpO2 Lab.

## Official documentation sources

- Zepp OS `BloodOxygen` sensor documentation:
  https://docs.zepp.com/docs/reference/device-app-api/newAPI/sensor/BloodOxygen/
- Zepp OS legacy `hmSensor.id.SPO2` documentation:
  https://docs.zepp.com/docs/reference/device-app-api/hmSensor/sensorId/SPO2/
- Zepp OS `checkSystemApp` / `SYSTEM_APP_SPO2` documentation:
  https://docs.zepp.com/docs/reference/device-app-api/newAPI/router/checkSystemApp/
- Zepp OS API level description:
  https://docs.zepp.com/docs/intro/version/

## Inventory table

| API / capability | API level | Permission | Reads | Measures | Listens | Stores | Exports | Navigates | Risk category | Current status |
|---|---:|---|---|---|---|---|---|---|---|---|
| `BloodOxygen` sensor class | 2.0 | `data:user.hd.spo2` | yes | possible through methods | possible through methods | no | no | no | high: health sensor access | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| `BloodOxygen.getCurrent()` | 2.0 | `data:user.hd.spo2` | yes, current measured result | no direct start documented | no | no | no | no | high: may touch current measurement state and retCode handling | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| `BloodOxygen.getLastDay()` | 2.0 | `data:user.hd.spo2` | yes, 24-hour average array | no | no | no | no | no | medium: historical health-data read, privacy risk | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| `BloodOxygen.start()` | 2.1 | `data:user.hd.spo2` | no | yes, starts blood oxygen measurement | may produce changes | no | no | no | critical: active optical sensor / battery / stability risk | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| `BloodOxygen.stop()` | 2.1 | `data:user.hd.spo2` | no | cancels measurement | no | no | no | no | medium: sensor lifecycle control; only relevant if unauthorized start exists | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| `BloodOxygen.onChange()` | not separately stated; under `BloodOxygen` docs | `data:user.hd.spo2` | no direct read, callback can be paired with reads | may observe measurement changes | yes | no | no | no | high: listener may encourage polling/measurement loops | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| `BloodOxygen.offChange()` | not separately stated; under `BloodOxygen` docs | `data:user.hd.spo2` | no | no | unregisters listener | no | no | no | medium: lifecycle control; only relevant if unauthorized listener exists | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| `BloodOxygen.getLastFewHour(hour)` | 3.0 | `data:user.hd.spo2` | yes, recent historical records | no | no | no | no | no | medium-high: historical health-data read, privacy and export risk | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| `BloodOxygen` retCode result values | 2.0 | `data:user.hd.spo2` | yes, status/result metadata | no | no | no | no | no | medium: invalid wearing/signal/timeout can be misinterpreted | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| legacy `hmSensor.createSensor(hmSensor.id.SPO2)` | legacy hmSensor docs; versioned v1/v3 pages | not stated in legacy page | yes via instance properties | possible through `start()` | possible through event listener | no | no | no | high: legacy sensor access and active measurement path | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| legacy `spo2.current` | legacy hmSensor docs | not stated | yes | no direct start | no | no | no | no | high: direct health-data read | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| legacy `spo2.time` | legacy hmSensor docs | not stated | yes, measurement time | no | no | no | no | no | medium: health-data timestamp privacy risk | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| legacy `spo2.retcode` | legacy hmSensor docs | not stated | yes, status/result metadata | no | no | no | no | no | medium: status can be misinterpreted | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| legacy `spo2.hourAvgofDay` | legacy hmSensor docs | not stated | yes, hourly average data length 24 | no | no | no | no | no | medium-high: historical health-data read | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| legacy `spo2.start()` | legacy hmSensor docs | not stated | no | yes, starts single point measurement | may produce changes | no | no | no | critical: active optical sensor / battery / stability risk | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| legacy `spo2.stop()` | legacy hmSensor docs | not stated | no | cancels measurement | no | no | no | no | medium: sensor lifecycle control; only relevant if unauthorized start exists | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| legacy `spo2.addEventListener(hmSensor.event.CHANGE, callback)` | legacy hmSensor docs | not stated | no direct read, callback can be paired with reads | may observe measurement changes | yes | no | no | no | high: listener may encourage active loop behavior | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| `SYSTEM_APP_SPO2` constant | 3.0 | not stated | no | no direct measurement by Mini Program | no | no | no | system app support/jump capability | medium-high: could route user into measurement flow outside Lab controls | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| `checkSystemApp(SYSTEM_APP_SPO2)` | 3.0 | not stated | no | no | no | no | no | checks support for jumping to Blood Oxygen system app | medium: system-app capability probing can become navigation implementation | FORBIDDEN / NOT AUTHORIZED IN v0.1 |

## RetCode inventory

Official `BloodOxygen` docs list retCode values for current measured results:

| retCode | Meaning | v0.1 status |
|---:|---|---|
| 0 | measurement invalid | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| 1 | continue measuring | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| 2 | measurement success | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| 3 | measurement failure | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| 4 | not wearing | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| 5 | measurement timeout | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| 6 | invalid wearing | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| 7 | invalid signal | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| 8 | low blood oxygen value | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| 9 | high blood oxygen value | FORBIDDEN / NOT AUTHORIZED IN v0.1 |
| 10 | measurement invalid | FORBIDDEN / NOT AUTHORIZED IN v0.1 |

RetCode documentation is included only to support risk analysis. It does not
authorize reading retCode values or calling SpO2 APIs.

## Capability classification

### Read-only or historical read capabilities

Examples:

- `BloodOxygen.getCurrent()`
- `BloodOxygen.getLastDay()`
- `BloodOxygen.getLastFewHour(hour)`
- legacy `spo2.current`
- legacy `spo2.hourAvgofDay`

Risk:

- May expose health data without clear user intent.
- May be confused with clinical-grade measurement.
- May encourage storage/export paths.
- May depend on system measurement state not controlled by HealthSync.

v0.1 status:

```text
FORBIDDEN / NOT AUTHORIZED IN v0.1
```

### Active measurement capabilities

Examples:

- `BloodOxygen.start()`
- legacy `spo2.start()`

Risk:

- May activate red/IR optical measurement.
- May increase battery usage.
- May stress device stability.
- May reproduce the earlier watch instability failure mode.

v0.1 status:

```text
FORBIDDEN / NOT AUTHORIZED IN v0.1
```

### Listener capabilities

Examples:

- `BloodOxygen.onChange()`
- legacy `spo2.addEventListener(hmSensor.event.CHANGE, callback)`

Risk:

- May encourage polling loops.
- May keep measurement state active.
- May increase UI/app-service complexity.
- May be misused for background monitoring.

v0.1 status:

```text
FORBIDDEN / NOT AUTHORIZED IN v0.1
```

### System app capability

Examples:

- `SYSTEM_APP_SPO2`
- `checkSystemApp(SYSTEM_APP_SPO2)`

Risk:

- May encourage navigation into a system measurement app.
- May blur separation between HealthSync Core and SpO2 Lab.
- May create a user-flow dependency without safety review.

v0.1 status:

```text
FORBIDDEN / NOT AUTHORIZED IN v0.1
```

## Final inventory statement

This inventory is a blocklist and risk map, not an implementation plan.

No listed BloodOxygen, legacy SPO2, or system SPO2 capability may be used in
SpO2 Lab v0.1. Any future use requires a separate approved implementation plan,
an updated safety spec, and explicit review before code is written.
