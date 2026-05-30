/**
 * Web-Mercator helpers. World coordinates are normalised to [0, 1] (the whole
 * world), matching the coordinate space the radar meshes and GLSL shaders use
 * (tile mx = x / 2^z, altitude = meters / EARTH_CIRCUMFERENCE).
 */

export const EARTH_CIRCUMFERENCE = 40075016.686;
export const TILE_SIZE = 512;
export const MAX_MERCATOR_LAT = 85.051129;

export interface MercatorPoint {
  x: number;
  y: number;
}

export interface LngLat {
  lng: number;
  lat: number;
}

export function lngLatToMercator(lng: number, lat: number): MercatorPoint {
  const clampedLat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const x = (180 + lng) / 360;
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
  return { x, y };
}

export function mercatorToLngLat(x: number, y: number): LngLat {
  const lng = x * 360 - 180;
  const y2 = 180 - y * 360;
  const lat = (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90;
  return { lng, lat };
}

/** Altitude in meters → mercator z units (uniform with x/y). */
export function metersToMercatorAlt(meters: number): number {
  return meters / EARTH_CIRCUMFERENCE;
}

export function clampLat(lat: number): number {
  return Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
}
