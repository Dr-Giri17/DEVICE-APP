import { BaseSideService } from "@zeppos/zml/base-side";

const SHEETS_URL = "https://script.google.com/macros/s/AKfycbzPrT81m1ZdrwqP-KrLB9lS7FZVHyclFqMj6UNLUCGKMmJEWGHsSEL_tuAkuI7oW7RinQ/exec";
const FETCH_TIMEOUT_MS = 25000;

function fetchWithTimeout(opts, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error("Fetch timeout")); }
    }, timeoutMs);
    fetch(opts).then(
      r => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } },
      e => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } }
    );
  });
}

async function postToSheets(data, res) {
  try {
    const response = await fetchWithTimeout({
      url: SHEETS_URL,
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    }, FETCH_TIMEOUT_MS);

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
    const msg = String(error);
    console.log("[health-sync] postToSheets error: " + msg);
    const userMsg = msg.indexOf("timeout") >= 0 || msg.indexOf("Timeout") >= 0
      ? "Timeout — check WiFi" : "Network error";
    res(null, { success: false, error: userMsg });
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
      } else if (req.method === "SYNC_SPO2_PROTOCOL") {
        postToSheets(req.params, res);
      } else {
        res(null, { success: false, error: "sync method missing" });
      }
    },

    onRun() {},
    onDestroy() {},
  })
);
