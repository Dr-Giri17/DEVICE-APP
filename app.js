import { BaseApp } from "@zeppos/zml/base-app";
import { startService } from "@zos/router";

App(
  BaseApp({
    globalData: {},
    onCreate() {
      try {
        startService({ url: "app-service/index" });
        console.log("[health-sync] app-service started OK");
      } catch (e) {
        console.log("[health-sync] startService error: " + String(e));
      }
    },
    onDestroy() {},
  })
);
