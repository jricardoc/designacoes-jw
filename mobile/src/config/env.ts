import Constants from "expo-constants";

/**
 * Base URL of the backend API.
 *
 * Mobile devices/emulators cannot reach the host machine's `localhost`, so the
 * value must point to a LAN address (e.g. http://192.168.0.10:3001) or a public
 * deployment. Configure it in app.json -> expo.extra.apiUrl, or override with
 * the EXPO_PUBLIC_API_URL environment variable.
 */
const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)
  ?.apiUrl;

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
  fromExtra?.replace(/\/$/, "") ||
  "http://localhost:3001";
