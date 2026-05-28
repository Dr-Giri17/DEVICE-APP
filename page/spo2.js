import * as hmUI from "@zos/ui";
import { BasePage } from "@zeppos/zml/base-page";
import { BloodOxygen, Battery } from "@zos/sensor";
import { localStorage } from "@zos/storage";

const W = 466;
const SYNC_TIMEOUT_MS = 30000;

function pad2(n) { return n < 10 ? "0" + n : String(n); }

function isoTimestamp() {
  try { return new Date().toISOString(); } catch (_) { return String(Date.now()); }
}

function buildDateKey(d) {
  return "spo2_" + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function todayKey() { return buildDateKey(new Date()); }
function yesterdayKey() { return buildDateKey(new Date(Date.now() - 86400000)); }

function getReadings(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { return []; }
}

function calcStats(readings) {
  if (!readings || readings.length === 0) return null;
  let min = 100, max = 0, sum = 0;
  for (let i = 0; i < readings.length; i++) {
    const v = readings[i].v;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, avg: Math.round(sum / readings.length), count: readings.length };
}

function getNightStats() {
  const hour = new Date().getHours();
  // Morning: show yesterday's night; Evening: show tonight so far
  const key = hour < 14 ? yesterdayKey() : todayKey();
  const readings = getReadings(key);
  return { stats: calcStats(readings), readings, key };
}

function getCurrentSpO2() {
  try {
    const result = new BloodOxygen().getCurrent();
    if (result && result.retCode === 2 && result.value > 50) return result.value;
  } catch (_) {}
  return 0;
}

function isEnabled() {
  return localStorage.getItem("spo2_enabled") !== "false";
}

function getBatteryLevel() {
  try { return new Battery().getCurrent(); } catch (_) { return 100; }
}

Page(
  BasePage({
    state: {
      statusValueWidget: null,
      currentWidget: null,
      minWidget: null,
      avgWidget: null,
      maxWidget: null,
      countWidget: null,
      toggleBtn: null,
      statusText: null,
      syncing: false,
      syncTimer: null,
    },

    onInit() {
      this.build();
      this.refresh();
      this.triggerMeasurement();
    },

    build() {
      hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: W, h: 466, color: 0x0d0d0d });

      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0, y: 20, w: W, h: 40,
        text: "SpO2 Monitor",
        text_size: 30,
        color: 0xffffff,
        align_h: hmUI.align.CENTER_H,
      });

      // Status row
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 50, y: 72, w: 140, h: 30,
        text: "Monitor:",
        text_size: 22,
        color: 0x888888,
      });
      this.state.statusValueWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 190, y: 72, w: 226, h: 30,
        text: "...",
        text_size: 22,
        color: 0x55ff55,
        align_h: hmUI.align.RIGHT,
      });

      hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 50, y: 108, w: 366, h: 1, color: 0x2a2a2a });

      // Current SpO2 row
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 50, y: 116, w: 140, h: 30,
        text: "Now:",
        text_size: 22,
        color: 0x888888,
      });
      this.state.currentWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 190, y: 116, w: 226, h: 30,
        text: "--",
        text_size: 22,
        color: 0xffffff,
        align_h: hmUI.align.RIGHT,
      });

      hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 50, y: 152, w: 366, h: 1, color: 0x2a2a2a });

      // Last Night header
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0, y: 160, w: W, h: 28,
        text: "Last Night",
        text_size: 20,
        color: 0x666666,
        align_h: hmUI.align.CENTER_H,
      });

      // Min / Avg / Max columns
      const cols = [
        { label: "Min", x: 50, color: 0xff5555 },
        { label: "Avg", x: 183, color: 0xffffff },
        { label: "Max", x: 316, color: 0x7b68ee },
      ];
      for (let i = 0; i < cols.length; i++) {
        hmUI.createWidget(hmUI.widget.TEXT, {
          x: cols[i].x, y: 195, w: 100, h: 28,
          text: cols[i].label,
          text_size: 18,
          color: 0x888888,
          align_h: hmUI.align.CENTER_H,
        });
      }
      this.state.minWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 50, y: 226, w: 100, h: 34,
        text: "--", text_size: 26, color: 0xff5555, align_h: hmUI.align.CENTER_H,
      });
      this.state.avgWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 183, y: 226, w: 100, h: 34,
        text: "--", text_size: 26, color: 0xffffff, align_h: hmUI.align.CENTER_H,
      });
      this.state.maxWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 316, y: 226, w: 100, h: 34,
        text: "--", text_size: 26, color: 0x7b68ee, align_h: hmUI.align.CENTER_H,
      });

      this.state.countWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0, y: 264, w: W, h: 26,
        text: "No readings yet",
        text_size: 18,
        color: 0x555555,
        align_h: hmUI.align.CENTER_H,
      });

      hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 50, y: 296, w: 366, h: 1, color: 0x2a2a2a });

      // Toggle button — text set in refresh() via prop.MORE
      const initEnabled = isEnabled();
      this.state.toggleBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 83, y: 308, w: 300, h: 52,
        text: initEnabled ? "STOP MONITORING" : "START MONITORING",
        text_size: 22,
        normal_color: initEnabled ? 0x3a1a1a : 0x1a3a1a,
        press_color: initEnabled ? 0x200d0d : 0x0d200d,
        radius: 26,
        click_func: () => this.toggleMonitoring(),
      });

      // Sync button
      hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 83, y: 370, w: 300, h: 46,
        text: "SYNC TO SHEETS",
        text_size: 20,
        normal_color: 0x1db954,
        press_color: 0x158a3e,
        radius: 23,
        click_func: () => this.syncData(),
      });

      this.state.statusText = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0, y: 426, w: W, h: 26,
        text: "",
        text_size: 18,
        color: 0x666666,
        align_h: hmUI.align.CENTER_H,
      });
    },

    refresh() {
      const enabled = isEnabled();

      this.state.statusValueWidget.setProperty(hmUI.prop.TEXT, enabled ? "● ON" : "○ OFF");
      this.state.toggleBtn.setProperty(hmUI.prop.MORE, {
        text: enabled ? "STOP MONITORING" : "START MONITORING",
        normal_color: enabled ? 0x3a1a1a : 0x1a3a1a,
        press_color: enabled ? 0x200d0d : 0x0d200d,
      });

      const current = getCurrentSpO2();
      this.state.currentWidget.setProperty(hmUI.prop.TEXT, current > 0 ? String(current) + "%" : "--");

      const bat = getBatteryLevel();
      if (bat <= 5) {
        this.state.statusText.setProperty(hmUI.prop.TEXT, "⚠ Battery " + String(bat) + "% — paused");
      } else if (enabled) {
        this.state.statusText.setProperty(hmUI.prop.TEXT, "Active 22:00 – 08:00");
      } else {
        this.state.statusText.setProperty(hmUI.prop.TEXT, "Monitoring disabled");
      }

      const { stats } = getNightStats();
      if (stats) {
        this.state.minWidget.setProperty(hmUI.prop.TEXT, String(stats.min) + "%");
        this.state.avgWidget.setProperty(hmUI.prop.TEXT, String(stats.avg) + "%");
        this.state.maxWidget.setProperty(hmUI.prop.TEXT, String(stats.max) + "%");
        this.state.countWidget.setProperty(hmUI.prop.TEXT, String(stats.count) + " readings");
      } else {
        this.state.minWidget.setProperty(hmUI.prop.TEXT, "--");
        this.state.avgWidget.setProperty(hmUI.prop.TEXT, "--");
        this.state.maxWidget.setProperty(hmUI.prop.TEXT, "--");
        this.state.countWidget.setProperty(hmUI.prop.TEXT, "No readings yet");
      }
    },

    triggerMeasurement() {
      this.state.currentWidget.setProperty(hmUI.prop.TEXT, "...");
      try {
        const sensor = new BloodOxygen();
        let done = false;
        const cb = () => {
          if (done) return;
          try {
            const result = sensor.getCurrent();
            if (result && result.retCode === 2 && result.value > 50) {
              done = true;
              this.state.currentWidget.setProperty(hmUI.prop.TEXT, String(result.value) + "%");
              sensor.offChange(cb);
              sensor.stop();
            }
          } catch (_) {}
        };
        sensor.onChange(cb);
        sensor.start();
        // Auto-cancel after 30s if no reading
        setTimeout(() => {
          if (!done) {
            done = true;
            try { sensor.offChange(cb); sensor.stop(); } catch (_) {}
            this.state.currentWidget.setProperty(hmUI.prop.TEXT, "--");
          }
        }, 30000);
      } catch (_) {
        this.state.currentWidget.setProperty(hmUI.prop.TEXT, "--");
      }
    },

    toggleMonitoring() {
      const enabled = isEnabled();
      localStorage.setItem("spo2_enabled", enabled ? "false" : "true");
      this.refresh();
      this.state.statusText.setProperty(hmUI.prop.TEXT,
        enabled ? "Monitoring stopped" : "Monitoring started"
      );
    },

    syncData() {
      if (this.state.syncing) return;
      const { stats, readings } = getNightStats();
      if (!stats || stats.count === 0) {
        this.state.statusText.setProperty(hmUI.prop.TEXT, "No data to sync");
        return;
      }

      this.state.syncing = true;
      this.state.statusText.setProperty(hmUI.prop.TEXT, "Syncing...");

      this.state.syncTimer = setTimeout(() => {
        if (this.state.syncing) {
          this.state.syncing = false;
          this.state.statusText.setProperty(hmUI.prop.TEXT, "Timeout — check WiFi");
        }
      }, SYNC_TIMEOUT_MS);

      const hour = new Date().getHours();
      const dateStr = (hour < 14 ? yesterdayKey() : todayKey()).slice(5);

      const payload = {
        type: "spo2",
        timestamp: isoTimestamp(),
        date: dateStr,
        minSpo2: stats.min,
        avgSpo2: stats.avg,
        maxSpo2: stats.max,
        count: stats.count,
      };

      this.request(
        { method: "SYNC_SPO2", params: payload },
        (error, result) => {
          clearTimeout(this.state.syncTimer);
          this.state.syncing = false;
          if (!error && result && result.success) {
            this.state.statusText.setProperty(hmUI.prop.TEXT, "Synced OK!");
          } else {
            const msg = (result && result.error) ? String(result.error) : "Sync failed";
            this.state.statusText.setProperty(hmUI.prop.TEXT, msg);
          }
        }
      );
    },

    onDestroy() {
      if (this.state.syncTimer) clearTimeout(this.state.syncTimer);
    },
  })
);
