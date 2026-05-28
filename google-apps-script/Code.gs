// HealthSync — Google Apps Script Web App
// Deploy: Extensions > Apps Script > Deploy > New Deployment > Web App
//   Execute as: Me
//   Who has access: Anyone

var SPREADSHEET_ID = "13gtDCjh1GMm80rFp5wwVmdznQ7D6Wee9htW_XSQqdYQ";
var SHEET_NAME = "HealthData";
var SPO2_SHEET_NAME = "SpO2";

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
      var sheet = getOrCreateSheet();
      sheet.appendRow([
        data.timestamp || new Date().toISOString(),
        data.heartRate || "",
        data.steps || 0,
        data.calories || 0,
        data.sleepScore || 0,
        data.sleepMinutes || 0,
        data.deepSleepMinutes || 0,
        data.bloodOxygen || "",
      ]);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doGet(e) {
  return jsonResponse({ status: "ok", message: "HealthSync endpoint is live" });
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "Timestamp",
      "Heart Rate (bpm)",
      "Steps",
      "Calories (kcal)",
      "Sleep Score",
      "Sleep Duration (min)",
      "Deep Sleep (min)",
      "SpO2 (%)",
    ]);
    sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
  }
  return sheet;
}

function getOrCreateSpo2Sheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SPO2_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SPO2_SHEET_NAME);
    sheet.appendRow([
      "Timestamp",
      "Night Date",
      "Min SpO2 (%)",
      "Avg SpO2 (%)",
      "Max SpO2 (%)",
      "Reading Count",
    ]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
