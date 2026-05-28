import { BaseSideService } from "@zeppos/zml/base-side";

// Paste your Google Apps Script web app URL here after deploying Code.gs
const SHEETS_URL = "YOUR_GOOGLE_APPS_SCRIPT_URL";

async function postToSheets(data, res) {
  try {
    const response = await fetch({
      url: SHEETS_URL,
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(data),
    });

    const body =
      typeof response.body === "string"
        ? JSON.parse(response.body)
        : response.body;

    if (body && body.success) {
      res(null, { success: true });
    } else {
      res(null, { success: false, error: "Sheet rejected data" });
    }
  } catch (error) {
    console.log("[health-sync] postToSheets error:", error);
    res(null, { success: false, error: String(error) });
  }
}

AppSideService(
  BaseSideService({
    onInit() {
      console.log("[health-sync] side service init");
    },

    onRequest(req, res) {
      console.log("[health-sync] request:", req.method);
      if (req.method === "SYNC_HEALTH") {
        postToSheets(req.params, res);
      }
    },

    onRun() {},

    onDestroy() {
      console.log("[health-sync] side service destroy");
    },
  })
);
