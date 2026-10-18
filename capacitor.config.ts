import { readFileSync } from "node:fs";
import type { CapacitorConfig } from "@capacitor/cli";

function envValue(name: string) {
  if (process.env[name]) return process.env[name];
  try {
    const line = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim() || undefined;
  } catch {
    return undefined;
  }
}

const serverUrl = envValue("CAPACITOR_SERVER_URL");

const config: CapacitorConfig = {
  appId: "com.campusbite.app",
  appName: "CampusBite",
  webDir: "public",
  server: {
    androidScheme: "https",
    hostname: "localhost",
    ...(serverUrl
      ? {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
        }
      : {}),
  },
};

export default config;
