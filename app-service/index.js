import { BloodOxygen, Battery, HeartRate, Stress } from "@zos/sensor";
import { localStorage } from "@zos/storage";

const INTERVAL_MS     = 5 * 60 * 1000;
const MEASURE_TIMEOUT = 2 * 60 * 1000;
const HRV_INTERVAL_MS = 60 * 60 * 1000;
const HRV_WINDOW_MS   = 60 * 1000; // 60-second HR recording window

// Must match DURATION_OPTIONS in page/spo2.js
const DURATION_MS_OPTIONS = [
  30 * 60 * 1000,
  60 * 60 * 1000,
  2 * 60 * 60 * 1000,
  4 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  8 * 60 * 60 * 1000,
];

function pad2(n) { return n < 10 ? "0" + n : String(n); }

function dateKey() {
  const d = new Date();
  return "spo2_" + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function hrvDateKey() {
  const d = new Date();
  return "hrv_" + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function isEnabled() {
  return localStorage.getItem("spo2_enabled") !== "false";
}

function getDurationMs() {
  const idx = parseInt(localStorage.getItem("spo2_dur_idx") || "3", 10);
  const i = Math.min(Math.max(idx, 0), DURATION_MS_OPTIONS.length - 1);
  return DURATION_MS_OPTIONS[i];
}

function isDurationExpired() {
  const startTime = parseInt(localStorage.getItem("spo2_start_time") || "0", 10);
  if (!startTime) return false;
  return Date.now() - startTime > getDurationMs();
}

function getBattery() {
  try { return new Battery().getCurrent(); } catch (_) { return 100; }
}

function hasBattery() {
  const level = getBattery();
  if (level <= 5) { localStorage.setItem("spo2_lowbat", "1"); return false; }
  localStorage.setItem("spo2_lowbat", "0");
  return true;
}

// ── SpO2 ───────────────────────────────────────────────────────────────────

function saveSpO2Reading(value) {
  if (!value || value <= 50 || value > 100) return;
  const key = dateKey();
  let arr;
  try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { arr = []; }
  arr.push({ v: value, t: Date.now() });
  if (arr.length > 288) arr = arr.slice(-288);
  localStorage.setItem(key, JSON.stringify(arr));
  console.log("[svc] SpO2 " + value + "% count=" + arr.length);
}

const svcState = {
  sensor: null,
  onChangeCb: null,
  measureTimeout: null,
  spo2IntervalId: null,
  hrvIntervalId: null,
};

function stopSensor() {
  if (svcState.measureTimeout) { clearTimeout(svcState.measureTimeout); svcState.measureTimeout = null; }
  if (svcState.sensor) {
    if (svcState.onChangeCb) { try { svcState.sensor.offChange(svcState.onChangeCb); } catch (_) {} svcState.onChangeCb = null; }
    try { svcState.sensor.stop(); } catch (_) {}
    svcState.sensor = null;
  }
}

function startSpO2Measurement() {
  console.log("[svc] SpO2 start bat=" + getBattery() + "%");
  stopSensor();
  const sensor = new BloodOxygen();
  svcState.sensor = sensor;
  let done = false;

  const cb = function() {
    if (done) return;
    try {
      const r = sensor.getCurrent();
      const rc = r ? r.retCode : -1;
      const v  = r ? r.value   : 0;
      console.log("[svc] SpO2 onChange retCode=" + rc + " value=" + v);
      if (rc === 2 && v > 50) {
        done = true;
        saveSpO2Reading(v);
        setTimeout(function() { stopSensor(); }, 0);
      }
    } catch (e) { console.log("[svc] SpO2 cb err: " + String(e)); }
  };

  svcState.onChangeCb = cb;
  sensor.onChange(cb);
  sensor.start();

  svcState.measureTimeout = setTimeout(function() {
    if (!done) { done = true; console.log("[svc] SpO2 timeout"); stopSensor(); }
  }, MEASURE_TIMEOUT);
}

function checkAndMeasureSpO2() {
  if (!isEnabled()) { console.log("[svc] disabled"); return; }
  if (isDurationExpired()) {
    console.log("[svc] duration expired — disabling");
    localStorage.setItem("spo2_enabled", "false");
    stopSensor();
    return;
  }
  if (hasBattery()) startSpO2Measurement();
}

// ── HRV ────────────────────────────────────────────────────────────────────

function saveHrvReading(entry) {
  const key = hrvDateKey();
  let arr;
  try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { arr = []; }
  arr.push(entry);
  if (arr.length > 48) arr = arr.slice(-48); // max 48 hourly readings per day
  localStorage.setItem(key, JSON.stringify(arr));
  console.log("[svc] HRV saved hr=" + entry.h + " stress=" + entry.s + " rmssd=" + entry.r);
}

function measureHrvAndSave() {
  if (!isEnabled() || isDurationExpired() || !hasBattery()) return;
  console.log("[svc] HRV session start (60s window)");

  const sensor = new HeartRate();
  const hrReadings  = [];
  const rrIntervals = [];
  const sessionStart = Date.now();

  const cb = function() {
    try {
      const r = sensor.getCurrent();
      if (!r || r.value < 30) return;
      hrReadings.push(r.value);
      // rrValue: time between successive R-peaks (ms). Valid range 200–2000 ms.
      if (r.rrValue && r.rrValue > 200 && r.rrValue < 2000) {
        rrIntervals.push(r.rrValue);
      }
    } catch (_) {}
  };

  sensor.onChange(cb);
  sensor.start();

  setTimeout(function() {
    try { sensor.offChange(cb); sensor.stop(); } catch (_) {}

    if (hrReadings.length === 0) {
      console.log("[svc] HRV: no HR readings");
      return;
    }

    // Average heart rate
    let hrSum = 0;
    for (let i = 0; i < hrReadings.length; i++) hrSum += hrReadings[i];
    const avgHr = Math.round(hrSum / hrReadings.length);

    // Stress level (HRV proxy — derived from RMSSD internally by Amazfit firmware)
    let stress = 0;
    try { stress = new Stress().getCurrent() || 0; } catch (_) {}

    // RMSSD from RR intervals (if the device exposes rrValue)
    let rmssd = 0;
    if (rrIntervals.length > 1) {
      let sumSqDiff = 0;
      for (let i = 1; i < rrIntervals.length; i++) {
        const d = rrIntervals[i] - rrIntervals[i - 1];
        sumSqDiff += d * d;
      }
      rmssd = Math.round(Math.sqrt(sumSqDiff / (rrIntervals.length - 1)));
    }

    console.log("[svc] HRV done hr=" + avgHr + " stress=" + stress + " rmssd=" + rmssd + " rrCount=" + rrIntervals.length + " hrSamples=" + hrReadings.length);
    saveHrvReading({ t: sessionStart, h: avgHr, s: stress, r: rmssd, n: rrIntervals.length });
  }, HRV_WINDOW_MS);
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

AppService({
  onInit() {
    console.log("[svc] onInit enabled=" + isEnabled() + " bat=" + getBattery() + "%");
    checkAndMeasureSpO2();

    // SpO2 every 5 minutes
    svcState.spo2IntervalId = setInterval(function() {
      console.log("[svc] SpO2 tick");
      checkAndMeasureSpO2();
    }, INTERVAL_MS);

    // HRV every 60 minutes — delayed by 3 min so it doesn't collide with SpO2
    svcState.hrvIntervalId = setInterval(function() {
      console.log("[svc] HRV tick");
      setTimeout(function() { measureHrvAndSave(); }, 3 * 60 * 1000);
    }, HRV_INTERVAL_MS);
  },

  onDestroy() {
    console.log("[svc] onDestroy");
    if (svcState.spo2IntervalId) clearInterval(svcState.spo2IntervalId);
    if (svcState.hrvIntervalId)  clearInterval(svcState.hrvIntervalId);
    stopSensor();
  },
});
