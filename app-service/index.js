import { BloodOxygen, Battery, HeartRate, Stress, Step, Calorie } from "@zos/sensor";
import { localStorage } from "@zos/storage";

const SPO2_INTERVAL_MS = 5 * 60 * 1000;
const DAY_INTERVAL_MS  = 60 * 60 * 1000;
const MEASURE_TIMEOUT  = 2 * 60 * 1000;
const HRV_WINDOW_MS    = 60 * 1000;
const HRV_MIN_GAP_MS   = 50 * 60 * 1000;

const DURATION_MS_OPTIONS = [
  30 * 60 * 1000, 60 * 60 * 1000,
  2 * 3600 * 1000, 4 * 3600 * 1000,
  6 * 3600 * 1000, 8 * 3600 * 1000,
];

function pad2(n) { return n < 10 ? "0" + n : String(n); }

function dayKey(prefix) {
  const d = new Date();
  return prefix + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

// ── Night-mode helpers ──────────────────────────────────────────────────────

function isNightEnabled() { return localStorage.getItem("spo2_enabled") !== "false"; }

function getNightDurationMs() {
  const idx = parseInt(localStorage.getItem("spo2_dur_idx") || "3", 10);
  return DURATION_MS_OPTIONS[Math.min(Math.max(idx, 0), DURATION_MS_OPTIONS.length - 1)];
}

function isNightExpired() {
  const start = parseInt(localStorage.getItem("spo2_start_time") || "0", 10);
  return start > 0 && Date.now() - start > getNightDurationMs();
}

function getBattery() {
  try { return new Battery().getCurrent(); } catch (_) { return 100; }
}

function hasBattery() {
  const lvl = getBattery();
  localStorage.setItem("spo2_lowbat", lvl <= 5 ? "1" : "0");
  return lvl > 5;
}

// ── Passive sensor instances — created ONCE, reused forever ────────────────
// Each hourly checkup reuses these instead of allocating new objects.
const passive = { hr: null, step: null, cal: null, stress: null, bo: null };

function initPassiveSensors() {
  try { passive.hr     = new HeartRate();   } catch (_) {}
  try { passive.step   = new Step();        } catch (_) {}
  try { passive.cal    = new Calorie();     } catch (_) {}
  try { passive.stress = new Stress();      } catch (_) {}
  try { passive.bo     = new BloodOxygen(); } catch (_) {}
  console.log("[svc] passive sensors ready");
}

function passiveRead() {
  let hr = 0, steps = 0, cal = 0, stress = 0, spo2 = 0;
  try { const v = passive.hr     && passive.hr.getLast();      if (v > 0)  hr     = v; } catch (_) {}
  try { const v = passive.step   && passive.step.getCurrent(); if (v >= 0) steps  = v; } catch (_) {}
  try { const v = passive.cal    && passive.cal.getCurrent();  if (v >= 0) cal    = v; } catch (_) {}
  try { const v = passive.stress && passive.stress.getCurrent();if (v >= 0) stress = v; } catch (_) {}
  try {
    const r = passive.bo && passive.bo.getCurrent();
    if (r && r.value > 50 && r.value <= 100) spo2 = r.value;
  } catch (_) {}
  return { hr, steps, cal, stress, spo2 };
}

// ── Active SpO2 night measurement ───────────────────────────────────────────

const svcState = {
  sensor: null,
  onChangeCb: null,
  measureTimeout: null,
  spo2IntervalId: null,
  dayIntervalId: null,
  lastHrvTime: 0,
  hrvRunning: false,
};

function stopSensor() {
  // Null state BEFORE try-catch so cleanup is always complete
  const timeout = svcState.measureTimeout;
  const sensor  = svcState.sensor;
  const cb      = svcState.onChangeCb;
  svcState.measureTimeout = null;
  svcState.sensor         = null;
  svcState.onChangeCb     = null;

  if (timeout) clearTimeout(timeout);
  if (sensor) {
    if (cb) { try { sensor.offChange(cb); } catch (_) {} }
    try { sensor.stop(); } catch (_) {}
  }
}

function saveSpO2(value) {
  if (value <= 50 || value > 100) return;
  const key = dayKey("spo2_");
  let arr;
  try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { arr = []; }
  arr.push({ v: value, t: Date.now() });
  if (arr.length > 288) arr = arr.slice(-288);
  localStorage.setItem(key, JSON.stringify(arr));
  console.log("[svc] SpO2 " + value + "% #" + arr.length);
}

function startSpO2Measurement() {
  console.log("[svc] SpO2 start");
  stopSensor();

  const sensor = new BloodOxygen();
  svcState.sensor = sensor;
  let done = false;

  const cb = function() {
    if (done) return;
    try {
      const r = sensor.getCurrent();
      if (r && (r.retCode === 2 || r.retCode === 1) && r.value > 50 && r.value <= 100) {
        done = true;
        saveSpO2(r.value);
        setTimeout(function() { stopSensor(); }, 0);
      }
    } catch (e) { console.log("[svc] SpO2 err: " + String(e)); }
  };

  svcState.onChangeCb = cb;
  sensor.onChange(cb);
  sensor.start();

  svcState.measureTimeout = setTimeout(function() {
    if (!done) { done = true; console.log("[svc] SpO2 timeout"); stopSensor(); }
  }, MEASURE_TIMEOUT);
}

function checkNightSpO2() {
  if (!isNightEnabled()) return;
  if (isNightExpired()) {
    console.log("[svc] night expired — disabling");
    localStorage.setItem("spo2_enabled", "false");
    stopSensor();
    return;
  }
  if (!hasBattery()) return;

  // Try passive read first — if the background sensor already has a value, use it
  try {
    const r = passive.bo && passive.bo.getCurrent();
    if (r && r.value > 50 && r.value <= 100) {
      console.log("[svc] SpO2 passive=" + r.value + " rc=" + r.retCode);
      saveSpO2(r.value);
      return;
    }
  } catch (_) {}

  startSpO2Measurement();
}

// ── HRV active session (60-second window) ──────────────────────────────────

function runHrvSession(onDone) {
  if (svcState.hrvRunning) { console.log("[svc] HRV already running, skip"); return; }
  if (svcState.sensor)     { console.log("[svc] SpO2 active, skip HRV");    return; }

  svcState.hrvRunning  = true;
  svcState.lastHrvTime = Date.now();
  console.log("[svc] HRV session start");

  const sensor = new HeartRate();
  const hrs    = [];
  const rrs    = [];

  const cb = function() {
    try {
      const r = sensor.getCurrent();
      if (!r || r.value < 30) return;
      hrs.push(r.value);
      if (r.rrValue && r.rrValue > 200 && r.rrValue < 2000) rrs.push(r.rrValue);
    } catch (_) {}
  };

  sensor.onChange(cb);
  sensor.start();

  setTimeout(function() {
    try { sensor.offChange(cb); sensor.stop(); } catch (_) {}
    svcState.hrvRunning = false;

    let avgHr = 0, rmssd = 0;
    if (hrs.length > 0) {
      let s = 0;
      for (let i = 0; i < hrs.length; i++) s += hrs[i];
      avgHr = Math.round(s / hrs.length);
    }
    if (rrs.length > 1) {
      let sq = 0;
      for (let i = 1; i < rrs.length; i++) { const d = rrs[i] - rrs[i - 1]; sq += d * d; }
      rmssd = Math.round(Math.sqrt(sq / (rrs.length - 1)));
    }
    console.log("[svc] HRV done hr=" + avgHr + " rmssd=" + rmssd + " rr=" + rrs.length);
    onDone(avgHr, rmssd, rrs.length);
  }, HRV_WINDOW_MS);
}

// ── Hourly day checkup (24/7) ───────────────────────────────────────────────

function saveCheckup(entry) {
  const key = dayKey("checkup_");
  let arr;
  try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { arr = []; }
  arr.push(entry);
  if (arr.length > 48) arr = arr.slice(-48);
  localStorage.setItem(key, JSON.stringify(arr));
  console.log("[svc] checkup hr=" + entry.hr + " steps=" + entry.steps +
    " stress=" + entry.stress + " rmssd=" + entry.rmssd);
}

function dayCheckup() {
  console.log("[svc] day checkup");
  const ts  = Date.now();
  const now = ts;

  // Passive reads — reuse cached sensor instances, zero new allocations
  const reads = passiveRead();

  const hrvDue = !svcState.hrvRunning &&
                 !svcState.sensor &&
                 (now - svcState.lastHrvTime >= HRV_MIN_GAP_MS);

  if (hrvDue) {
    runHrvSession(function(avgHr, rmssd, rrCount) {
      const hr = avgHr > 0 ? avgHr : reads.hr;
      saveCheckup({ t: ts, hr, steps: reads.steps, cal: reads.cal,
                    spo2: reads.spo2, stress: reads.stress, rmssd, rrCount });
    });
  } else {
    saveCheckup({ t: ts, hr: reads.hr, steps: reads.steps, cal: reads.cal,
                  spo2: reads.spo2, stress: reads.stress, rmssd: 0, rrCount: 0 });
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

AppService({
  onInit() {
    console.log("[svc] onInit bat=" + getBattery() + "% night=" + isNightEnabled());

    // Create passive sensors ONCE — reused for all subsequent checkups
    initPassiveSensors();

    // Initial checkup and night-mode check
    dayCheckup();
    checkNightSpO2();

    // Night SpO2 every 5 min (only runs measurement when night mode is active)
    svcState.spo2IntervalId = setInterval(function() {
      checkNightSpO2();
    }, SPO2_INTERVAL_MS);

    // Day checkup every 60 min — always on, 24/7
    svcState.dayIntervalId = setInterval(function() {
      dayCheckup();
    }, DAY_INTERVAL_MS);
  },

  onDestroy() {
    console.log("[svc] onDestroy");
    if (svcState.spo2IntervalId) clearInterval(svcState.spo2IntervalId);
    if (svcState.dayIntervalId)  clearInterval(svcState.dayIntervalId);
    stopSensor();
  },
});
