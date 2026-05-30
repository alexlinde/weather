/**
 * RadarCamera — a self-contained Web-Mercator camera that replaces MapLibre.
 *
 * Produces a projection matrix mapping mercator world coordinates ([0,1] in x/y,
 * uniform z for altitude) to clip space, matching the convention the ported
 * radar meshes + GLSL shaders expect. Also provides screen<->ground
 * unprojection used for tile selection and gesture handling.
 */

import * as THREE from 'three';

import {
  TILE_SIZE,
  clampLat,
  lngLatToMercator,
  mercatorToLngLat,
  type LngLat,
} from './mercator';
import type { GeoBounds } from './types';

const FOV = 0.6435011087932844; // ~36.87°, MapLibre default
const MIN_ZOOM = 2.5;
const MAX_ZOOM = 11;
const MAX_PITCH = 70;

function makePerspective(
  fovy: number,
  aspect: number,
  near: number,
  far: number,
): THREE.Matrix4 {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  const m = new THREE.Matrix4();
  // row-major args; THREE stores column-major internally
  m.set(
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, 2 * far * near * nf,
    0, 0, -1, 0,
  );
  return m;
}

export class RadarCamera {
  center: LngLat = { lng: -98.5, lat: 39.5 };
  zoom = 4;
  bearing = 0; // degrees
  pitch = 0; // degrees
  width = 1;
  height = 1;
  pixelRatio = 1;

  private _matrix = new THREE.Matrix4();
  private _inverse = new THREE.Matrix4();
  private _dirty = true;

