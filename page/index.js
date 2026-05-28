import * as hmUI from "@zos/ui";
import { log as Logger } from "@zos/utils";
import { BasePage } from "@zeppos/zml/base-page";
import { HeartRate, Calorie, Step, Sleep } from "@zos/sensor";

const logger = Logger.getLogger("health-sync");

const W = 466;
const H = 466;

const SYNC_TIMEOUT_MS = 30000;

function readSensor(fn) {
  try {
    return fn();
  } catch (_) {
    return null;
  }
}

function isoTimestamp() {
  try {
    return new Date().toISOString();
  } catch (_) {
    return String(Date.now());
  }
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
      statusWidget: null,
      syncing: false,
      syncTimer: null,
    },

    onInit() {
      this.build();
      this.loadData();
    },

    build() {
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: W,
        h: H,
        color: 0x0d0d0d,
      });

      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0,
        y: 38,
        w: W,
        h: 48,
        text: "Health Sync",
        text_size: 34,
        color: 0xffffff,
        align_h: hmUI.align.CENTER_H,
      });

      this.buildRow(106, "Heart Rate", 0xff5555);
      this.state.hrWidget = this.buildValue(106);

      this.buildDivider(149);

      this.buildRow(157, "Steps", 0x55aaff);
      this.state.stepsWidget = this.buildValue(157);

      this.buildDivider(200);

      this.buildRow(208, "Calories", 0xffaa00);
      this.state.caloriesWidget = this.buildValue(208);

      this.buildDivider(251);

      this.buildRow(259, "Sleep", 0xaa88ff);
      this.state.sleepWidget = this.buildValue(259);

      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 123,
        y: 320,
        w: 220,
        h: 58,
        text: "SYNC NOW",
        text_size: 26,
        normal_color: 0x1db954,
        press_color: 0x158a3e,
        radius: 29,
        click_func: () => this.syncData(),
      });

      this.state.statusWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0,
        y: 393,
        w: W,
        h: 34,
        text: "Tap to upload to Sheets",
        text_size: 20,
        color: 0x666666,
        align_h: hmUI.align.CENTER_H,
      });
    },

    buildRow(y, label, color) {
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 50,
        y,
        w: 200,
        h: 36,
        text: label,
        text_size: 24,
        color,
      });
    },

    buildValue(y) {
      return hmUI.createWidget(hmUI.widget.TEXT, {
        x: 210,
        y,
        w: 206,
        h: 36,
        text: "--",
        text_size: 24,
        color: 0xffffff,
        align_h: hmUI.align.RIGHT,
      });
    },

    buildDivider(y) {
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: 50,
        y,
        w: 366,
        h: 1,
        color: 0x2a2a2a,
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
    },

    syncData() {
      if (this.state.syncing) return;
      this.state.syncing = true;

      this.state.statusWidget.setProperty(hmUI.prop.TEXT, "Syncing...");

      // Safety timeout — reset state if no response in 30s
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

      const payload = {
        timestamp: isoTimestamp(),
        heartRate: hrVal > 0 ? hrVal : null,
        steps: stepVal,
        calories: calVal,
        sleepScore,
        sleepMinutes: sleepTotal,
        deepSleepMinutes: sleepDeep,
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
