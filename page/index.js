import * as hmUI from "@zos/ui";
import { log as Logger } from "@zos/utils";
import { BasePage } from "@zeppos/zml/base-page";
import { HeartRate, Calorie, Step, Sleep } from "@zos/sensor";

const logger = Logger.getLogger("health-sync");

const W = 466;
const H = 466;

function readSensor(fn) {
  try {
    return fn();
  } catch (_) {
    return null;
  }
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

      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: 50,
        y: 149,
        w: 366,
        h: 1,
        color: 0x2a2a2a,
      });

      this.buildRow(157, "Steps", 0x55aaff);
      this.state.stepsWidget = this.buildValue(157);

      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: 50,
        y: 200,
        w: 366,
        h: 1,
        color: 0x2a2a2a,
      });

      this.buildRow(208, "Calories", 0xffaa00);
      this.state.caloriesWidget = this.buildValue(208);

      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: 50,
        y: 251,
        w: 366,
        h: 1,
        color: 0x2a2a2a,
      });

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

    loadData() {
      const hrVal = readSensor(() => new HeartRate().getLast());
      if (hrVal > 0) {
        this.state.hrWidget.setProperty(hmUI.prop.TEXT, `${hrVal} bpm`);
      }

      const stepVal = readSensor(() => new Step().getCurrent());
      if (stepVal !== null) {
        this.state.stepsWidget.setProperty(
          hmUI.prop.TEXT,
          stepVal.toLocaleString()
        );
      }

      const calVal = readSensor(() => new Calorie().getCurrent());
      if (calVal !== null) {
        this.state.caloriesWidget.setProperty(
          hmUI.prop.TEXT,
          `${calVal} kcal`
        );
      }

      const sleepInfo = readSensor(() => new Sleep().getInfo());
      if (sleepInfo && sleepInfo.totalTime > 0) {
        const h = Math.floor(sleepInfo.totalTime / 60);
        const m = sleepInfo.totalTime % 60;
        this.state.sleepWidget.setProperty(
          hmUI.prop.TEXT,
          `${h}h ${m}m`
        );
      }
    },

    syncData() {
      if (this.state.syncing) return;
      this.state.syncing = true;

      this.state.statusWidget.setProperty(hmUI.prop.TEXT, "Syncing...");

      const hrVal = readSensor(() => new HeartRate().getLast()) || 0;
      const stepVal = readSensor(() => new Step().getCurrent()) || 0;
      const calVal = readSensor(() => new Calorie().getCurrent()) || 0;

      const sleepInfo = readSensor(() => new Sleep().getInfo());
      const sleepScore = sleepInfo ? (sleepInfo.score || 0) : 0;
      const sleepTotal = sleepInfo ? (sleepInfo.totalTime || 0) : 0;
      const sleepDeep = sleepInfo ? (sleepInfo.deepTime || 0) : 0;

      const payload = {
        timestamp: new Date().toISOString(),
        heartRate: hrVal > 0 ? hrVal : null,
        steps: stepVal,
        calories: calVal,
        sleepScore,
        sleepMinutes: sleepTotal,
        deepSleepMinutes: sleepDeep,
      };

      logger.log("syncing payload", JSON.stringify(payload));

      this.request(
        { method: "SYNC_HEALTH", params: payload },
        (error, result) => {
          this.state.syncing = false;
          if (!error && result && result.success) {
            this.state.statusWidget.setProperty(
              hmUI.prop.TEXT,
              "Synced successfully!"
            );
          } else {
            const msg = (result && result.error) ? result.error : "Sync failed";
            this.state.statusWidget.setProperty(hmUI.prop.TEXT, msg);
            logger.error("sync error", error, result);
          }
        }
      );
    },

    onDestroy() {},
  })
);
