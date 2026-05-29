// HealthSync — Google Apps Script Web App
// Deploy: Extensions > Apps Script > Deploy > New Deployment > Web App
//   Execute as: Me
//   Who has access: Anyone

var SPREADSHEET_ID = "13gtDCjh1GMm80rFp5wwVmdznQ7D6Wee9htW_XSQqdYQ";

// Sheet names
var SHEET_METRICS = "Metrics";       // time-series: HR, steps, calories, SpO2  (every sync)
var SHEET_DAILY   = "DailySummary"; // daily: sleep score/duration/deep          (once per day, upserted by date)
var SHEET_SPO2    = "SpO2";         // overnight SpO2 sessions

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.type === "spo2") {
      var spo2Sheet = getOrCreateSpo2Sheet();
      spo2Sheet.appendRow([
        data.timestamp || new Date().toISOString(),
        data.date || "",
        data.minSpo2 || 0,
        data.avgSpo2 || 0,
        data.maxSpo2 || 0,
        data.count || 0,
      ]);
    } else {
      // type === "health"

      // 1. Always append a metrics row (time-series, changes during the day)
      var metricsSheet = getOrCreateMetricsSheet();
      metricsSheet.appendRow([
        data.timestamp || new Date().toISOString(),
        data.heartRate != null ? data.heartRate : "",
        data.steps || 0,
        data.calories || 0,
        data.bloodOxygen != null ? data.bloodOxygen : "",
      ]);

      // 2. Upsert daily summary — only when watch says sleep data is included
      if (data.hasSleepData) {
        var date = (data.timestamp || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
        upsertDailySummary(date, data.sleepScore || 0, data.sleepMinutes || 0, data.deepSleepMinutes || 0);
      }

      // 3. Append new HRV readings (only new ones since last sync — no duplicates)
      if (data.hrvReadings && data.hrvReadings.length > 0) {
        var hrvSheet = getOrCreateHrvSheet();
        var syncDate = (data.timestamp || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
        for (var i = 0; i < data.hrvReadings.length; i++) {
          var r = data.hrvReadings[i];
          var ts = r.t ? new Date(r.t).toISOString() : data.timestamp;
          // r.h = avg HR, r.s = stress, r.r = RMSSD, r.n = RR interval count
          hrvSheet.appendRow([ts, syncDate, r.h || "", r.s || "", r.r || 0, r.n || 0]);
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

// Metrics: one row per sync — heart rate, steps, calories, SpO2
function getOrCreateMetricsSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_METRICS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_METRICS);
    sheet.appendRow(["Timestamp", "Heart Rate (bpm)", "Steps", "Calories (kcal)", "SpO2 (%)"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
  }
  return sheet;
}

// DailySummary: one row per calendar date — sleep metrics, upserted (not duplicated)
function upsertDailySummary(date, sleepScore, sleepMinutes, deepSleepMinutes) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_DAILY);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DAILY);
    sheet.appendRow(["Date", "Sleep Score", "Sleep Duration (min)", "Deep Sleep (min)", "Last Updated"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
  }

  var updatedAt = new Date().toISOString();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === date) {
      // Row for this date already exists — update it in place
      sheet.getRange(i + 1, 1, 1, 5).setValues([[date, sleepScore, sleepMinutes, deepSleepMinutes, updatedAt]]);
      return;
    }
  }
  // New date — append a fresh row
  sheet.appendRow([date, sleepScore, sleepMinutes, deepSleepMinutes, updatedAt]);
}

// HRVLog: one row per hourly HRV measurement session
function getOrCreateHrvSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("HRVLog");
  if (!sheet) {
    sheet = ss.insertSheet("HRVLog");
    sheet.appendRow(["Timestamp", "Date", "Avg HR (bpm)", "Stress (0-100)", "RMSSD (ms)", "RR Intervals Count"]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
  return sheet;
}

// SpO2: overnight session summaries from the SpO2 Monitor page
function getOrCreateSpo2Sheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_SPO2);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SPO2);
    sheet.appendRow(["Timestamp", "Night Date", "Min SpO2 (%)", "Avg SpO2 (%)", "Max SpO2 (%)", "Reading Count"]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
