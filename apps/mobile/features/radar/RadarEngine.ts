/**
 * RadarEngine — framework-independent radar animation + data engine.
 *
 * Ported from frontend/radar-engine.js. Manages timestamps, the animation loop,
 * gap-aware frame timing, presets, prefetch, and auto-refresh. Drives a
 * RadarScene (the three.js renderer) and emits state changes to any UI layer.
 */

import type { RadarScene } from './RadarScene';
import type {
  FrameUpdate,
  PresetKey,
  PresetValues,
  TimestampEntry,
  TimestampsResponse,
  ViewMode,
} from './types';

export const RADAR_PRESETS: Record<PresetKey, PresetValues | null> = {
  all: { dbzMin: 5, dbzMax: 75, intensity: 0.8 },
  precip: { dbzMin: 15, dbzMax: 75, intensity: 0.85 },
  severe: { dbzMin: 40, dbzMax: 75, intensity: 0.95 },
  custom: null,
};

const MAX_503_RETRIES = 24;
const REFRESH_INTERVAL_MS = 120_000;
const VIEWPORT_DEBOUNCE_MS = 300;

export function formatTimestamp(iso?: string | null): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimestampFull(iso?: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('en-US', { hour12: false });
}

// ── Engine event map ─────────────────────────────────────────────────────────

interface EngineEvents {
  status: { state: string; message: string };
  frame: FrameUpdate;
  timestamps: { count: number; timestamps: TimestampEntry[] };
  playstate: { playing: boolean };
  viewmode: { mode: ViewMode };
  preset: { preset: PresetKey; values: PresetValues | null };
}

type Listener<K extends keyof EngineEvents> = (detail: EngineEvents[K]) => void;

export class RadarEngine {
  timestamps: TimestampEntry[] = [];
  currentAnimationTime = 0;
  playing = false;
  frameInterval = 500;
  viewMode: ViewMode = 'composite';
  activePreset: PresetKey = 'all';
  opacity = 0.8;
  verticalExaggeration = 1.0;
  dbzMin = 5;
  dbzMax = 75;

  private _apiBase: string;
  private _isMobile: boolean;
  private _prefetchAhead: number;
  private _prefetchBurst: number;

  private _scene: RadarScene | null = null;
  private _animationId: number | null = null;
  private _lastAnimTime = 0;
  private _fetchAbort: AbortController | null = null;
  private _timestampFetchRetries = 0;
  private _refreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private _viewportDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _frameWeights: Float32Array | null = null;
  private _expectedCadence = 120;
  private _retryTimer: ReturnType<typeof setTimeout> | null = null;

  private _listeners = new Map<keyof EngineEvents, Set<(detail: never) => void>>();

  constructor(opts: { apiBase: string; isMobile: boolean }) {
    this._apiBase = opts.apiBase;
    this._isMobile = opts.isMobile;
    this._prefetchAhead = opts.isMobile ? 3 : 5;
    this._prefetchBurst = opts.isMobile ? 5 : 10;
  }

  // ── Events ────────────────────────────────────────────────────────────

  on<K extends keyof EngineEvents>(type: K, fn: Listener<K>): () => void {
    let set = this._listeners.get(type);
    if (!set) {
      set = new Set();
      this._listeners.set(type, set);
    }
    const stored = fn as (detail: never) => void;
    set.add(stored);
    return () => set?.delete(stored);
  }

