/**
 * Shared types for the radar feature (mirrors the backend /api/radar contract).
 */

export type ViewMode = 'composite' | '3d' | 'volume';
export type PresetKey = 'all' | 'precip' | 'severe' | 'custom';

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** One entry from GET /api/radar/timestamps. */
export interface TimestampEntry {
  timestamp: string;
  bounds?: GeoBounds;
  has_motion?: boolean;
  gap_before_s?: number | null;
  is_gap?: boolean;
}

export interface GapInfo {
  expected_cadence_s: number;
  gap_count: number;
  max_gap_s: number;
}

export interface TimestampsResponse {
  timestamps: TimestampEntry[];
  count: number;
  motion?: { max_disp_deg: number };
  gap_info?: GapInfo;
}

export interface RadarConfig {
  stadia_api_key: string;
  maptiler_api_key: string;
  default_station: string;
}

/** Emitted to the host UI whenever the active animation frame changes. */
export interface FrameUpdate {
  index: number;
  total: number;
  timestamp: string | null;
  formattedTime: string;
  isGap: boolean;
  gapMinutes: number | null;
}

export interface PresetValues {
  dbzMin: number;
  dbzMax: number;
  intensity: number;
}

/** A tile address in the slippy-map / atlas scheme. */
export interface TileCoord {
  z: number;
  x: number;
  y: number;
}
