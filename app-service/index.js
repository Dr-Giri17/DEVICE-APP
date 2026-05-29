import { BloodOxygen, Battery, HeartRate, Stress, Step, Calorie } from "@zos/sensor";
import { localStorage } from "@zos/storage";

const SPO2_INTERVAL_MS = 5 * 60 * 1000;    // Night SpO2 every 5 min
const DAY_INTERVAL_MS  = 60 * 60 * 1000;   // Day checkup every 60 min
const MEASURE_TIMEOUT  = 2 * 60 * 1000;    // SpO2 max measurement window
const HRV_WINDOW_MS    = 60 * 1000;        // HRV recording window 60 sec
const HRV_MIN_GAP_MS   = 50 * 60 * 1000;  // At least 50 min between HRV sessions

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

// ── SpO2 night sensor ───────────────────────────────────────────────────────

const svcState = {
  sensor: null,
  onChangeCb: null,
  measureTimeout: null,
  spo2IntervalId: null,
  dayIntervalId: null,
  lastHrvTime: 0,       // shared across day/night to prevent double HRV
};

function stopSensor() {
  if (svcState.measureTimeout) { clearTimeout(svcState.measureTimeout); svcState.measureTimeout = null; }
  if (svcState.sensor) {
    if (svcState.onChangeCb) {
      try { svcState.sensor.offChange(svcState.onChangeCb); } catch (_) {}
      svcState.onChangeCb = null;
    }
    try { svcState.sensor.stop(); } catch (_) {}
    svcState.sensor = null;
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
      console.log("[svc] SpO2 retCode=" + rc + " val=" + v);
      if (rc === 2 && v > 50) {
        done = true;
        saveSpO2(v);
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
    console.log("[svc] night session expired — disabling");
    localStorage.setItem("spo2_enabled", "false");
    stopSensor();
    return;
  }
  if (hasBattery()) startSpO2Measurement();
}

// ── HRV active session (60-second window) ──────────────────────────────────

function runHrvSession(onDone) {
  svcState.lastHrvTime = Date.now();
  console.log("[svc] HRV session start");

  const sensor = new HeartRate();
  const hrs = [];
  const rrs = [];

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

    let avgHr = 0, rmssd = 0;
    if (hrs.length > 0) {
      let s = 0;
      for (let i = 0; i < hrs.length; i++) s += hrs[i];
      avgHr = Math.round(s / hrs.length);
    }
    if (rrs.length > 1) {
      let sq = 0;
      for (let i = 1; i < rrs.length; i++) {
        const d = rrs[i] - rrs[i - 1];
        sq += d * d;
      }
      rmssd = Math.round(Math.sqrt(sq / (rrs.length - 1)));
    }
    console.log("[svc] HRV done hr=" + avgHr + " rmssd=" + rmssd + " rr=" + rrs.length);
    onDone(avgHr, rmssd, rrs.length);
  }, HRV_WINDOW_MS);
}

// ── Hourly day checkup ──────────────────────────────────────────────────────

function saveCheckup(entry) {
  const key = dayKey("checkup_");
  let arr;
  try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { arr = []; }
  arr.push(entry);
  if (arr.length > 48) arr = arr.slice(-48); // max 48 per day
  localStorage.setItem(key, JSON.stringify(arr));
  console.log("[svc] checkup hr=" + entry.hr + " steps=" + entry.steps + " stress=" + entry.stress + " rmssd=" + entry.rmssd);
}

function dayCheckup() {
  console.log("[svc] day checkup");
  const ts = Date.now();

  // Passive reads — no sensor activation needed
  let hr = 0, steps = 0, cal = 0, spo2 = 0, stress = 0;
  try { const v = new HeartRate().getLast();         if (v > 0)  hr    = v; } catch (_) {}
  try { const v = new Step().getCurrent();           if (v >= 0) steps = v; } catch (_) {}
  try { const v = new Calorie().getCurrent();        if (v >= 0) cal   = v; } catch (_) {}
  try {
    const r = new BloodOxygen().getCurrent();
    if (r && r.retCode === 2 && r.value > 50) spo2 = r.value;
  } catch (_) {}
  try { const v = new Stress().getCurrent();         if (v >= 0) stress = v; } catch (_) {}

  const hrvDue = Date.now() - svcState.lastHrvTime >= HRV_MIN_GAP_MS;

  if (hrvDue) {
    // 60-second active HRV session — runs after passive reads
    runHrvSession(function(avgHr, rmssd, rrCount) {
      if (avgHr > 0) hr = avgHr; // prefer fresh active reading
      saveCheckup({ t: ts, hr, steps, cal, spo2, stress, rmssd, rrCount });
    });
  } else {
    saveCheckup({ t: ts, hr, steps, cal, spo2, stress, rmssd: 0, rrCount: 0 });
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

AppService({
  onInit() {
    console.log("[svc] onInit bat=" + getBattery() + "% nightEnabled=" + isNightEnabled());

    // Immediate checkup on service start
    dayCheckup();
    checkNightSpO2();

    // Night SpO2 every 5 min (only measures when night mode is active)
    svcState.spo2IntervalId = setInterval(function() {
      console.log("[svc] SpO2 tick");
      checkNightSpO2();
    }, SPO2_INTERVAL_MS);

    // Day checkup every 60 min — always running, 24/7
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
