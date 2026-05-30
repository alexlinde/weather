/**
 * RadarScene — three.js renderer/scene for the atlas radar tiles.
 *
 * Ported from frontend/radar-layer.js. The MapLibre CustomLayerInterface is
 * replaced by a self-contained RadarCamera (projection matrix) + a host-driven
 * render loop, and browser-only texture decode is replaced by the raw-byte
 * atlas/motion endpoints uploaded straight into DataTextures.
 *
 * Modes:
 *   'composite' — shader takes fmax across 8 bands
 *   '3d'        — 8 stacked planes per tile, one per tilt altitude
 *   'volume'    — ray-marched volumetric rendering through the atlas cube
 */
import * as THREE from 'three';

import { BasemapLayer } from './BasemapLayer';
import { createColorRampData } from './colors';
import { loadAtlasTexels, loadMotionTexels } from './decode';
import { metersToMercatorAlt } from './mercator';
import type { RadarCamera } from './RadarCamera';
import { RADAR_FRAG, RADAR_VERT, VOLUME_FRAG, VOLUME_VERT } from './shaders';
import type { TileCoord, TimestampEntry, ViewMode } from './types';

const RADAR_TILE_MIN_ZOOM = 3;
const RADAR_TILE_MAX_ZOOM = 8;
const RADAR_NUM_BANDS = 8;
const TILT_HEIGHTS_M = [1000, 1500, 2000, 3500, 5500, 9000, 12000, 19000];

interface SceneOptions {
  camera: RadarCamera;
  apiBase: string;
  isMobile: boolean;
  basemapTemplate: string;
  requestRepaint: () => void;
}

function now(): number {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();
}

function buildTileGeometry(z: number, x: number, y: number, mz: number): THREE.BufferGeometry {
  const n = 2 ** z;
  const mx0 = x / n;
  const mx1 = (x + 1) / n;
  const my0 = y / n;
  const my1 = (y + 1) / n;
  const positions = new Float32Array([
    mx0, my0, mz,
    mx1, my0, mz,
    mx0, my1, mz,
    mx1, my1, mz,
  ]);
  const uvs = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex([0, 2, 1, 1, 2, 3]);
  return geo;
}

// ── Tile texture cache ───────────────────────────────────────────────────────

interface TileEntry {
  t: THREE.DataTexture;
  lu: number;
  z: number;
}

class TileTextureCache {
  private _textures = new Map<string, TileEntry>();
  private _loading = new Map<string, Promise<THREE.DataTexture | null>>();

  constructor(
    private _opts: {
      apiBase: string;
      onLoad: () => void;
      maxTextures: number;
      getFormat: () => boolean;
    },
  ) {}

  private _key(ts: string, z: number, x: number, y: number): string {
    return `${ts}/${z}/${x}/${y}`;
  }

  setMaxTextures(n: number): void {
    this._opts.maxTextures = n;
    this._evict();
  }

  has(ts: string, z: number, x: number, y: number): boolean {
    return this._textures.has(this._key(ts, z, x, y));
  }

  get(ts: string, z: number, x: number, y: number): THREE.DataTexture | null {
    const e = this._textures.get(this._key(ts, z, x, y));
    if (e) {
      e.lu = now();
      return e.t;
    }
    return null;
  }

  async load(ts: string, z: number, x: number, y: number): Promise<THREE.DataTexture | null> {
    const k = this._key(ts, z, x, y);
    const existing = this._textures.get(k);
    if (existing) return existing.t;
    const inflight = this._loading.get(k);
    if (inflight) return inflight;
    const p = this._doLoad(k, ts, z, x, y);
    this._loading.set(k, p);
    try {
      return await p;
    } finally {
      this._loading.delete(k);
    }
  }

