// HealthSync — Google Apps Script Web App
// Deploy: Extensions > Apps Script > Deploy > New Deployment > Web App
//   Execute as: Me
//   Who has access: Anyone
// Copy the web app URL into app-side/index.js as SHEETS_URL

var SHEET_NAME = "HealthData";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getOrCreateSheet();

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.heartRate || "",
      data.steps || 0,
      data.calories || 0,
      data.sleepScore || 0,
      data.sleepMinutes || 0,
      data.deepSleepMinutes || 0,
    ]);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doGet(e) {
  return jsonResponse({ status: "ok", message: "HealthSync endpoint is live" });
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
    ]);
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold");
  }

  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
