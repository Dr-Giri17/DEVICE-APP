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

    if (data.type === "spo2_protocol") {
      appendSpo2ProtocolBatch(data);

    } else if (data.type === "spo2") {
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
      // Batched setValues — significantly faster than appendRow in a loop
      if (data.checkupReadings && data.checkupReadings.length > 0) {
        var sheet    = getOrCreateDayCheckupSheet();
        var syncDate = (data.timestamp || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
        var rows     = [];
        for (var i = 0; i < data.checkupReadings.length; i++) {
          var r  = data.checkupReadings[i];
          var ts = r.t ? new Date(r.t).toISOString() : (data.timestamp || new Date().toISOString());
          rows.push([
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
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
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

function appendSpo2ProtocolBatch(data) {
  var cycles = data.cycles || [];
  if (cycles.length > 0) {
    var cycleSheet = getOrCreateSpo2ProtocolCycleSheet();
    var cycleRows = [];
    for (var i = 0; i < cycles.length; i++) {
      var c = cycles[i];
      cycleRows.push([
        data.timestamp || new Date().toISOString(),
        c.protocol_id || "",
        c.cycle_index || 0,
        c.state || "",
        c.started_at || "",
        c.ended_at || "",
        c.duration_sec != null ? c.duration_sec : "",
        c.spo2_value != null ? c.spo2_value : "",
        c.spo2_time || "",
        c.ret_code != null ? c.ret_code : "",
        c.ret_status || "",
        c.success === true,
        c.failure_reason || "",
        c.cooldown_sec != null ? c.cooldown_sec : "",
        c.battery_level != null ? c.battery_level : "",
        c.source || "active_measurement",
        c.confidence || "experimental",
        c.clinical_use || "not_validated",
        c.notes || "",
      ]);
    }
    cycleSheet.getRange(cycleSheet.getLastRow() + 1, 1, cycleRows.length, 19).setValues(cycleRows);
  }

  if (data.summary) {
    var s = data.summary;
    getOrCreateSpo2ProtocolSummarySheet().appendRow([
      s.generated_at || data.timestamp || new Date().toISOString(),
      s.protocol_id || "",
      s.total_cycles || 0,
      s.successful_cycles || 0,
      s.success_rate || 0,
      s.timeout_count || 0,
      s.invalid_signal_count || 0,
      s.not_wearing_count || 0,
      s.invalid_wearing_count || 0,
      s.average_duration_sec != null ? s.average_duration_sec : "",
      s.min_spo2 != null ? s.min_spo2 : "",
      s.avg_spo2 != null ? s.avg_spo2 : "",
      s.max_spo2 != null ? s.max_spo2 : "",
      s.recommended_min_cooldown_sec || 0,
      s.reliability_score || 0,
      s.confidence || "experimental",
      s.clinical_use || "not_validated",
      s.unsafe === true,
      s.unsafe_reason || "",
    ]);
  }

  var historical = data.historical || [];
  if (historical.length > 0) {
    var histSheet = getOrCreateSpo2HistoricalSheet();
    var histRows = [];
    for (var h = 0; h < historical.length; h++) {
      var r = historical[h];
      histRows.push([
        data.timestamp || new Date().toISOString(),
        r.method || "",
        r.historical_read_supported === true,
        r.success === true,
        r.source || "historical_read",
        r.confidence || "experimental",
        r.clinical_use || "not_validated",
        r.raw || "",
        r.notes || r.failure_reason || "",
      ]);
    }
    histSheet.getRange(histSheet.getLastRow() + 1, 1, histRows.length, 9).setValues(histRows);
  }
}

function getOrCreateSpo2ProtocolCycleSheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("SpO2ProtocolCycles");
  if (!sheet) {
    sheet = ss.insertSheet("SpO2ProtocolCycles");
    sheet.appendRow([
      "Batch Timestamp", "Protocol ID", "Cycle Index", "State", "Started At", "Ended At",
      "Duration (sec)", "SpO2 (%)", "SpO2 Time", "Ret Code", "Ret Status", "Success",
      "Failure Reason", "Cooldown (sec)", "Battery (%)", "Source", "Confidence",
      "Clinical Use", "Notes",
    ]);
    sheet.getRange(1, 1, 1, 19).setFontWeight("bold");
  }
  return sheet;
}

function getOrCreateSpo2ProtocolSummarySheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("SpO2ProtocolSummary");
  if (!sheet) {
    sheet = ss.insertSheet("SpO2ProtocolSummary");
    sheet.appendRow([
      "Generated At", "Protocol ID", "Total Cycles", "Successful Cycles", "Success Rate (%)",
      "Timeout Count", "Invalid Signal Count", "Not Wearing Count", "Invalid Wearing Count",
      "Average Duration (sec)", "Min SpO2 (%)", "Avg SpO2 (%)", "Max SpO2 (%)",
      "Recommended Min Cooldown (sec)", "Reliability Score", "Confidence", "Clinical Use",
      "Unsafe", "Unsafe Reason",
    ]);
    sheet.getRange(1, 1, 1, 19).setFontWeight("bold");
  }
  return sheet;
}

function getOrCreateSpo2HistoricalSheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("SpO2HistoricalRead");
  if (!sheet) {
    sheet = ss.insertSheet("SpO2HistoricalRead");
    sheet.appendRow([
      "Batch Timestamp", "Method", "Supported", "Success", "Source",
      "Confidence", "Clinical Use", "Raw", "Notes",
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold");
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