  private async _doLoad(
    k: string,
    ts: string,
    z: number,
    x: number,
    y: number,
  ): Promise<THREE.DataTexture | null> {
    const data = await loadAtlasTexels(this._opts.apiBase, ts, z, x, y);
    if (!data) return null;
    // R8 single-channel (WebGL2). getFormat() is kept for future fallback paths.
    void this._opts.getFormat();
    const tex = new THREE.DataTexture(data, 256, 2048, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.flipY = true;
    tex.needsUpdate = true;
    this._textures.set(k, { t: tex, lu: now(), z });
    this._evict();
    this._opts.onLoad();
    return tex;
  }

  private _evict(): void {
    if (this._textures.size <= this._opts.maxTextures) return;
    const arr = [...this._textures.entries()].sort((a, b) => a[1].lu - b[1].lu);
    for (const [k, e] of arr.slice(0, arr.length - this._opts.maxTextures)) {
      e.t.dispose();
      this._textures.delete(k);
    }
  }

  evictByZ(keepZs: Set<number>): void {
    for (const [k, e] of this._textures) {
      if (!keepZs.has(e.z)) {
        e.t.dispose();
        this._textures.delete(k);
      }
    }
  }

  clear(): void {
    for (const [, e] of this._textures) e.t.dispose();
    this._textures.clear();
  }
}

// ── Motion texture cache ─────────────────────────────────────────────────────

class MotionTextureCache {
  private _textures = new Map<string, { t: THREE.DataTexture; lu: number }>();
  private _loading = new Map<string, Promise<THREE.DataTexture | null>>();

  constructor(
    private _opts: { apiBase: string; onLoad: () => void; maxTextures: number },
  ) {}

  has(ts: string): boolean {
    return this._textures.has(ts);
  }

  get(ts: string): THREE.DataTexture | null {
    const e = this._textures.get(ts);
    if (e) {
      e.lu = now();
      return e.t;
    }
    return null;
  }

  async load(ts: string): Promise<THREE.DataTexture | null> {
    const existing = this._textures.get(ts);
    if (existing) return existing.t;
    const inflight = this._loading.get(ts);
    if (inflight) return inflight;
    const p = this._doLoad(ts);
    this._loading.set(ts, p);
    try {
      return await p;
    } finally {
      this._loading.delete(ts);
    }
  }

  private async _doLoad(ts: string): Promise<THREE.DataTexture | null> {
    const m = await loadMotionTexels(this._opts.apiBase, ts);
    if (!m) return null;
    // RGB → RGBA (three DataTexture RGBFormat is removed in WebGL2); pad alpha.
    const rgba = new Uint8Array(m.width * m.height * 4);
    for (let i = 0, j = 0; i < m.width * m.height; i++, j += 3) {
      const o = i * 4;
      rgba[o] = m.data[j];
      rgba[o + 1] = m.data[j + 1];
      rgba[o + 2] = m.data[j + 2];
      rgba[o + 3] = 255;
    }
    const tex = new THREE.DataTexture(rgba, m.width, m.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.flipY = true;
    tex.needsUpdate = true;
    this._textures.set(ts, { t: tex, lu: now() });
    this._evict();
    this._opts.onLoad();
    return tex;
  }

  private _evict(): void {
    if (this._textures.size <= this._opts.maxTextures) return;
    const arr = [...this._textures.entries()].sort((a, b) => a[1].lu - b[1].lu);
    for (const [k, e] of arr.slice(0, arr.length - this._opts.maxTextures)) {
      e.t.dispose();
      this._textures.delete(k);
    }
  }

  clear(): void {
    for (const [, e] of this._textures) e.t.dispose();
    this._textures.clear();
  }
}

// ── Radar scene ──────────────────────────────────────────────────────────────

export class RadarScene {
  private _cam: RadarCamera;
  private _apiBase: string;
  private _isMobile: boolean;
  private _requestRepaint: () => void;

  private _maxTileTextures: number;
  private _maxMotionTextures: number;
  private _volumeAtlasHeight: number;

  private _mode: ViewMode = 'composite';
  private _opacity = 0.8;
  private _vertExag = 1.0;
  private _dbzMin = -30.0;
  private _dbzMax = 100.0;

  private _frameA = 0;
  private _frameB = 0;
  private _timeMix = 0;
  private _timestamps: TimestampEntry[] = [];

  private _useRedFormat = false;
  private _tileLoadGen = 0;

