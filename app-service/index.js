import { BloodOxygen, Battery } from "@zos/sensor";
import { localStorage } from "@zos/storage";

const INTERVAL_MS = 10 * 60 * 1000;
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
}

const svcState = {
  sensor: null,
  intervalId: null,
  onChangeCb: null,
};

function startMeasurement() {
  if (svcState.sensor) {
    if (svcState.onChangeCb) {
      try { svcState.sensor.offChange(svcState.onChangeCb); } catch (_) {}
    }
    try { svcState.sensor.stop(); } catch (_) {}
  }

  const sensor = new BloodOxygen();
  svcState.sensor = sensor;

  const cb = () => {
    try {
      const result = sensor.getCurrent();
      if (result && result.retCode === 2 && result.value > 0) {
        saveReading(result.value);
        sensor.stop();
      }
    } catch (_) {}
  };
  svcState.onChangeCb = cb;
  sensor.onChange(cb);
  sensor.start();
}

AppService({
  onInit() {
    if (!isEnabled()) return;
    if (isNightHour() && hasBattery()) {
      startMeasurement();
    }
    svcState.intervalId = setInterval(() => {
      if (!isEnabled()) return;
      if (isNightHour() && hasBattery()) {
        startMeasurement();
      }
    }, INTERVAL_MS);
  },

  onDestroy() {
    if (svcState.intervalId) clearInterval(svcState.intervalId);
    if (svcState.sensor) {
      if (svcState.onChangeCb) {
        try { svcState.sensor.offChange(svcState.onChangeCb); } catch (_) {}
      }
      try { svcState.sensor.stop(); } catch (_) {}
    }
  },
});