  setViewport(width: number, height: number, pixelRatio = 1): void {
    if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) {
      return;
    }
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.pixelRatio = pixelRatio;
    this._dirty = true;
  }

  jumpTo(opts: {
    center?: LngLat;
    zoom?: number;
    bearing?: number;
    pitch?: number;
  }): void {
    if (opts.center) this.center = { lng: opts.center.lng, lat: clampLat(opts.center.lat) };
    if (opts.zoom != null) this.zoom = this._clampZoom(opts.zoom);
    if (opts.bearing != null) this.bearing = opts.bearing;
    if (opts.pitch != null) this.pitch = Math.max(0, Math.min(MAX_PITCH, opts.pitch));
    this._dirty = true;
  }

  getZoom(): number {
    return this.zoom;
  }

  getCenter(): LngLat {
    return { ...this.center };
  }

  private _clampZoom(z: number): number {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  }

  private get worldSize(): number {
    return TILE_SIZE * Math.pow(2, this.zoom);
  }

  // ── Matrices ────────────────────────────────────────────────────────────

  private _recompute(): void {
    const worldSize = this.worldSize;
    const c = lngLatToMercator(this.center.lng, this.center.lat);
    const cx = c.x * worldSize;
    const cy = c.y * worldSize;

    const pitchRad = (this.pitch * Math.PI) / 180;
    const bearingRad = (this.bearing * Math.PI) / 180;

    const cameraToCenterDistance = (0.5 / Math.tan(FOV / 2)) * this.height;

    // Far plane derived from pitch (MapLibre approach) so tilted views aren't clipped.
    const halfFov = FOV / 2;
    const groundAngle = Math.PI / 2 + pitchRad;
    const denom = Math.max(0.01, Math.min(Math.PI - 0.01, Math.PI - groundAngle - halfFov));
    const topHalfSurfaceDistance =
      (Math.sin(halfFov) * cameraToCenterDistance) / Math.sin(denom);
    const furthestDistance =
      Math.cos(Math.PI / 2 - pitchRad) * topHalfSurfaceDistance + cameraToCenterDistance;
    const farZ = furthestDistance * 1.01;
    const nearZ = this.height / 50;

    const proj = makePerspective(FOV, this.width / this.height, nearZ, farZ);

    const m = proj;
    m.multiply(new THREE.Matrix4().makeScale(1, -1, 1));
    m.multiply(new THREE.Matrix4().makeTranslation(0, 0, -cameraToCenterDistance));
    m.multiply(new THREE.Matrix4().makeRotationX(pitchRad));
    m.multiply(new THREE.Matrix4().makeRotationZ(bearingRad));
    m.multiply(new THREE.Matrix4().makeTranslation(-cx, -cy, 0));
    m.multiply(new THREE.Matrix4().makeScale(worldSize, worldSize, worldSize));

    this._matrix.copy(m);
    this._inverse.copy(m).invert();
    this._dirty = false;
  }

  getProjMatrix(): THREE.Matrix4 {
    if (this._dirty) this._recompute();
    return this._matrix;
  }

  // ── Unprojection (screen px → mercator ground / lngLat) ───────────────────

  unprojectToMercator(px: number, py: number): { x: number; y: number } | null {
    if (this._dirty) this._recompute();
    const nx = (2 * px) / this.width - 1;
    const ny = 1 - (2 * py) / this.height;
    const near = new THREE.Vector3(nx, ny, -1).applyMatrix4(this._inverse);
    const far = new THREE.Vector3(nx, ny, 1).applyMatrix4(this._inverse);
    const dz = near.z - far.z;
    if (Math.abs(dz) < 1e-12) return null;
    const t = near.z / dz;
    if (t < 0 || !isFinite(t)) return null; // above horizon / behind camera
    return {
      x: near.x + (far.x - near.x) * t,
      y: near.y + (far.y - near.y) * t,
    };
  }

  unproject(px: number, py: number): LngLat | null {
    const m = this.unprojectToMercator(px, py);
    if (!m) return null;
    return mercatorToLngLat(m.x, m.y);
  }

  /** Bounding box of the visible ground area (over-estimates under high pitch). */
  getBounds(): GeoBounds {
    const corners: Array<[number, number]> = [
      [0, 0],
      [this.width, 0],
      [this.width, this.height],
      [0, this.height],
    ];
    const center: [number, number] = [this.width / 2, this.height / 2];

    let north = -90;
    let south = 90;
    let east = -180;
    let west = 180;
    let any = false;

    const consider = (ll: LngLat | null) => {
      if (!ll) return;
      any = true;
      north = Math.max(north, ll.lat);
      south = Math.min(south, ll.lat);
      east = Math.max(east, ll.lng);
      west = Math.min(west, ll.lng);
    };

    for (const [sx, sy] of corners) {
      const ll = this.unproject(sx, sy);
      if (ll) {
        consider(ll);
      } else {
        // Corner is above the horizon — walk back toward center to find the
        // farthest valid ground point (bounds the visible trapezoid).
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          const mx = center[0] + (sx - center[0]) * mid;
          const my = center[1] + (sy - center[1]) * mid;
          if (this.unproject(mx, my)) lo = mid;
          else hi = mid;
        }
        const mx = center[0] + (sx - center[0]) * lo;
        const my = center[1] + (sy - center[1]) * lo;
        consider(this.unproject(mx, my));
      }
    }

    if (!any) {
      const c = this.center;
      return { north: c.lat + 1, south: c.lat - 1, east: c.lng + 1, west: c.lng - 1 };
    }
    return { north, south, east, west };
  }

  // ── Gesture transforms ────────────────────────────────────────────────────

  /** Drag the ground point under `prev` to follow `cur` (pan). */
  dragFrom(prevX: number, prevY: number, curX: number, curY: number): void {
    const m0 = this.unprojectToMercator(prevX, prevY);
    const m1 = this.unprojectToMercator(curX, curY);
    if (!m0 || !m1) return;
    const c = lngLatToMercator(this.center.lng, this.center.lat);
    const nx = c.x + (m0.x - m1.x);
    const ny = c.y + (m0.y - m1.y);
    this.center = mercatorToLngLat(nx, ny);
    this.center.lat = clampLat(this.center.lat);
    this._dirty = true;
  }

  /** Zoom by `dZoom` keeping the ground point under (focalX, focalY) fixed. */
  zoomAround(focalX: number, focalY: number, dZoom: number): void {
    const before = this.unprojectToMercator(focalX, focalY);
    this.zoom = this._clampZoom(this.zoom + dZoom);
    this._dirty = true;
    if (!before) return;
    this._recompute();
    const after = this.unprojectToMercator(focalX, focalY);
    if (!after) return;
    const c = lngLatToMercator(this.center.lng, this.center.lat);
    this.center = mercatorToLngLat(c.x + (before.x - after.x), c.y + (before.y - after.y));
    this.center.lat = clampLat(this.center.lat);
    this._dirty = true;
  }

  rotateBy(dBearingDeg: number, dPitchDeg: number): void {
    this.bearing = ((this.bearing + dBearingDeg) % 360 + 360) % 360;
    this.pitch = Math.max(0, Math.min(MAX_PITCH, this.pitch + dPitchDeg));
    this._dirty = true;
  }
}