  private _tileCache: TileTextureCache;
  private _motionCache: MotionTextureCache;
  private _motionBounds = new THREE.Vector4(-130, 20, -60, 55);
  private _maxDispDeg = 0.5;

  private _visibleTiles: TileCoord[] = [];
  private _pendingTiles: TileCoord[] | null = null;
  private _pendingTilesTimer: ReturnType<typeof setTimeout> | null = null;

  private _renderer: THREE.WebGLRenderer | null = null;
  private _scene: THREE.Scene | null = null;
  private _camera: THREE.Camera | null = null;
  private _colorRampTex: THREE.DataTexture | null = null;
  private _tileMeshes = new Map<string, THREE.Mesh>();
  private _staleMeshes: THREE.Mesh[] = [];
  private _stalePurgeTimer: ReturnType<typeof setTimeout> | null = null;
  private _dummyTex: THREE.DataTexture | null = null;
  private _currentMatrix: Float32Array | null = null;
  private _camPosVec = new THREE.Vector3();

  private _basemap: BasemapLayer | null = null;

  // Volume resources
  private _volAtlasDataA: Uint8Array<ArrayBuffer> | null = null;
  private _volAtlasDataB: Uint8Array<ArrayBuffer> | null = null;
  private _volAtlasA: THREE.DataTexture | null = null;
  private _volAtlasB: THREE.DataTexture | null = null;
  private _volLayout: {
    z: number;
    n: number;
    minX: number;
    minY: number;
    numX: number;
    numY: number;
    totalTiles: number;
  } | null = null;
  private _volLastKeyA = '';
  private _volLastKeyB = '';

  constructor(opts: SceneOptions) {
    this._cam = opts.camera;
    this._apiBase = opts.apiBase;
    this._isMobile = opts.isMobile;
    this._requestRepaint = opts.requestRepaint;

    this._maxTileTextures = this._isMobile ? 80 : 150;
    this._maxMotionTextures = this._isMobile ? 20 : 40;
    this._volumeAtlasHeight = this._isMobile ? 1024 : 2048;

    this._tileCache = new TileTextureCache({
      apiBase: this._apiBase,
      onLoad: () => {
        this._tileLoadGen++;
        this._checkPendingReady();
        this._requestRepaint();
      },
      maxTextures: this._maxTileTextures,
      getFormat: () => this._useRedFormat,
    });
    this._motionCache = new MotionTextureCache({
      apiBase: this._apiBase,
      onLoad: () => this._requestRepaint(),
      maxTextures: this._maxMotionTextures,
    });

    this._basemapTemplate = opts.basemapTemplate;
  }

  private _basemapTemplate: string;

  // ── Public API ─────────────────────────────────────────────────────────

  setTimestamps(ts: TimestampEntry[]): void {
    this._timestamps = ts;
  }

  setMotionConfig(bounds: { west: number; south: number; east: number; north: number } | undefined, maxDispDeg?: number): void {
    if (bounds) {
      this._motionBounds.set(bounds.west, bounds.south, bounds.east, bounds.north);
    }
    if (maxDispDeg != null) this._maxDispDeg = maxDispDeg;
  }

  setBasemapTemplate(template: string): void {
    this._basemapTemplate = template;
    this._basemap?.setTemplate(template);
  }

  async ensureMotion(frameIdx: number): Promise<void> {
    const entry = this._timestamps[frameIdx];
    if (!entry?.has_motion || !entry?.timestamp) return;
    await this._motionCache.load(entry.timestamp);
  }

  hasMotionForFrame(frameIdx: number): boolean {
    const entry = this._timestamps[frameIdx];
    if (!entry?.has_motion) return true;
    return this._motionCache.has(entry.timestamp);
  }

  prefetchMotion(startIdx: number, count: number): void {
    const len = this._timestamps.length;
    if (len === 0) return;
    for (let i = 0; i < count; i++) {
      const idx = (startIdx + i) % len;
      const entry = this._timestamps[idx];
      if (entry?.has_motion && entry?.timestamp) {
        this._motionCache.load(entry.timestamp);
      }
    }
  }

