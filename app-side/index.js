import { BaseSideService } from "@zeppos/zml/base-side";

const SHEETS_URL = "https://script.google.com/macros/s/AKfycbzPrT81m1ZdrwqP-KrLB9lS7FZVHyclFqMj6UNLUCGKMmJEWGHsSEL_tuAkuI7oW7RinQ/exec";

async function postToSheets(data, res) {
  try {
    const response = await fetch({
      url: SHEETS_URL,
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    });

    let body = response.body;
    if (typeof body === "string") {
      const jsonStart = body.indexOf("{");
      if (jsonStart >= 0) {
        try { body = JSON.parse(body.slice(jsonStart)); }
        catch (_) { body = { success: true }; }
      } else {
        body = { success: response.status < 400 };
      }
    }

    if (body && body.success) {
      res(null, { success: true });
    } else {
      res(null, { success: false, error: "Sheet error" });
    }
  } catch (error) {
    console.log("[health-sync] postToSheets error: " + String(error));
    res(null, { success: false, error: "Network error" });
  }
}

AppSideService(
  BaseSideService({
    onInit() {
      console.log("[health-sync] side service ready");
    },

    onRequest(req, res) {
      console.log("[health-sync] request: " + req.method);
      if (req.method === "SYNC_HEALTH") {
        postToSheets(req.params, res);
      } else if (req.method === "SYNC_SPO2") {
        postToSheets(req.params, res);
      }
    },

    onRun() {},
    onDestroy() {},
  })
);
