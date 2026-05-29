import { BloodOxygen, Battery } from "@zos/sensor";
import { localStorage } from "@zos/storage";

const INTERVAL_MS = 5 * 60 * 1000;
const MEASURE_TIMEOUT_MS = 2 * 60 * 1000;

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
  if (level <= 5) {
    localStorage.setItem("spo2_lowbat", "1");
    return false;
  }
  localStorage.setItem("spo2_lowbat", "0");
  return true;
}

function saveReading(value) {
  if (!value || value <= 50 || value > 100) return;
  const key = dateKey();
  let arr;
  try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { arr = []; }
  arr.push({ v: value, t: Date.now() });
  if (arr.length > 288) arr = arr.slice(-288); // max 24h at 5-min intervals
  localStorage.setItem(key, JSON.stringify(arr));
  console.log("[spo2-svc] saved " + value + "% count=" + arr.length);
}

const svcState = {
  sensor: null,
  intervalId: null,
  onChangeCb: null,
  measureTimeout: null,
};

function stopSensor() {
  if (svcState.measureTimeout) {
    clearTimeout(svcState.measureTimeout);
    svcState.measureTimeout = null;
  }
  if (svcState.sensor) {
    if (svcState.onChangeCb) {
      try { svcState.sensor.offChange(svcState.onChangeCb); } catch (_) {}
      svcState.onChangeCb = null;
    }
    try { svcState.sensor.stop(); } catch (_) {}
    svcState.sensor = null;
  }
}

function startMeasurement() {
  console.log("[spo2-svc] startMeasurement bat=" + getBattery() + "%");
  stopSensor();

  const sensor = new BloodOxygen();
  svcState.sensor = sensor;
  let done = false;

  const cb = function() {
    if (done) return;
    try {
      const result = sensor.getCurrent();
      const rc = result ? result.retCode : -1;
      const val = result ? result.value : 0;
      console.log("[spo2-svc] onChange retCode=" + rc + " value=" + val);
      if (rc === 2 && val > 50) {
        done = true;
        saveReading(val);
        setTimeout(function() { stopSensor(); }, 0);
      }
    } catch (e) {
      console.log("[spo2-svc] cb error: " + String(e));
    }
  };

  svcState.onChangeCb = cb;
  sensor.onChange(cb);
  sensor.start();
  console.log("[spo2-svc] sensor started");

  svcState.measureTimeout = setTimeout(function() {
    if (!done) {
      done = true;
      console.log("[spo2-svc] measurement timeout");
      stopSensor();
    }
  }, MEASURE_TIMEOUT_MS);
}

function checkAndMeasure() {
  if (!isEnabled()) {
    console.log("[spo2-svc] disabled");
    return;
  }
  if (isDurationExpired()) {
    console.log("[spo2-svc] duration expired — auto-disabling");
    localStorage.setItem("spo2_enabled", "false");
    stopSensor();
    return;
  }
  if (hasBattery()) {
    startMeasurement();
  } else {
    console.log("[spo2-svc] low battery, skipping");
  }
}

AppService({
  onInit() {
    console.log("[spo2-svc] onInit enabled=" + isEnabled() + " bat=" + getBattery() + "%");
    checkAndMeasure();
    svcState.intervalId = setInterval(function() {
      console.log("[spo2-svc] interval tick");
      checkAndMeasure();
    }, INTERVAL_MS);
  },

  onDestroy() {
    console.log("[spo2-svc] onDestroy");
    if (svcState.intervalId) clearInterval(svcState.intervalId);
    stopSensor();
  },
});
