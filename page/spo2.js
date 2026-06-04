import * as hmUI from "@zos/ui";
import { BasePage } from "@zeppos/zml/base-page";
import { BloodOxygen, Battery } from "@zos/sensor";
import { localStorage } from "@zos/storage";

const W = 466;
const H = 466;
const LOG = "[spo2-profiler] ";
const SYNC_TIMEOUT_MS = 30000;
const PRE_START_DELAY_MS = 1000;
const POLL_INTERVAL_MS = 3000;
const ADAPTIVE_COOLDOWN_STEP_SEC = 180;

const STATES = {
  IDLE: "IDLE",
  PRE_STOP: "PRE_STOP",
  WAIT_BEFORE_START: "WAIT_BEFORE_START",
  MEASURING: "MEASURING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  COOLDOWN: "COOLDOWN",
  FINISHED: "FINISHED",
};

const RET_STATUS = {
  0: "invalid",
  1: "measuring",
  2: "success",
  3: "failure",
  4: "not_wearing",
  5: "timeout",
  6: "invalid_wearing",
  7: "invalid_signal",
  8: "low_blood_oxygen",
  9: "high_blood_oxygen",
  10: "invalid",
};

const FAIL_CODES = { 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true, 10: true };

const PROTOCOLS = [
  { id: "A", label: "A 2m", maxMs: 90 * 1000, cooldownSec: 2 * 60, cycles: 5, adaptive: false },
  { id: "B", label: "B 5m", maxMs: 90 * 1000, cooldownSec: 5 * 60, cycles: 5, adaptive: false },
  { id: "C", label: "C 10m", maxMs: 90 * 1000, cooldownSec: 10 * 60, cycles: 5, adaptive: false },
  { id: "D", label: "D 15m", maxMs: 90 * 1000, cooldownSec: 15 * 60, cycles: 5, adaptive: false },
  { id: "ADAPT", label: "ADAPT", maxMs: 90 * 1000, cooldownSec: 2 * 60, cycles: 5, adaptive: true },
];

const KEY_PROTOCOL_INDEX = "spo2_profiler_protocol_index";
const KEY_RESULTS = "spo2_protocol_results";
const KEY_SUMMARIES = "spo2_protocol_summaries";
const KEY_HISTORICAL = "spo2_historical_results";
const KEY_RUNNING = "spo2_protocol_running";
const KEY_SESSION = "spo2_protocol_session";

function isoTimestamp(ts) {
  try { return new Date(ts || Date.now()).toISOString(); } catch (_) { return String(ts || Date.now()); }
}

function safeParse(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.log(LOG + "storage write failed " + key + " " + String(e)); }
}

function appendJson(key, entry, maxRows) {
  let rows = safeParse(key, []);
  if (!rows || !rows.length) rows = [];
  rows.push(entry);
  if (maxRows && rows.length > maxRows) rows = rows.slice(rows.length - maxRows);
  writeJson(key, rows);
  return rows;
}

function getRetStatus(code) {
  return RET_STATUS.hasOwnProperty(code) ? RET_STATUS[code] : "unknown";
}

function getBatteryLevel() {
  try { return new Battery().getCurrent(); } catch (_) { return null; }
}

function getProtocolIndex() {
  const idx = parseInt(localStorage.getItem(KEY_PROTOCOL_INDEX) || "0", 10);
  return Math.min(Math.max(idx, 0), PROTOCOLS.length - 1);
}

function getProtocol() {
  return PROTOCOLS[getProtocolIndex()];
}

function isValidSpo2(value) {
  return value > 50 && value <= 100;
}

