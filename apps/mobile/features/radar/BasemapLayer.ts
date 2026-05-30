/**
 * BasemapLayer — raster basemap tiles rendered as textured mercator ground quads
 * beneath the radar meshes. Replaces the MapLibre vector basemap.
 */
import * as THREE from 'three';

import { loadRasterTexture } from './basemapTexture';
import type { RadarCamera } from './RadarCamera';
import type { RadarConfig, TileCoord } from './types';

const MIN_BASE_ZOOM = 2;
const MAX_BASE_ZOOM = 16;

export function basemapUrlTemplate(config: RadarConfig | null): string {
  if (config?.maptiler_api_key) {
    return `https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key=${config.maptiler_api_key}`;
  }
  // Free, no-key dark raster basemap (fits the app's dark theme).
  return 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
}

function tileUrl(template: string, z: number, x: number, y: number): string {
  return template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

function buildGroundQuad(z: number, x: number, y: number): THREE.BufferGeometry {
  const n = 2 ** z;
  const mx0 = x / n;
  const mx1 = (x + 1) / n;
  const my0 = y / n;
  const my1 = (y + 1) / n;
  const positions = new Float32Array([
    mx0, my0, 0,
    mx1, my0, 0,
    mx0, my1, 0,
    mx1, my1, 0,
  ]);
  const uvs = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex([0, 2, 1, 1, 2, 3]);
  return geo;
}

export class BasemapLayer {
  private _scene: THREE.Scene;
  private _template: string;
  private _maxTextures: number;
  private _requestRepaint: () => void;

  private _meshes = new Map<string, THREE.Mesh>();
  private _textures = new Map<string, { tex: THREE.Texture; lu: number }>();
  private _loading = new Set<string>();
  private _visible: TileCoord[] = [];
  private _key = '';

  constructor(
    scene: THREE.Scene,
    opts: { template: string; isMobile: boolean; requestRepaint: () => void },
  ) {
    this._scene = scene;
    this._template = opts.template;
    this._maxTextures = opts.isMobile ? 60 : 120;
    this._requestRepaint = opts.requestRepaint;
  }

  setTemplate(template: string): void {
    if (template === this._template) return;
    this._template = template;
    this._clearAll();
  }

  private _computeTiles(cam: RadarCamera): TileCoord[] {
    const bounds = cam.getBounds();
    const zoom = Math.round(cam.getZoom());
    const z = Math.max(MIN_BASE_ZOOM, Math.min(MAX_BASE_ZOOM, zoom));
    const n = 2 ** z;
    const xMin = Math.max(0, Math.floor(((bounds.west + 180) / 360) * n));
    const xMax = Math.min(n - 1, Math.floor(((bounds.east + 180) / 360) * n));
    const latToY = (lat: number) => {
      const rad = (lat * Math.PI) / 180;
      return Math.floor(
        ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
      );
    };
    const yMin = Math.max(0, latToY(bounds.north));
    const yMax = Math.min(n - 1, latToY(bounds.south));
    const tiles: TileCoord[] = [];
    // Cap tile count to avoid runaway loads at extreme aspect ratios.
    for (let x = xMin; x <= xMax && tiles.length < 64; x++) {
      for (let y = yMin; y <= yMax && tiles.length < 64; y++) {
        tiles.push({ z, x, y });
      }
    }
    return tiles;
  }

  update(cam: RadarCamera): void {
    const tiles = this._computeTiles(cam);
    const key = tiles.map((t) => `${t.z}/${t.x}/${t.y}`).join(',');
    if (key !== this._key) {
      this._key = key;
      this._visible = tiles;
      this._rebuildMeshes();
    }
    this._assignTextures();
  }

  private _texKey(z: number, x: number, y: number): string {
    return `${z}/${x}/${y}`;
  }

  private _rebuildMeshes(): void {
    // Remove meshes no longer visible.
    const wanted = new Set(this._visible.map((t) => this._texKey(t.z, t.x, t.y)));
    for (const [k, mesh] of this._meshes) {
      if (!wanted.has(k)) {
        this._scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this._meshes.delete(k);
      }
    }
    for (const { z, x, y } of this._visible) {
      const k = this._texKey(z, x, y);
      if (this._meshes.has(k)) continue;
      const geo = buildGroundQuad(z, x, y);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: 1,
      });
      mat.map = null;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 0; // beneath radar meshes (renderOrder >= 1)
      mesh.visible = false;
      this._scene.add(mesh);
      this._meshes.set(k, mesh);
      this._load(z, x, y);
    }
  }

  private _assignTextures(): void {
    for (const { z, x, y } of this._visible) {
      const k = this._texKey(z, x, y);
      const mesh = this._meshes.get(k);
      const entry = this._textures.get(k);
      if (mesh && entry) {
        entry.lu = Date.now();
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (mat.map !== entry.tex) {
          mat.map = entry.tex;
          mat.needsUpdate = true;
        }
        mesh.visible = true;
      } else if (mesh && !entry) {
        this._load(z, x, y);
      }
    }
  }

  private async _load(z: number, x: number, y: number): Promise<void> {
    const k = this._texKey(z, x, y);
    if (this._textures.has(k) || this._loading.has(k)) return;
    this._loading.add(k);
    const tex = await loadRasterTexture(tileUrl(this._template, z, x, y));
    this._loading.delete(k);
    if (!tex) return;
    this._textures.set(k, { tex, lu: Date.now() });
    this._evict();
    this._requestRepaint();
  }

  private _evict(): void {
    if (this._textures.size <= this._maxTextures) return;
    const arr = [...this._textures.entries()].sort((a, b) => a[1].lu - b[1].lu);
    const visibleKeys = new Set(this._visible.map((t) => this._texKey(t.z, t.x, t.y)));
    for (const [k, e] of arr) {
      if (this._textures.size <= this._maxTextures) break;
      if (visibleKeys.has(k)) continue;
      e.tex.dispose();
      this._textures.delete(k);
    }
  }

  private _clearAll(): void {
    for (const [, mesh] of this._meshes) {
      this._scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this._meshes.clear();
    for (const [, e] of this._textures) e.tex.dispose();
    this._textures.clear();
    this._key = '';
    this._visible = [];
  }

  dispose(): void {
    this._clearAll();
  }
}
