import { BloodOxygen, Battery } from "@zos/sensor";
import { localStorage } from "@zos/storage";

const INTERVAL_MS = 10 * 60 * 1000;
const MEASURE_TIMEOUT_MS = 2 * 60 * 1000;
const SLEEP_START = 22;
const SLEEP_END = 8;

function pad2(n) { return n < 10 ? "0" + n : String(n); }

function dateKey() {
  const d = new Date();
  return "spo2_" + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function isNightHour() {
  const h = new Date().getHours();
  return h >= SLEEP_START || h < SLEEP_END;
}

function isEnabled() {
  return localStorage.getItem("spo2_enabled") !== "false";
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
  if (arr.length > 120) arr = arr.slice(-120);
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
  const bat = getBattery();
  const h = new Date().getHours();
  console.log("[spo2-svc] startMeasurement hour=" + h + " bat=" + bat + "%");
  stopSensor();

  const sensor = new BloodOxygen();
  svcState.sensor = sensor;
  let done = false;

  const cb = () => {
    if (done) return;
    try {
      const result = sensor.getCurrent();
      const rc = result ? result.retCode : -1;
      const val = result ? result.value : 0;
      console.log("[spo2-svc] onChange retCode=" + rc + " value=" + val);
      if (rc === 2 && val > 50) {
        done = true;
        saveReading(val);
        // stop asynchronously — avoids stopping inside the callback
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
      console.log("[spo2-svc] measurement timeout — no valid reading");
      stopSensor();
    }
  }, MEASURE_TIMEOUT_MS);
}

AppService({
  onInit() {
    console.log("[spo2-svc] onInit enabled=" + isEnabled() + " night=" + isNightHour() + " bat=" + getBattery() + "%");
    if (!isEnabled()) {
      console.log("[spo2-svc] monitoring disabled, skipping");
      return;
    }
    if (isNightHour() && hasBattery()) {
      startMeasurement();
    } else {
      console.log("[spo2-svc] not night or low battery, waiting for interval");
    }
    svcState.intervalId = setInterval(function() {
      console.log("[spo2-svc] interval tick night=" + isNightHour() + " enabled=" + isEnabled());
      if (!isEnabled()) return;
      if (isNightHour() && hasBattery()) {
        startMeasurement();
      }
    }, INTERVAL_MS);
  },

  onDestroy() {
    console.log("[spo2-svc] onDestroy");
    if (svcState.intervalId) clearInterval(svcState.intervalId);
    stopSensor();
  },
});