function average(values) {
  if (!values || values.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return Math.round(sum / values.length);
}

function calculateSummary(protocolId, cycleRows, unsafe, unsafeReason) {
  const rows = cycleRows || [];
  const values = [];
  const durations = [];
  let success = 0;
  let timeout = 0;
  let invalidSignal = 0;
  let notWearing = 0;
  let invalidWearing = 0;
  let maxCooldown = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.success) {
      success++;
      if (isValidSpo2(r.spo2_value)) values.push(r.spo2_value);
    }
    if (r.failure_reason === "timeout" || r.ret_code === 5) timeout++;
    if (r.ret_code === 7 || r.failure_reason === "invalid_signal") invalidSignal++;
    if (r.ret_code === 4) notWearing++;
    if (r.ret_code === 6) invalidWearing++;
    if (r.duration_sec != null) durations.push(r.duration_sec);
    if (r.cooldown_sec > maxCooldown) maxCooldown = r.cooldown_sec;
  }

  let score = 100;
  score -= timeout * 25;
  score -= invalidSignal * 20;
  score -= notWearing * 15;
  score -= invalidWearing * 15;
  score -= (rows.length - success - timeout - invalidSignal - notWearing - invalidWearing) * 10;
  if (unsafe) score = Math.min(score, 20);
  if (score < 0) score = 0;

  let protocol = getProtocol();
  for (let p = 0; p < PROTOCOLS.length; p++) {
    if (PROTOCOLS[p].id === protocolId) {
      protocol = PROTOCOLS[p];
      break;
    }
  }
  const recommended = rows.length === success ? protocol.cooldownSec : Math.max(protocol.cooldownSec, maxCooldown);

  return {
    protocol_id: protocolId,
    total_cycles: rows.length,
    successful_cycles: success,
    success_rate: rows.length > 0 ? Math.round((success * 100) / rows.length) : 0,
    timeout_count: timeout,
    invalid_signal_count: invalidSignal,
    not_wearing_count: notWearing,
    invalid_wearing_count: invalidWearing,
    average_duration_sec: average(durations),
    min_spo2: values.length ? Math.min.apply(null, values) : null,
    avg_spo2: average(values),
    max_spo2: values.length ? Math.max.apply(null, values) : null,
    recommended_min_cooldown_sec: recommended,
    reliability_score: score,
    confidence: "experimental",
    clinical_use: "not_validated",
    unsafe: !!unsafe,
    unsafe_reason: unsafeReason || "",
    generated_at: isoTimestamp(),
  };
}