  setAnimation(frameA: number, frameB: number, mix: number): void {
    this._frameA = frameA;
    this._frameB = frameB;
    this._timeMix = mix;
    this._requestRepaint();
  }

  setMode(mode: ViewMode): void {
    this._mode = mode;
    this._rebuildMeshes();
    this._requestRepaint();
  }

  setOpacity(val: number): void {
    this._opacity = val;
    this._requestRepaint();
  }

  setVerticalExaggeration(val: number): void {
    this._vertExag = val;
    this._rebuildMeshes();
    this._requestRepaint();
  }

  setDbzRange(min: number, max: number): void {
    this._dbzMin = min;
    this._dbzMax = max;
    this._requestRepaint();
  }

  updateVisibleTiles(): void {
    const tiles = this._computeVisibleTiles();
    if (tiles.length === 0) return;

    if (this._pendingTilesTimer) clearTimeout(this._pendingTilesTimer);

    if (this._tileMeshes.size === 0) {
      this._pendingTiles = null;
      this._visibleTiles = tiles;
      this._updateTileCacheSize();
      this._rebuildMeshes();
      return;
    }

    if (this._tilesKey(tiles) === this._tilesKey(this._visibleTiles)) {
      this._pendingTiles = null;
      return;
    }

    this._pendingTiles = tiles;
    this._updateTileCacheSize();
    this._pendingTilesTimer = setTimeout(() => this._applyPendingTiles(), 3000);
    this._startPrefetchPending();
    this._checkPendingReady();
  }

  private _updateTileCacheSize(): void {
    const n = Math.max(this._visibleTiles.length, this._pendingTiles?.length || 0);
    const target = Math.min(this._maxTileTextures, Math.max(24, n * 6));
    this._tileCache.setMaxTextures(target);
  }

