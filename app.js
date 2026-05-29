import { BaseApp } from "@zeppos/zml/base-app";

App(
  BaseApp({
    globalData: {},
    onCreate() {
      console.log("[health-sync] app started — service auto-starts via app.json");
    },
    onDestroy() {},
  })
);