Page(
  BasePage({
    state: {
      widgets: {},
      sensor: null,
      onChangeCb: null,
      timers: [],
      pollTimer: null,
      measureTimeout: null,
      syncTimer: null,
      syncing: false,
      running: false,
      stopping: false,
      unsafe: false,
      unsafeReason: "",
      stateName: STATES.IDLE,
      protocol: getProtocol(),
      sessionId: null,
      cycleIndex: 0,
      cycleStartedAt: 0,
      currentRetCode: 0,
      currentRetStatus: "invalid",
      lastValidSpo2: null,
      cooldownSec: getProtocol().cooldownSec,
      consecutiveFailures: 0,
      batchRows: [],
      lastSummary: null,
    },

    onInit() {
      this.build();
      this.detectIncompleteProtocol();
      this.refreshSummary();
      this.updateUi();
      this.tryHistoricalRead();
    },

    build() {
      hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: W, h: H, color: 0x0d0d0d });
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0, y: 12, w: W, h: 34,
        text: "SpO2 Profiler",
        text_size: 26,
        color: 0xffffff,
        align_h: hmUI.align.CENTER_H,
      });

      this.buildLabelValue(52, "State", "state");
      this.buildLabelValue(84, "Protocol", "protocol");
      this.buildLabelValue(116, "Cycle", "cycle");
      this.buildLabelValue(148, "RetCode", "ret");
      this.buildLabelValue(180, "Last SpO2", "spo2");
      this.buildLabelValue(212, "Success", "success");

      hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 38, y: 246, w: 390, h: 1, color: 0x2a2a2a });

      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 44, y: 260, w: 90, h: 42,
        text: "<",
        text_size: 24,
        normal_color: 0x252525,
        press_color: 0x444444,
        radius: 18,
        click_func: () => this.changeProtocol(-1),
      });
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 146, y: 260, w: 176, h: 42,
        text: "Start Protocol",
        text_size: 17,
        normal_color: 0x1a3a1a,
        press_color: 0x0d220d,
        radius: 18,
        click_func: () => this.startProtocol(),
      });
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 334, y: 260, w: 90, h: 42,
        text: ">",
        text_size: 24,
        normal_color: 0x252525,
        press_color: 0x444444,
        radius: 18,
        click_func: () => this.changeProtocol(1),
      });

      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 44, y: 312, w: 176, h: 42,
        text: "Stop Protocol",
        text_size: 17,
        normal_color: 0x3a1a1a,
        press_color: 0x220d0d,
        radius: 18,
        click_func: () => this.stopProtocol("user_stop"),
      });
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 232, y: 312, w: 190, h: 42,
        text: "Sync Protocol",
        text_size: 17,
        normal_color: 0x1a2f3a,
        press_color: 0x0d1c22,
        radius: 18,
        click_func: () => this.syncProtocol(),
      });
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 83, y: 364, w: 300, h: 40,
        text: "Clear Protocol Data",
        text_size: 17,
        normal_color: 0x302525,
        press_color: 0x221818,
        radius: 18,
        click_func: () => this.clearProtocolData(),
      });

      this.state.widgets.status = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 20, y: 416, w: 426, h: 42,
        text: "",
        text_size: 16,
        color: 0x777777,
        align_h: hmUI.align.CENTER_H,
      });
    },

    buildLabelValue(y, label, key) {
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 44, y, w: 160, h: 26,
        text: label,
        text_size: 19,
        color: 0x888888,
      });
      this.state.widgets[key] = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 202, y, w: 224, h: 26,
        text: "--",
        text_size: 19,
        color: 0xffffff,
        align_h: hmUI.align.RIGHT,
      });
    },

    setStatus(text) {
      if (this.state.widgets.status) this.state.widgets.status.setProperty(hmUI.prop.TEXT, text || "");
    },

    setStateName(next) {
      if (this.state.stateName !== next) console.log(LOG + "state " + this.state.stateName + " -> " + next);
      this.state.stateName = next;
      this.updateUi();
    },

    updateUi() {
      const w = this.state.widgets;
      const p = this.state.protocol;
      if (!w.state) return;
      w.state.setProperty(hmUI.prop.TEXT, this.state.stateName);
      w.protocol.setProperty(hmUI.prop.TEXT, p.label);
      const shownCycle = this.state.running || this.state.batchRows.length
        ? Math.min(this.state.cycleIndex + 1, p.cycles) : 0;
      w.cycle.setProperty(hmUI.prop.TEXT, "Cycle " + String(shownCycle) + "/" + String(p.cycles));
      w.ret.setProperty(hmUI.prop.TEXT, String(this.state.currentRetCode) + " " + this.state.currentRetStatus);
      w.spo2.setProperty(hmUI.prop.TEXT, this.state.lastValidSpo2 ? String(this.state.lastValidSpo2) + "%" : "--");
      const summary = this.state.lastSummary || calculateSummary(p.id, this.state.batchRows, this.state.unsafe, this.state.unsafeReason);
      w.success.setProperty(hmUI.prop.TEXT, String(summary.success_rate || 0) + "%");
    },

    changeProtocol(delta) {
      if (this.state.running) {
        this.setStatus("Stop protocol before changing selection");
        return;
      }
      const next = (getProtocolIndex() + delta + PROTOCOLS.length) % PROTOCOLS.length;
      localStorage.setItem(KEY_PROTOCOL_INDEX, String(next));
      this.state.protocol = PROTOCOLS[next];
      this.state.cooldownSec = this.state.protocol.cooldownSec;
      this.state.lastSummary = null;
      this.setStatus("Selected protocol " + this.state.protocol.label);
      this.updateUi();
    },

    detectIncompleteProtocol() {
      if (localStorage.getItem(KEY_RUNNING) !== "true") return;
      const session = safeParse(KEY_SESSION, null);
      const protocolId = session && session.protocol_id ? session.protocol_id : getProtocol().id;
      const rows = session && session.rows ? session.rows : [];
      const summary = calculateSummary(protocolId, rows, true, "suspected_watch_freeze_or_restart");
      appendJson(KEY_SUMMARIES, summary, 20);
      localStorage.setItem(KEY_RUNNING, "false");
      localStorage.removeItem(KEY_SESSION);
      this.state.lastSummary = summary;
      this.setStatus("Previous protocol incomplete");
      console.log(LOG + "previous protocol incomplete, marked unsafe");
    },

    refreshSummary() {
      const summaries = safeParse(KEY_SUMMARIES, []);
      this.state.lastSummary = summaries.length ? summaries[summaries.length - 1] : null;
    },

    startProtocol() {
      if (this.state.running) {
        this.setStatus("Protocol already running");
        return;
      }
      this.clearTimers();
      this.cleanupSensor();

      const p = getProtocol();
      this.state.protocol = p;
      this.state.running = true;
      this.state.stopping = false;
      this.state.unsafe = false;
      this.state.unsafeReason = "";
      this.state.sessionId = "spo2-" + String(Date.now());
      this.state.cycleIndex = 0;
      this.state.currentRetCode = 0;
      this.state.currentRetStatus = "invalid";
      this.state.lastValidSpo2 = null;
      this.state.cooldownSec = p.cooldownSec;
      this.state.consecutiveFailures = 0;
      this.state.batchRows = [];
      this.state.lastSummary = null;
      localStorage.setItem(KEY_RUNNING, "true");
      this.persistSession();
      console.log(LOG + "start protocol " + p.id + " cooldown=" + p.cooldownSec);
      this.setStatus("Protocol started");
      this.runCycle();
    },

    stopProtocol(reason) {
      if (!this.state.running && this.state.stateName !== STATES.MEASURING) {
        this.cleanupSensor();
        this.clearTimers();
        localStorage.setItem(KEY_RUNNING, "false");
        this.setStateName(STATES.IDLE);
        this.setStatus("Protocol stopped");
        return;
      }
      this.state.stopping = true;
      this.state.unsafe = reason !== "user_stop";
      this.state.unsafeReason = reason || "stopped";
      console.log(LOG + "stop protocol reason=" + this.state.unsafeReason);
      this.finishProtocol(this.state.unsafe, this.state.unsafeReason);
    },

    runCycle() {
      if (!this.state.running || this.state.stopping) return;
      const p = this.state.protocol;
      if (this.state.cycleIndex >= p.cycles) {
        this.finishProtocol(false, "");
        return;
      }

      this.state.currentRetCode = 0;
      this.state.currentRetStatus = "invalid";
      this.state.cycleStartedAt = Date.now();
      this.setStateName(STATES.PRE_STOP);
      this.setStatus("Preparing cycle " + String(this.state.cycleIndex + 1));
      console.log(LOG + "cycle " + String(this.state.cycleIndex + 1) + " pre-stop");
      this.cleanupSensor();
      this.setStateName(STATES.WAIT_BEFORE_START);
      this.addTimer(setTimeout(() => this.beginMeasurement(), PRE_START_DELAY_MS));
    },

    beginMeasurement() {
      if (!this.state.running || this.state.stopping) return;
      this.setStateName(STATES.MEASURING);
      this.setStatus("Measuring");
      let sensor;
      try {
        sensor = this.state.sensor || new BloodOxygen();
        this.state.sensor = sensor;
        try { sensor.stop(); } catch (_) {}
        console.log(LOG + "sensor.start cycle=" + String(this.state.cycleIndex + 1));
        sensor.start();
        const cb = () => this.handleSensorRead("change");
        this.state.onChangeCb = cb;
        try { sensor.onChange(cb); } catch (e) { console.log(LOG + "onChange error " + String(e)); }
        this.handleSensorRead("start");
      } catch (e) {
        console.log(LOG + "start failed " + String(e));
        this.completeCycle(false, 3, null, "start_error");
        return;
      }

      this.state.pollTimer = setInterval(() => this.handleSensorRead("poll"), POLL_INTERVAL_MS);
      this.state.measureTimeout = setTimeout(() => {
        console.log(LOG + "timeout cycle=" + String(this.state.cycleIndex + 1));
        this.completeCycle(false, 5, null, "timeout");
      }, this.state.protocol.maxMs);
    },

    handleSensorRead(source) {
      if (!this.state.running || this.state.stateName !== STATES.MEASURING) return;
      let result = null;
      try { result = this.state.sensor && this.state.sensor.getCurrent(); } catch (e) {
        console.log(LOG + "getCurrent error " + String(e));
      }
      if (!result) return;

      const retCode = Number(result.retCode);
      const value = Number(result.value);
      const duration = Math.round((Date.now() - this.state.cycleStartedAt) / 1000);
      this.state.currentRetCode = isNaN(retCode) ? 0 : retCode;
      this.state.currentRetStatus = getRetStatus(this.state.currentRetCode);
      console.log(LOG + "read " + source +
        " ts=" + isoTimestamp() +
        " cycle=" + String(this.state.cycleIndex + 1) +
        " value=" + String(value) +
        " retCode=" + String(this.state.currentRetCode) +
        " state=" + this.state.stateName +
        " duration=" + String(duration));

      if (this.state.currentRetCode === 2 && isValidSpo2(value)) {
        this.state.lastValidSpo2 = value;
        this.updateUi();
        this.completeCycle(true, 2, value, "");
        return;
      }

      if (this.state.currentRetCode === 1) {
        this.updateUi();
        return;
      }

      if (FAIL_CODES[this.state.currentRetCode]) {
        this.completeCycle(false, this.state.currentRetCode, isValidSpo2(value) ? value : null, getRetStatus(this.state.currentRetCode));
      }
    },

    completeCycle(success, retCode, value, failureReason) {
      if (!this.state.running) return;
      const endedAt = Date.now();
      const row = {
        protocol_id: this.state.protocol.id,
        cycle_index: this.state.cycleIndex + 1,
        state: success ? STATES.SUCCESS : STATES.FAILED,
        started_at: isoTimestamp(this.state.cycleStartedAt),
        ended_at: isoTimestamp(endedAt),
        duration_sec: Math.round((endedAt - this.state.cycleStartedAt) / 1000),
        spo2_value: value,
        spo2_time: value ? isoTimestamp(endedAt) : "",
        ret_code: retCode,
        ret_status: getRetStatus(retCode),
        success: !!success,
        failure_reason: failureReason || "",
        cooldown_sec: this.state.cooldownSec,
        battery_level: getBatteryLevel(),
        source: "active_measurement",
        confidence: "experimental",
        clinical_use: "not_validated",
        notes: this.state.protocol.adaptive ? "adaptive" : "",
      };

      this.cleanupSensor();
      this.state.currentRetCode = retCode;
      this.state.currentRetStatus = getRetStatus(retCode);
      this.state.batchRows.push(row);
      appendJson(KEY_RESULTS, row, 80);
      this.persistSession();
      console.log(LOG + (success ? "success " : "failure ") + JSON.stringify(row));

      if (success) {
        this.state.consecutiveFailures = 0;
        this.setStateName(STATES.SUCCESS);
        this.setStatus("Cycle success");
      } else {
        this.state.consecutiveFailures++;
        this.setStateName(STATES.FAILED);
        this.setStatus("Cycle failed: " + row.ret_status);
        if (this.state.protocol.adaptive &&
            (failureReason === "timeout" || retCode === 5 || retCode === 7)) {
          this.state.cooldownSec += ADAPTIVE_COOLDOWN_STEP_SEC;
          console.log(LOG + "adaptive cooldown increased to " + this.state.cooldownSec);
        }
      }

      if (this.state.protocol.adaptive && this.state.consecutiveFailures >= 2) {
        this.state.unsafe = true;
        this.state.unsafeReason = "repeated_failures";
        this.finishProtocol(true, "repeated_failures");
        return;
      }

      this.state.cycleIndex++;
      this.updateUi();
      if (this.state.cycleIndex >= this.state.protocol.cycles) {
        this.finishProtocol(false, "");
        return;
      }

      this.setStateName(STATES.COOLDOWN);
      this.setStatus("Cooldown " + String(Math.round(this.state.cooldownSec / 60)) + "m");
      this.addTimer(setTimeout(() => this.runCycle(), this.state.cooldownSec * 1000));
    },

    finishProtocol(unsafe, reason) {
      this.cleanupSensor();
      this.clearTimers();
      const summary = calculateSummary(this.state.protocol.id, this.state.batchRows, unsafe, reason);
      appendJson(KEY_SUMMARIES, summary, 20);
      localStorage.setItem(KEY_RUNNING, "false");
      localStorage.removeItem(KEY_SESSION);
      this.state.running = false;
      this.state.stopping = false;
      this.state.lastSummary = summary;
      this.setStateName(STATES.FINISHED);
      this.setStatus(unsafe ? "Finished - unsafe: " + reason : "Protocol finished");
      console.log(LOG + "summary " + JSON.stringify(summary));
    },

    persistSession() {
      writeJson(KEY_SESSION, {
        id: this.state.sessionId,
        protocol_id: this.state.protocol.id,
        state: this.state.stateName,
        cycle_index: this.state.cycleIndex,
        started_at: this.state.batchRows.length ? this.state.batchRows[0].started_at : isoTimestamp(this.state.cycleStartedAt || Date.now()),
        rows: this.state.batchRows,
      });
    },

    addTimer(timerId) {
      this.state.timers.push(timerId);
      return timerId;
    },

    clearTimers() {
      for (let i = 0; i < this.state.timers.length; i++) {
        try { clearTimeout(this.state.timers[i]); } catch (_) {}
      }
      this.state.timers = [];
      if (this.state.pollTimer) {
        try { clearInterval(this.state.pollTimer); } catch (_) {}
        this.state.pollTimer = null;
      }
      if (this.state.measureTimeout) {
        try { clearTimeout(this.state.measureTimeout); } catch (_) {}
        this.state.measureTimeout = null;
      }
    },

    cleanupSensor() {
      const sensor = this.state.sensor;
      const cb = this.state.onChangeCb;
      this.state.sensor = null;
      this.state.onChangeCb = null;
      if (this.state.pollTimer) {
        try { clearInterval(this.state.pollTimer); } catch (_) {}
        this.state.pollTimer = null;
      }
      if (this.state.measureTimeout) {
        try { clearTimeout(this.state.measureTimeout); } catch (_) {}
        this.state.measureTimeout = null;
      }
      if (sensor) {
        if (cb) {
          try { sensor.offChange(cb); } catch (_) {}
          try { sensor.removeEventListener && sensor.removeEventListener("change", cb); } catch (_) {}
        }
        try { console.log(LOG + "sensor.stop"); sensor.stop(); } catch (_) {}
      }
    },

    tryHistoricalRead() {
      const existing = safeParse(KEY_HISTORICAL, []);
      if (existing && existing.length > 0) return;
      let supported = false;
      let errorMsg = "";
      const rows = [];
      try {
        const bloodOxygen = new BloodOxygen();
        const tests = [
          { name: "getLastFewHour_1", fn: function() { return bloodOxygen.getLastFewHour(1); } },
          { name: "getLastFewHour_6", fn: function() { return bloodOxygen.getLastFewHour(6); } },
          { name: "getLastDay", fn: function() { return bloodOxygen.getLastDay(); } },
        ];
        for (let i = 0; i < tests.length; i++) {
          try {
            const value = tests[i].fn();
            supported = true;
            rows.push({
              protocol_id: "historical",
              cycle_index: 0,
              state: "HISTORICAL_READ",
              started_at: isoTimestamp(),
              ended_at: isoTimestamp(),
              duration_sec: 0,
              spo2_value: null,
              spo2_time: "",
              ret_code: null,
              ret_status: "",
              success: true,
              failure_reason: "",
              cooldown_sec: 0,
              battery_level: getBatteryLevel(),
              source: "historical_read",
              confidence: "experimental",
              clinical_use: "not_validated",
              historical_read_supported: true,
              method: tests[i].name,
              raw: JSON.stringify(value),
              notes: "",
            });
          } catch (e) {
            errorMsg = String(e);
            rows.push({
              protocol_id: "historical",
              cycle_index: 0,
              state: "HISTORICAL_READ_FAILED",
              started_at: isoTimestamp(),
              ended_at: isoTimestamp(),
              duration_sec: 0,
              spo2_value: null,
              spo2_time: "",
              ret_code: null,
              ret_status: "",
              success: false,
              failure_reason: "api_unavailable",
              cooldown_sec: 0,
              battery_level: getBatteryLevel(),
              source: "historical_read",
              confidence: "experimental",
              clinical_use: "not_validated",
              historical_read_supported: false,
              method: tests[i].name,
              raw: "",
              notes: errorMsg,
            });
          }
        }
      } catch (e) {
        errorMsg = String(e);
      }
      for (let j = 0; j < rows.length; j++) appendJson(KEY_HISTORICAL, rows[j], 30);
      console.log(LOG + "historical_read_supported=" + String(supported) + " error=" + errorMsg);
    },

    syncProtocol() {
      if (this.state.syncing) return;
      const cycles = safeParse(KEY_RESULTS, []);
      const summaries = safeParse(KEY_SUMMARIES, []);
      const historical = safeParse(KEY_HISTORICAL, []);
      if ((!cycles || cycles.length === 0) && (!summaries || summaries.length === 0) && (!historical || historical.length === 0)) {
        this.setStatus("No protocol data to sync");
        return;
      }

      this.state.syncing = true;
      this.setStatus("Syncing protocol...");
      this.state.syncTimer = setTimeout(() => {
        if (this.state.syncing) {
          this.state.syncing = false;
          this.setStatus("Protocol saved locally - sync timeout");
        }
      }, SYNC_TIMEOUT_MS);

      const payload = {
        type: "spo2_protocol",
        timestamp: isoTimestamp(),
        cycles: cycles,
        summary: summaries.length ? summaries[summaries.length - 1] : null,
        summaries: summaries,
        historical: historical,
        confidence: "experimental",
        clinical_use: "not_validated",
      };

      this.request({ method: "SYNC_SPO2_PROTOCOL", params: payload }, (error, result) => {
        if (this.state.syncTimer) clearTimeout(this.state.syncTimer);
        this.state.syncing = false;
        if (!error && result && result.success) {
          this.setStatus("Protocol synced OK");
          console.log(LOG + "export success");
        } else {
          const msg = result && result.error ? String(result.error) : "sync method missing";
          this.setStatus("Protocol saved locally - " + msg);
          console.log(LOG + "export failed " + JSON.stringify({ error, result }));
        }
      });
    },

    clearProtocolData() {
      if (this.state.running) {
        this.setStatus("Stop protocol before clearing");
        return;
      }
      localStorage.removeItem(KEY_RESULTS);
      localStorage.removeItem(KEY_SUMMARIES);
      localStorage.removeItem(KEY_HISTORICAL);
      localStorage.removeItem(KEY_SESSION);
      localStorage.setItem(KEY_RUNNING, "false");
      this.state.batchRows = [];
      this.state.lastSummary = null;
      this.state.lastValidSpo2 = null;
      this.setStateName(STATES.IDLE);
      this.setStatus("Protocol data cleared");
      this.updateUi();
    },

    onDestroy() {
      console.log(LOG + "onDestroy");
      this.cleanupSensor();
      this.clearTimers();
      if (this.state.running) {
        localStorage.setItem(KEY_RUNNING, "false");
        this.state.running = false;
      }
      if (this.state.syncTimer) clearTimeout(this.state.syncTimer);
    },
  })
);
