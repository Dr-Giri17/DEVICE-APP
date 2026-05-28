import * as hmUI from "@zos/ui";
import { log as Logger } from "@zos/utils";
import { BasePage } from "@zeppos/zml/base-page";
import { HeartRate, Calorie, Step, Sleep, BloodOxygen } from "@zos/sensor";
import { push } from "@zos/router";

const logger = Logger.getLogger("health-sync");

const W = 466;
const H = 466;

const SYNC_TIMEOUT_MS = 30000;

function readSensor(fn) {
  try { return fn(); } catch (_) { return null; }
}

function isoTimestamp() {
  try { return new Date().toISOString(); } catch (_) { return String(Date.now()); }
}

function formatSteps(n) {
  if (n === null || n === undefined) return "--";
  const s = String(n);
  if (s.length <= 3) return s;
  if (s.length <= 6) return s.slice(0, -3) + "," + s.slice(-3);
  return s.slice(0, -6) + "," + s.slice(-6, -3) + "," + s.slice(-3);
}

Page(
  BasePage({
    state: {
      hrWidget: null,
      stepsWidget: null,
      caloriesWidget: null,
      sleepWidget: null,
      spo2Widget: null,
      statusWidget: null,
      syncing: false,
      syncTimer: null,
    },

    onInit() {
      this.build();
      this.loadData();
    },

    build() {
      hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: W, h: H, color: 0x0d0d0d });

      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0, y: 30, w: W, h: 42,
        text: "Health Sync",
        text_size: 30,
        color: 0xffffff,
        align_h: hmUI.align.CENTER_H,
      });

      this.buildRow(84, "Heart Rate", 0xff5555);
      this.state.hrWidget = this.buildValue(84);
      this.buildDivider(120);

      this.buildRow(128, "Steps", 0x55aaff);
      this.state.stepsWidget = this.buildValue(128);
      this.buildDivider(164);

      this.buildRow(172, "Calories", 0xffaa00);
      this.state.caloriesWidget = this.buildValue(172);
      this.buildDivider(208);

      this.buildRow(216, "Sleep", 0xaa88ff);
      this.state.sleepWidget = this.buildValue(216);
      this.buildDivider(252);

      this.buildRow(260, "SpO2", 0x4ecdc4);
      this.state.spo2Widget = this.buildValue(260);
      this.buildDivider(296);

      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 133, y: 308, w: 200, h: 50,
        text: "SYNC NOW",
        text_size: 22,
        normal_color: 0x1db954,
        press_color: 0x158a3e,
        radius: 25,
        click_func: () => this.syncData(),
      });

      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 133, y: 368, w: 200, h: 36,
        text: "SpO2 Monitor ▶",
        text_size: 18,
        normal_color: 0x1a2a3a,
        press_color: 0x0d1a2a,
        radius: 18,
        click_func: () => push({ url: "page/spo2" }),
      });

      this.state.statusWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0, y: 414, w: W, h: 28,
        text: "Tap to upload to Sheets",
        text_size: 18,
        color: 0x666666,
        align_h: hmUI.align.CENTER_H,
      });
    },

    buildRow(y, label, color) {
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 50, y, w: 200, h: 32,
        text: label, text_size: 22, color,
      });
    },

    buildValue(y) {
      return hmUI.createWidget(hmUI.widget.TEXT, {
        x: 210, y, w: 206, h: 32,
        text: "--", text_size: 22, color: 0xffffff,
        align_h: hmUI.align.RIGHT,
      });
    },

    buildDivider(y) {
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: 50, y, w: 366, h: 1, color: 0x2a2a2a,
      });
    },

    loadData() {
      const hrVal = readSensor(() => new HeartRate().getLast());
      if (hrVal !== null && hrVal > 0) {
        this.state.hrWidget.setProperty(hmUI.prop.TEXT, String(hrVal) + " bpm");
      }

      const stepVal = readSensor(() => new Step().getCurrent());
      if (stepVal !== null) {
        this.state.stepsWidget.setProperty(hmUI.prop.TEXT, formatSteps(stepVal));
      }

      const calVal = readSensor(() => new Calorie().getCurrent());
      if (calVal !== null) {
        this.state.caloriesWidget.setProperty(hmUI.prop.TEXT, String(calVal) + " kcal");
      }

      const sleepInfo = readSensor(() => new Sleep().getInfo());
      if (sleepInfo && sleepInfo.totalTime > 0) {
        const h = Math.floor(sleepInfo.totalTime / 60);
        const m = sleepInfo.totalTime % 60;
        this.state.sleepWidget.setProperty(hmUI.prop.TEXT, String(h) + "h " + String(m) + "m");
      }

      const boResult = readSensor(() => new BloodOxygen().getCurrent());
      if (boResult && boResult.retCode === 2 && boResult.value > 50) {
        this.state.spo2Widget.setProperty(hmUI.prop.TEXT, String(boResult.value) + "%");
      }
    },

    syncData() {
      if (this.state.syncing) return;
      this.state.syncing = true;
      this.state.statusWidget.setProperty(hmUI.prop.TEXT, "Syncing...");

      this.state.syncTimer = setTimeout(() => {
        if (this.state.syncing) {
          this.state.syncing = false;
          this.state.statusWidget.setProperty(hmUI.prop.TEXT, "Timeout — check WiFi");
        }
      }, SYNC_TIMEOUT_MS);

      const hrVal = readSensor(() => new HeartRate().getLast()) || 0;
      const stepVal = readSensor(() => new Step().getCurrent()) || 0;
      const calVal = readSensor(() => new Calorie().getCurrent()) || 0;

      const sleepInfo = readSensor(() => new Sleep().getInfo());
      const sleepScore = sleepInfo ? (sleepInfo.score || 0) : 0;
      const sleepTotal = sleepInfo ? (sleepInfo.totalTime || 0) : 0;
      const sleepDeep = sleepInfo ? (sleepInfo.deepTime || 0) : 0;

      const boResult = readSensor(() => new BloodOxygen().getCurrent());
      const bloodOxygen = (boResult && boResult.retCode === 2 && boResult.value > 50)
        ? boResult.value : null;

      const payload = {
        timestamp: isoTimestamp(),
        heartRate: hrVal > 0 ? hrVal : null,
        steps: stepVal,
        calories: calVal,
        sleepScore,
        sleepMinutes: sleepTotal,
        deepSleepMinutes: sleepDeep,
        bloodOxygen,
      };

      logger.log("syncing payload: " + JSON.stringify(payload));

      this.request(
        { method: "SYNC_HEALTH", params: payload },
        (error, result) => {
          clearTimeout(this.state.syncTimer);
          this.state.syncing = false;
          if (!error && result && result.success) {
            this.state.statusWidget.setProperty(hmUI.prop.TEXT, "Synced OK!");
          } else {
            const msg = (result && result.error) ? String(result.error) : "Sync failed";
            logger.error("sync error: " + JSON.stringify({ error, result }));
            this.state.statusWidget.setProperty(hmUI.prop.TEXT, msg);
          }
        }
      );
    },

    onDestroy() {
      if (this.state.syncTimer) clearTimeout(this.state.syncTimer);
    },
  })
);