  private _computeVisibleTiles(): TileCoord[] {
    const bounds = this._cam.getBounds();
    const zoom = Math.round(this._cam.getZoom());
    const z = Math.max(RADAR_TILE_MIN_ZOOM, Math.min(RADAR_TILE_MAX_ZOOM, zoom));
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
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ z, x, y });
      }
    }
    return tiles;
  }

  private _tilesKey(tiles: TileCoord[]): string {
    return tiles.map((t) => `${t.z}/${t.x}/${t.y}`).join(',');
  }

  private _startPrefetchPending(): void {
    if (!this._pendingTiles || !this._timestamps.length) return;
    const tsA = this._timestamps[this._frameA]?.timestamp;
    const tsB = this._timestamps[this._frameB]?.timestamp;
    if (!tsA) return;
    for (const { z, x, y } of this._pendingTiles) {
      this._tileCache.load(tsA, z, x, y);
      if (tsB && tsB !== tsA) this._tileCache.load(tsB, z, x, y);
    }
  }

  private _checkPendingReady(): void {
    if (!this._pendingTiles || !this._timestamps.length) return;
    const tsA = this._timestamps[this._frameA]?.timestamp;
    if (!tsA) return;
    for (const { z, x, y } of this._pendingTiles) {
      if (!this._tileCache.has(tsA, z, x, y)) {
        this._tileCache.load(tsA, z, x, y);
        return;
      }
    }
    this._applyPendingTiles();
  }

  private _applyPendingTiles(): void {
    if (!this._pendingTiles) return;
    if (this._pendingTilesTimer) clearTimeout(this._pendingTilesTimer);
    this._visibleTiles = this._pendingTiles;
    this._pendingTiles = null;
    this._updateTileCacheSize();
    this._rebuildMeshes();
  }

  async ensureTextures(frameA: number, frameB: number): Promise<void> {
    if (!this._timestamps.length) return;
    const tsA = this._timestamps[frameA]?.timestamp;
    const tsB = this._timestamps[frameB]?.timestamp;
    if (!tsA) return;
    const promises: Promise<unknown>[] = [];
    const tileSets = this._pendingTiles
      ? [this._visibleTiles, this._pendingTiles]
      : [this._visibleTiles];
    for (const tiles of tileSets) {
      for (const { z, x, y } of tiles) {
        promises.push(this._tileCache.load(tsA, z, x, y));
        if (tsB && tsB !== tsA) promises.push(this._tileCache.load(tsB, z, x, y));
      }
    }
    await Promise.all(promises);
  }

  prefetchFrames(startIdx: number, count: number): void {
    const len = this._timestamps.length;
    if (len === 0) return;
    const tileSets = this._pendingTiles
      ? [this._visibleTiles, this._pendingTiles]
      : [this._visibleTiles];
    for (let i = 0; i < count; i++) {
      const idx = (startIdx + i) % len;
      const ts = this._timestamps[idx]?.timestamp;
      if (!ts) continue;
      for (const tiles of tileSets) {
        for (const { z, x, y } of tiles) this._tileCache.load(ts, z, x, y);
      }
    }
  }

  hasTexturesForFrame(frameIdx: number): boolean {
    const ts = this._timestamps[frameIdx]?.timestamp;
    if (!ts) return false;
    for (const { z, x, y } of this._visibleTiles) {
      if (!this._tileCache.has(ts, z, x, y)) return false;
    }
    return true;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  init(renderer: THREE.WebGLRenderer): void {
    this._renderer = renderer;
    this._renderer.autoClear = false;
    this._renderer.setClearColor(0x0d1117, 1);
    this._scene = new THREE.Scene();

    this._camera = new THREE.Camera();
    this._camera.matrixWorldInverse.identity();
    this._camera.matrixWorldNeedsUpdate = false;

    this._colorRampTex = this._buildColorRampTexture();
    this._dummyTex = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
    this._dummyTex.needsUpdate = true;

    this._useRedFormat = !!(this._renderer.capabilities as { isWebGL2?: boolean }).isWebGL2;

    this._basemap = new BasemapLayer(this._scene, {
      template: this._basemapTemplate,
      isMobile: this._isMobile,
      requestRepaint: this._requestRepaint,
    });
  }

  resize(width: number, height: number, dpr: number): void {
    if (!this._renderer) return;
    this._renderer.setPixelRatio(1); // we pre-multiply size by dpr ourselves
    this._renderer.setSize(Math.round(width * dpr), Math.round(height * dpr), false);
  }

  render(): void {
    if (!this._renderer || !this._scene || !this._camera) return;

    const proj = this._cam.getProjMatrix();
    this._currentMatrix = proj.elements as unknown as Float32Array;
    this._camera.projectionMatrix.copy(proj);
    this._camera.projectionMatrixInverse.copy(proj).invert();

    // Basemap first (renderOrder 0), then radar (renderOrder >= 1).
    this._basemap?.update(this._cam);

    if (this._timestamps.length) this._updateMaterials();

    this._renderer.clear();
    this._renderer.render(this._scene, this._camera);
  }

  dispose(): void {
    this._tileCache.clear();
    this._motionCache.clear();
    this._clearMeshes();
    this._disposeVolumeResources();
    this._basemap?.dispose();
    this._colorRampTex?.dispose();
    this._dummyTex?.dispose();
  }

  // ── three.js helpers ───────────────────────────────────────────────────

  private _buildColorRampTexture(): THREE.DataTexture {
    const data = createColorRampData();
    const tex = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  // ── Mesh management ────────────────────────────────────────────────────

  private _rebuildMeshes(): void {
    if (!this._scene) return;

    for (const [, mesh] of this._tileMeshes) {
      this._staleMeshes.push(mesh);
    }
    this._tileMeshes.clear();

    if (this._mode !== 'volume') {
      this._disposeVolumeResources();
    }

    if (this._mode === 'volume') {
      this._buildVolumeMesh();
    } else {
      for (const { z, x, y } of this._visibleTiles) {
        if (this._mode === 'composite') {
          this._addTileMesh(z, x, y, 0, -1);
        } else {
          for (let band = 0; band < RADAR_NUM_BANDS; band++) {
            const mz = metersToMercatorAlt(TILT_HEIGHTS_M[band] * this._vertExag);
            this._addTileMesh(z, x, y, mz, band);
          }
        }
      }
    }

    this._pruneCrossZoomTiles();

    if (this._stalePurgeTimer) clearTimeout(this._stalePurgeTimer);
    this._stalePurgeTimer = setTimeout(() => this._purgeStale(), 3000);
  }

  private _pruneCrossZoomTiles(): void {
    const keep = new Set<number>();
    for (const t of this._visibleTiles) keep.add(t.z);
    if (this._pendingTiles) for (const t of this._pendingTiles) keep.add(t.z);
    if (keep.size > 0) this._tileCache.evictByZ(keep);
  }

  private _disposeVolumeResources(): void {
    if (this._volAtlasA) {
      this._volAtlasA.dispose();
      this._volAtlasA = null;
    }
    if (this._volAtlasB) {
      this._volAtlasB.dispose();
      this._volAtlasB = null;
    }
    this._volAtlasDataA = null;
    this._volAtlasDataB = null;
    this._volLayout = null;
    this._volLastKeyA = '';
    this._volLastKeyB = '';
  }

  private _addTileMesh(z: number, x: number, y: number, mz: number, tiltIndex: number): void {
    if (!this._scene) return;
    const geo = buildTileGeometry(z, x, y, mz);
    const mat = new THREE.ShaderMaterial({
      vertexShader: RADAR_VERT,
      fragmentShader: RADAR_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        u_tex0: { value: this._dummyTex },
        u_tex1: { value: this._dummyTex },
        u_colorRamp: { value: this._colorRampTex },
        u_timeMix: { value: 0 },
        u_opacity: { value: this._opacity },
        u_tiltIndex: { value: tiltIndex },
        u_dbzMin: { value: this._dbzMin },
        u_dbzMax: { value: this._dbzMax },
        u_motionTex: { value: this._dummyTex },
        u_hasMotion: { value: 0.0 },
        u_tileX: { value: x },
        u_tileY: { value: y },
        u_tileZ: { value: z },
        u_motionBounds: { value: this._motionBounds },
        u_maxDispDeg: { value: this._maxDispDeg },
      },
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    mesh.userData = { z, x, y };
    this._scene.add(mesh);
    this._tileMeshes.set(`${z}/${x}/${y}/${tiltIndex}`, mesh);
  }

  private _buildVolumeMesh(): void {
    if (!this._scene) return;
    const tiles = this._visibleTiles;
    if (tiles.length === 0) return;

    const z = tiles[0].z;
    const n = 2 ** z;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const t of tiles) {
      minX = Math.min(minX, t.x);
      maxX = Math.max(maxX, t.x);
      minY = Math.min(minY, t.y);
      maxY = Math.max(maxY, t.y);
    }
    const numX = maxX - minX + 1;
    const numY = maxY - minY + 1;
    const totalTiles = numX * numY;

    this._volLayout = { z, n, minX, minY, numX, numY, totalTiles };
    this._volLastKeyA = '';
    this._volLastKeyB = '';

    const aw = totalTiles * 256;
    const ah = this._volumeAtlasHeight;
    const needResize =
      !this._volAtlasA ||
      this._volAtlasA.image.width !== aw ||
      this._volAtlasA.image.height !== ah;

    if (needResize) {
      if (this._volAtlasA) this._volAtlasA.dispose();
      if (this._volAtlasB) this._volAtlasB.dispose();

      const format = THREE.RedFormat;
      this._volAtlasDataA = new Uint8Array(aw * ah);
      this._volAtlasDataB = new Uint8Array(aw * ah);

      this._volAtlasA = new THREE.DataTexture(this._volAtlasDataA, aw, ah, format, THREE.UnsignedByteType);
      this._volAtlasA.flipY = false;
      this._volAtlasA.magFilter = THREE.LinearFilter;
      this._volAtlasA.minFilter = THREE.LinearFilter;
      this._volAtlasA.wrapS = THREE.ClampToEdgeWrapping;
      this._volAtlasA.wrapT = THREE.ClampToEdgeWrapping;
      this._volAtlasA.generateMipmaps = false;
      this._volAtlasA.needsUpdate = true;

      this._volAtlasB = new THREE.DataTexture(this._volAtlasDataB, aw, ah, format, THREE.UnsignedByteType);
      this._volAtlasB.flipY = false;
      this._volAtlasB.magFilter = THREE.LinearFilter;
      this._volAtlasB.minFilter = THREE.LinearFilter;
      this._volAtlasB.wrapS = THREE.ClampToEdgeWrapping;
      this._volAtlasB.wrapT = THREE.ClampToEdgeWrapping;
      this._volAtlasB.generateMipmaps = false;
      this._volAtlasB.needsUpdate = true;
    }

    const mzMax = metersToMercatorAlt(TILT_HEIGHTS_M[RADAR_NUM_BANDS - 1] * this._vertExag);
    const mx0 = minX / n;
    const my0 = minY / n;
    const mx1 = (maxX + 1) / n;
    const my1 = (maxY + 1) / n;

    const geo = new THREE.BoxGeometry(mx1 - mx0, my1 - my0, mzMax);
    geo.translate((mx0 + mx1) / 2, (my0 + my1) / 2, mzMax / 2);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VOLUME_VERT,
      fragmentShader: VOLUME_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        u_cameraPos: { value: new THREE.Vector3() },
        u_tex0: { value: this._volAtlasA },
        u_tex1: { value: this._volAtlasB },
        u_colorRamp: { value: this._colorRampTex },
        u_timeMix: { value: 0 },
        u_opacity: { value: this._opacity },
        u_dbzMin: { value: this._dbzMin },
        u_dbzMax: { value: this._dbzMax },
        u_boxMin: { value: new THREE.Vector3(mx0, my0, 0) },
        u_boxMax: { value: new THREE.Vector3(mx1, my1, mzMax) },
        u_steps: { value: 48.0 },
        u_tileZoom: { value: z },
        u_tileOrigin: { value: new THREE.Vector2(minX, minY) },
        u_tileCount: { value: new THREE.Vector2(numX, numY) },
        u_numAtlasCols: { value: totalTiles },
      },
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    mesh.userData = { isVolume: true };
    this._scene.add(mesh);
    this._tileMeshes.set('volume', mesh);
  }

  private _updateMaterials(): void {
    if (!this._timestamps.length) return;
    const tsA = this._timestamps[this._frameA]?.timestamp;
    const tsB = this._timestamps[this._frameB]?.timestamp;
    if (!tsA) return;

    if (this._mode === 'volume') {
      this._updateVolumeMaterial(tsA, tsB);
      return;
    }

    const entryA = this._timestamps[this._frameA];
    const motionTex = entryA?.has_motion ? this._motionCache.get(tsA) : null;
    const hasMotion = motionTex ? 1.0 : 0.0;

    let allTextured = true;
    for (const [, mesh] of this._tileMeshes) {
      const ud = mesh.userData as { z: number; x: number; y: number };
      const texA = this._tileCache.get(tsA, ud.z, ud.x, ud.y);
      const u = (mesh.material as THREE.ShaderMaterial).uniforms;

      if (texA) {
        const texB = tsB && tsB !== tsA ? this._tileCache.get(tsB, ud.z, ud.x, ud.y) : null;
        u.u_tex0.value = texA;
        u.u_tex1.value = texB || texA;
        u.u_timeMix.value = texB ? this._timeMix : 0;
        mesh.visible = true;
      } else {
        allTextured = false;
        if (u.u_tex0.value === this._dummyTex) {
          mesh.visible = false;
        }
      }

      u.u_opacity.value = this._opacity;
      u.u_dbzMin.value = this._dbzMin;
      u.u_dbzMax.value = this._dbzMax;
      u.u_motionTex.value = motionTex || this._dummyTex;
      u.u_hasMotion.value = hasMotion;
      u.u_maxDispDeg.value = this._maxDispDeg;
    }

    if (allTextured && this._staleMeshes.length > 0) {
      this._purgeStale();
    }
  }

  private _updateVolumeMaterial(tsA: string, tsB: string | undefined): void {
    const volMesh = this._tileMeshes.get('volume');
    if (!volMesh || !this._volLayout || !this._volAtlasA) return;

    const u = (volMesh.material as THREE.ShaderMaterial).uniforms;

    const cam = this._extractCameraPosition();
    if (cam) (u.u_cameraPos.value as THREE.Vector3).copy(cam);

    u.u_opacity.value = this._opacity;
    u.u_dbzMin.value = this._dbzMin;
    u.u_dbzMax.value = this._dbzMax;
    u.u_timeMix.value = tsB && tsB !== tsA ? this._timeMix : 0;

    const gen = this._tileLoadGen;
    const keyA = `${tsA}|${gen}`;
    if (this._volLastKeyA !== keyA && this._volAtlasDataA) {
      const any = this._drawVolAtlas(this._volAtlasDataA, tsA);
      this._volAtlasA.needsUpdate = true;
      this._volLastKeyA = keyA;
      volMesh.visible = any;
    }

    if (tsB && tsB !== tsA && this._volAtlasB && this._volAtlasDataB) {
      const keyB = `${tsB}|${gen}`;
      if (this._volLastKeyB !== keyB) {
        this._drawVolAtlas(this._volAtlasDataB, tsB);
        this._volAtlasB.needsUpdate = true;
        this._volLastKeyB = keyB;
      }
    }

    if (volMesh.visible && this._staleMeshes.length > 0) {
      this._purgeStale();
    }
  }

  private _drawVolAtlas(dstArr: Uint8Array, timestamp: string): boolean {
    const layout = this._volLayout;
    if (!layout || !this._volAtlasA) return false;
    const aw = this._volAtlasA.image.width;
    const ah = this._volAtlasA.image.height;
    dstArr.fill(0);
    let anyDrawn = false;
    const yStride = 2048 / ah; // 1 on desktop, 2 on mobile
    for (const { z, x, y } of this._visibleTiles) {
      const tex = this._tileCache.get(timestamp, z, x, y);
      const src = tex?.image?.data as Uint8Array | undefined;
      if (!src || src.length !== 256 * 2048) continue;
      const col = x - layout.minX + (y - layout.minY) * layout.numX;
      const colOffset = col * 256;
      for (let row = 0; row < ah; row++) {
        const srcRow = row * yStride;
        dstArr.set(src.subarray(srcRow * 256, srcRow * 256 + 256), row * aw + colOffset);
      }
      anyDrawn = true;
    }
    return anyDrawn;
  }

  private _extractCameraPosition(): THREE.Vector3 | null {
    if (!this._currentMatrix) return null;
    const m = this._currentMatrix;
    const a00 = m[0], a01 = m[4], a02 = m[8], b0 = -m[12];
    const a10 = m[1], a11 = m[5], a12 = m[9], b1 = -m[13];
    const a20 = m[3], a21 = m[7], a22 = m[11], b2 = -m[15];
    const det =
      a00 * (a11 * a22 - a12 * a21) -
      a01 * (a10 * a22 - a12 * a20) +
      a02 * (a10 * a21 - a11 * a20);
    if (Math.abs(det) < 1e-20) return null;
    const invDet = 1 / det;
    const cx = (b0 * (a11 * a22 - a12 * a21) - a01 * (b1 * a22 - a12 * b2) + a02 * (b1 * a21 - a11 * b2)) * invDet;
    const cy = (a00 * (b1 * a22 - a12 * b2) - b0 * (a10 * a22 - a12 * a20) + a02 * (a10 * b2 - b1 * a20)) * invDet;
    const cz = (a00 * (a11 * b2 - b1 * a21) - a01 * (a10 * b2 - b1 * a20) + b0 * (a10 * a21 - a11 * a20)) * invDet;
    return this._camPosVec.set(cx, cy, cz);
  }

  private _purgeStale(): void {
    for (const mesh of this._staleMeshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this._scene?.remove(mesh);
    }
    this._staleMeshes.length = 0;
    if (this._stalePurgeTimer) clearTimeout(this._stalePurgeTimer);
  }

  private _clearMeshes(): void {
    this._purgeStale();
    for (const [, mesh] of this._tileMeshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this._scene?.remove(mesh);
    }
    this._tileMeshes.clear();
  }
}
