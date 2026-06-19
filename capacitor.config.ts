import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Hosted mode: the native iOS/Android shell loads the deployed Quotidy server
 * over HTTPS. Offline support is provided by the app's own service worker +
 * outbox (so the SSR app doesn't need a static export). Set CAPACITOR_SERVER_URL
 * to your production origin before `npx cap sync` — see docs/native-app.md.
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL || "https://quotidy.example.com";

const config: CapacitorConfig = {
  appId: "com.quotidy.app",
  appName: "Quotidy",
  // Bundled fallback shown only if the server is unreachable on a cold start;
  // once loaded, the service worker serves the cached app offline.
  webDir: "native/www",
  server: {
    url: serverUrl,
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#f4ece0",
  },
  android: {
    backgroundColor: "#f4ece0",
  },
};

export default config;