  private _emit<K extends keyof EngineEvents>(type: K, detail: EngineEvents[K]): void {
    const set = this._listeners.get(type);
    if (set) for (const fn of set) (fn as Listener<K>)(detail);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  attachScene(scene: RadarScene): void {
    this._scene = scene;
    scene.setTimestamps(this.timestamps);
    if (this.viewMode !== 'composite') scene.setMode(this.viewMode);
  }

  async start(): Promise<void> {
    const ok = await this.fetchTimestamps();
    if (ok && this.timestamps.length > 0 && this._scene) {
      this._scene.updateVisibleTiles();
      await this.loadAndShowFrame();
    }
    this.startAutoRefresh();
  }

  startAutoRefresh(): void {
    this.stopAutoRefresh();
    this._refreshIntervalId = setInterval(() => this.refresh(), REFRESH_INTERVAL_MS);
  }

  stopAutoRefresh(): void {
    if (this._refreshIntervalId) {
      clearInterval(this._refreshIntervalId);
      this._refreshIntervalId = null;
    }
  }

  destroy(): void {
    this.pause();
    this.stopAutoRefresh();
    if (this._retryTimer) clearTimeout(this._retryTimer);
    if (this._viewportDebounceTimer) clearTimeout(this._viewportDebounceTimer);
    this._fetchAbort?.abort();
  }

  // ── Timestamps ─────────────────────────────────────────────────────────

  async fetchTimestamps(): Promise<boolean> {
    if (this._fetchAbort) this._fetchAbort.abort();
    this._fetchAbort = new AbortController();

    this._emit('status', { state: 'loading', message: 'Loading timestamps\u2026' });
    try {
      const resp = await fetch(`${this._apiBase}/api/radar/timestamps`, {
        signal: this._fetchAbort.signal,
      });
      if (resp.status === 503) {
        this._timestampFetchRetries++;
        if (this._timestampFetchRetries < MAX_503_RETRIES) {
          this._emit('status', { state: 'loading', message: 'Server seeding cache\u2026' });
          this._retryTimer = setTimeout(() => this.fetchTimestamps(), 5_000);
        } else {
          this._emit('status', { state: 'error', message: 'Server unavailable \u2014 try refreshing' });
        }
        return false;
      }
      this._timestampFetchRetries = 0;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as TimestampsResponse;

      this.timestamps = data.timestamps;
      this.currentAnimationTime = this.timestamps.length - 1;
      if (data.gap_info) this._expectedCadence = data.gap_info.expected_cadence_s || 120;
      this._computeFrameWeights();

      if (this._scene) {
        this._scene.setTimestamps(this.timestamps);
        if (data.motion && this.timestamps.length > 0) {
          this._scene.setMotionConfig(this.timestamps[0].bounds, data.motion.max_disp_deg);
        }
      }

      this._emitFrameUpdate();

      const newest = this.timestamps[this.timestamps.length - 1];
      this._emit('status', {
        state: '',
        message: `Latest: ${formatTimestampFull(newest?.timestamp)} ET`,
      });
      this._emit('timestamps', { count: this.timestamps.length, timestamps: this.timestamps });
      return true;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return false;
      this._emit('status', { state: 'error', message: `Error: ${(err as Error).message}` });
      return false;
    }
  }

  // ── Frame display ──────────────────────────────────────────────────────

  getCurrentFrameIndex(): number {
    return Math.floor(this.currentAnimationTime) % Math.max(1, this.timestamps.length);
  }

  showFrame(): void {
    if (!this._scene || this.timestamps.length === 0) return;
    const len = this.timestamps.length;
    const t = ((this.currentAnimationTime % len) + len) % len;
    const frameA = Math.floor(t);
    const frameB = (frameA + 1) % len;
    const mix = t - frameA;

    this._scene.setAnimation(frameA, frameB, mix);
    this._scene.prefetchFrames((frameB + 1) % len, this._prefetchAhead);
    this._scene.prefetchMotion(frameA, this._prefetchAhead);
  }

  async loadAndShowFrame(): Promise<void> {
    if (!this._scene || this.timestamps.length === 0) return;
    const len = this.timestamps.length;
    const t = ((this.currentAnimationTime % len) + len) % len;
    const frameA = Math.floor(t);
    const frameB = (frameA + 1) % len;

    await Promise.all([
      this._scene.ensureTextures(frameA, frameB),
      this._scene.ensureMotion(frameA),
    ]);
    this.showFrame();
  }

  // ── Gap-aware frame weights ────────────────────────────────────────────

  private _computeFrameWeights(): void {
    const len = this.timestamps.length;
    if (len < 2) {
      this._frameWeights = new Float32Array([1]);
      return;
    }
    const weights = new Float32Array(len);
    const cadence = this._expectedCadence || 120;
    for (let i = 0; i < len; i++) {
      const gap = this.timestamps[i].gap_before_s;
      weights[i] = gap != null ? Math.min(gap / cadence, 3.0) : 1.0;
    }
    this._frameWeights = weights;
  }

  // ── Animation ──────────────────────────────────────────────────────────

  play(): void {
    if (this.timestamps.length < 2) return;
    this.playing = true;
    this._lastAnimTime = 0;

    if (this._scene) {
      const len = this.timestamps.length;
      const startFrame = Math.floor(((this.currentAnimationTime % len) + len) % len);
      this._scene.prefetchFrames(startFrame, this._prefetchBurst);
    }

    this._animationId = requestAnimationFrame((t) => this._animationTick(t));
    this._emit('playstate', { playing: true });
  }

  pause(): void {
    this.playing = false;
    this._lastAnimTime = 0;
    if (this._animationId != null) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
    this.showFrame();
    this._emit('playstate', { playing: false });
  }

  togglePlay(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  setFrameIndex(idx: number): void {
    if (this.playing) this.pause();
    this.currentAnimationTime = idx;
    this._emitFrameUpdate();
    this.showFrame();
    void this.loadAndShowFrame();
  }

  setSpeed(ms: number): void {
    this.frameInterval = ms;
  }

  private _animationTick(t: number): void {
    if (!this.playing) return;

    if (this._lastAnimTime > 0 && this._scene) {
      const dt = t - this._lastAnimTime;
      const len = this.timestamps.length;
      const curFrame = Math.floor(this.currentAnimationTime) % len;
      const targetFrame = (curFrame + 1) % len;
      const weight = this._frameWeights?.[targetFrame] ?? 1.0;
      const step = dt / (this.frameInterval * weight);

      let nextTime = this.currentAnimationTime + step;
      if (nextTime >= len) nextTime -= len;

      const nextFrameA = Math.floor(nextTime) % len;
      const nextFrameB = (nextFrameA + 1) % len;

      if (
        this._scene.hasTexturesForFrame(nextFrameA) &&
        this._scene.hasTexturesForFrame(nextFrameB)
      ) {
        this.currentAnimationTime = nextTime;
        this.showFrame();
        this._emitFrameUpdate();
      } else {
        this._scene.prefetchFrames(nextFrameA, this._prefetchAhead);
      }
    }
    this._lastAnimTime = t;
    this._animationId = requestAnimationFrame((t2) => this._animationTick(t2));
  }

  // ── Settings ───────────────────────────────────────────────────────────

  setViewMode(mode: ViewMode): void {
    if (mode === this.viewMode) return;
    this.viewMode = mode;
    this._scene?.setMode(mode);
    this.showFrame();
    this._emit('viewmode', { mode });
  }

  setOpacity(val: number): void {
    this.opacity = val;
    this._scene?.setOpacity(val);
  }

  setVerticalExaggeration(val: number): void {
    this.verticalExaggeration = val;
    this._scene?.setVerticalExaggeration(val);
  }

  setDbzRange(min: number, max: number): void {
    if (min > max) [min, max] = [max, min];
    this.dbzMin = min;
    this.dbzMax = max;
    this._scene?.setDbzRange(min, max);
  }

  switchPreset(key: PresetKey): void {
    this.activePreset = key;
    const preset = RADAR_PRESETS[key];
    if (preset) {
      this.setDbzRange(preset.dbzMin, preset.dbzMax);
      this.setOpacity(preset.intensity);
      this.opacity = preset.intensity;
    }
    this._emit('preset', { preset: key, values: preset });
  }

  // ── Viewport ───────────────────────────────────────────────────────────

  onViewportChange(): void {
    if (this._viewportDebounceTimer) clearTimeout(this._viewportDebounceTimer);
    this._viewportDebounceTimer = setTimeout(async () => {
      if (!this._scene) return;
      this._scene.updateVisibleTiles();
      await this.loadAndShowFrame();
    }, VIEWPORT_DEBOUNCE_MS);
  }

  // ── Refresh ────────────────────────────────────────────────────────────

  async refresh(): Promise<void> {
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    await this.fetchTimestamps();
    if (this.timestamps.length > 0 && this._scene) {
      this._scene.updateVisibleTiles();
      await this.loadAndShowFrame();
    }
    if (wasPlaying && this.timestamps.length >= 2) this.play();
  }

  // ── Frame update event ──────────────────────────────────────────────────

  private _emitFrameUpdate(): void {
    const idx = this.getCurrentFrameIndex();
    const ts = this.timestamps[idx];
    this._emit('frame', {
      index: idx,
      total: this.timestamps.length,
      timestamp: ts?.timestamp || null,
      formattedTime: formatTimestamp(ts?.timestamp),
      isGap: ts?.is_gap || false,
      gapMinutes: ts?.gap_before_s ? Math.round(ts.gap_before_s / 60) : null,
    });
  }
}
