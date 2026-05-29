import { BaseApp } from "@zeppos/zml/base-app";
import { startService } from "@zos/router";

App(
  BaseApp({
    globalData: {},
    onCreate() {
      // Log the type so we can see in Device logs whether the import resolved
      console.log("[health-sync] app onCreate, startService=" + typeof startService);
      if (typeof startService === "function") {
        try {
          startService({ url: "app-service/index" });
          console.log("[health-sync] startService OK");
        } catch (e) {
          console.log("[health-sync] startService threw: " + String(e));
        }
      } else {
        console.log("[health-sync] startService not a function — trying app.json auto-start");
      }
    },
    onDestroy() {},
  })
);
