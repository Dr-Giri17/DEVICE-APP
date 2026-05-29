// HealthSync — Google Apps Script Web App
// Deploy: Extensions > Apps Script > Deploy > New Deployment > Web App
//   Execute as: Me  |  Who has access: Anyone

var SPREADSHEET_ID = "13gtDCjh1GMm80rFp5wwVmdznQ7D6Wee9htW_XSQqdYQ";

// ── Sheet names ─────────────────────────────────────────────────────────────
// Metrics      — on-demand snapshot (HR, steps, calories, SpO2) — every SYNC NOW
// DailySummary — sleep data, one row per calendar day (upserted)
// DayCheckup   — hourly background readings all day (HR, steps, cal, SpO2, stress, RMSSD)
// SpO2         — overnight SpO2 session summaries from SpO2 Monitor page

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.type === "spo2") {
      // Overnight SpO2 session summary
      getOrCreateSpo2Sheet().appendRow([
        data.timestamp || new Date().toISOString(),
        data.date       || "",
        data.minSpo2    || 0,
        data.avgSpo2    || 0,
        data.maxSpo2    || 0,
        data.count      || 0,
      ]);

    } else {
      // type === "health" — up to three writes per call

      // 1. Metrics: on-demand snapshot (every SYNC NOW tap)
      getOrCreateMetricsSheet().appendRow([
        data.timestamp  || new Date().toISOString(),
        data.heartRate  != null ? data.heartRate  : "",
        data.steps      || 0,
        data.calories   || 0,
        data.bloodOxygen != null ? data.bloodOxygen : "",
      ]);

      // 2. DailySummary: sleep data, upserted by date (only when watch includes it)
      if (data.hasSleepData) {
        var date = (data.timestamp || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
        upsertDailySummary(date, data.sleepScore || 0, data.sleepMinutes || 0, data.deepSleepMinutes || 0);
      }

      // 3. DayCheckup: hourly background readings (watch sends only new rows)
      if (data.checkupReadings && data.checkupReadings.length > 0) {
        var sheet    = getOrCreateDayCheckupSheet();
        var syncDate = (data.timestamp || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
        for (var i = 0; i < data.checkupReadings.length; i++) {
          var r  = data.checkupReadings[i];
          var ts = r.t ? new Date(r.t).toISOString() : (data.timestamp || new Date().toISOString());
          sheet.appendRow([
            ts,
            syncDate,
            r.hr      != null ? r.hr      : "",
            r.steps   || 0,
            r.cal     || 0,
            r.spo2    != null ? r.spo2    : "",
            r.stress  != null ? r.stress  : "",
            r.rmssd   || 0,
            r.rrCount || 0,
          ]);
        }
      }
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doGet(e) {
  return jsonResponse({ status: "ok", message: "HealthSync endpoint is live" });
}

// ── Sheet helpers ────────────────────────────────────────────────────────────

function getOrCreateMetricsSheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("Metrics");
  if (!sheet) {
    sheet = ss.insertSheet("Metrics");
    sheet.appendRow(["Timestamp", "Heart Rate (bpm)", "Steps", "Calories (kcal)", "SpO2 (%)"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
  }
  return sheet;
}

function upsertDailySummary(date, sleepScore, sleepMinutes, deepSleepMinutes) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("DailySummary");
  if (!sheet) {
    sheet = ss.insertSheet("DailySummary");
    sheet.appendRow(["Date", "Sleep Score", "Sleep Duration (min)", "Deep Sleep (min)", "Last Updated"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
  }
  var updatedAt = new Date().toISOString();
  var values    = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === date) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([[date, sleepScore, sleepMinutes, deepSleepMinutes, updatedAt]]);
      return;
    }
  }
  sheet.appendRow([date, sleepScore, sleepMinutes, deepSleepMinutes, updatedAt]);
}

function getOrCreateDayCheckupSheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("DayCheckup");
  if (!sheet) {
    sheet = ss.insertSheet("DayCheckup");
    sheet.appendRow([
      "Timestamp", "Date",
      "HR (bpm)", "Steps", "Calories (kcal)", "SpO2 (%)",
      "Stress (0-100)", "RMSSD (ms)", "RR Intervals",
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold");
  }
  return sheet;
}

function getOrCreateSpo2Sheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("SpO2");
  if (!sheet) {
    sheet = ss.insertSheet("SpO2");
    sheet.appendRow(["Timestamp", "Night Date", "Min SpO2 (%)", "Avg SpO2 (%)", "Max SpO2 (%)", "Reading Count"]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
