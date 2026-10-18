"use client";

import { useEffect, useRef } from "react";
import { isRootScreen, type Route } from "@/lib/paths";

export function NativeChrome({ route }: { route: Route }) {
  const routeRef = useRef(route);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    let remove = () => {};
    let cancelled = false;

    async function mount() {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || cancelled) return;
      const [{ App }, { StatusBar }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/status-bar"),
      ]);
      await StatusBar.setOverlaysWebView({ overlay: true });
      await paintStatusBar(routeRef.current);
      const handle = await App.addListener("backButton", () => {
        if (isRootScreen(routeRef.current)) {
          void App.exitApp();
          return;
        }
        window.history.back();
      });
      remove = () => {
        void handle.remove();
      };
    }

    void mount();
    return () => {
      cancelled = true;
      remove();
    };
  }, []);

  useEffect(() => {
    void paintStatusBar(route);
  }, [route]);

  return null;
}

async function paintStatusBar(route: Route) {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  const { StatusBar, Style } = await import("@capacitor/status-bar");
  const entrance = route.name === "splash";
  await StatusBar.setBackgroundColor({ color: entrance ? "#1e3932" : "#f2f0eb" });
  await StatusBar.setStyle({ style: entrance ? Style.Light : Style.Dark });
}
