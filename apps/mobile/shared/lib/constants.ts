import { Platform } from 'react-native';

// Unified backend base URL.
// The single FastAPI server hosts the weather API (/api/weather/*), the radar
// API (/api/radar/*), and the web export (/).
//
// - Web: defaults to the page origin (same-origin) so the deployed export needs
//   no build-time URL. Override with EXPO_PUBLIC_API_URL when developing against
//   a separate backend host.
// - Native: defaults to the local uvicorn server; production builds set
//   EXPO_PUBLIC_API_URL (e.g. via EAS) to the deployed domain.
const fallbackBase =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:8000';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || fallbackBase;

// Radar data is served from the same origin as the rest of the API.
export const RADAR_BASE_URL = API_BASE_URL;

// Default PWS station id — can be overridden per build.
export const DEFAULT_STATION_ID =
  process.env.EXPO_PUBLIC_DEFAULT_STATION ?? 'KCATRUCK306';
