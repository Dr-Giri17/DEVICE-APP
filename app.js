import { BaseApp } from "@zeppos/zml/base-app";
import { startService } from "@zos/app-service";

App(
  BaseApp({
    globalData: {},
    onCreate() {
      try {
        startService({ file: "app-service/index" });
        console.log("[health-sync] app-service started");
      } catch (e) {
        console.log("[health-sync] startService error: " + String(e));
      }
    },
    onDestroy() {},
  })
);
