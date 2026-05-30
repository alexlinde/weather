/**
 * RadarController — owns the camera, scene, engine and the render loop, and
 * exposes imperative gesture operations. Platform GL hosts call `initGL` with a
 * ready renderer; the controller is otherwise platform-agnostic.
 */
import type * as THREE from 'three';

import { basemapUrlTemplate } from './BasemapLayer';
import { RadarCamera } from './RadarCamera';
import { RadarEngine } from './RadarEngine';
import { RadarScene } from './RadarScene';
import type { LngLat } from './mercator';
import type { RadarConfig, ViewMode } from './types';

interface CamAnim {
  fromPitch: number;
  toPitch: number;
  fromBearing: number;
  toBearing: number;
  start: number;
  dur: number;
}

export interface GLHostContext {
  renderer: THREE.WebGLRenderer;
  width: number;
  height: number;
  pixelRatio: number;
  endFrame: () => void;
}

export class RadarController {
  readonly camera = new RadarCamera();
  readonly engine: RadarEngine;
  readonly scene: RadarScene;

  private _apiBase: string;
  private _ctx: GLHostContext | null = null;
  private _rafId: number | null = null;
  private _needsRender = true;
  private _disposed = false;
  private _started = false;
  private _camAnim: CamAnim | null = null;

  constructor(opts: {
    apiBase: string;
    isMobile: boolean;
    config: RadarConfig | null;
    initial?: { center?: LngLat; zoom?: number };
  }) {
    this._apiBase = opts.apiBase;
    const requestRepaint = () => {
      this._needsRender = true;
    };
    this.scene = new RadarScene({
      camera: this.camera,
      apiBase: opts.apiBase,
      isMobile: opts.isMobile,
      basemapTemplate: basemapUrlTemplate(opts.config),
      requestRepaint,
    });
    this.engine = new RadarEngine({ apiBase: opts.apiBase, isMobile: opts.isMobile });

    if (opts.initial?.center || opts.initial?.zoom != null) {
      this.camera.jumpTo({
        center: opts.initial.center,
        zoom: opts.initial.zoom,
      });
    }
  }

  // ── GL lifecycle ─────────────────────────────────────────────────────

  initGL(ctx: GLHostContext): void {
    if (this._disposed) return;
    this._ctx = ctx;
    this.camera.setViewport(ctx.width, ctx.height, ctx.pixelRatio);
    this.scene.init(ctx.renderer);
    this.scene.resize(ctx.width, ctx.height, ctx.pixelRatio);
    this.engine.attachScene(this.scene);
    this._startLoop();
    if (!this._started) {
      this._started = true;
      void this.engine.start();
    }
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    if (!this._ctx) return;
    this._ctx.width = width;
    this._ctx.height = height;
    this._ctx.pixelRatio = pixelRatio;
    this.camera.setViewport(width, height, pixelRatio);
    this.scene.resize(width, height, pixelRatio);
    this._needsRender = true;
    this.engine.onViewportChange();
  }

  private _startLoop(): void {
    if (this._rafId != null) return;
    const tick = () => {
      if (this._disposed || !this._ctx) return;
      if (this._camAnim) this._stepCamAnim();
      if (this._needsRender) {
        this._needsRender = false;
        this.scene.render();
        this._ctx.endFrame();
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  /**
   * Switch the radar view mode and tilt the camera to match: 3D/volume modes
   * ease into a pitched perspective (like the original MapLibre `easeTo`),
   * composite returns to a flat top-down view.
   */
  setViewMode(mode: ViewMode): void {
    this.engine.setViewMode(mode);
    const toPitch = mode === 'composite' ? 0 : 50;
    const toBearing = mode === 'composite' ? 0 : this.camera.bearing;
    this._camAnim = {
      fromPitch: this.camera.pitch,
      toPitch,
      fromBearing: this.camera.bearing,
      toBearing,
      start: Date.now(),
      dur: 600,
    };
    this._needsRender = true;
  }

  private _stepCamAnim(): void {
    const a = this._camAnim;
    if (!a) return;
    const t = Math.min(1, (Date.now() - a.start) / a.dur);
    // easeInOutQuad
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const pitch = a.fromPitch + (a.toPitch - a.fromPitch) * e;
    // shortest-path bearing interpolation
    const db = ((a.toBearing - a.fromBearing + 180) % 360 + 360) % 360 - 180;
    const bearing = a.fromBearing + db * e;
    this.camera.jumpTo({ pitch, bearing });
    this._needsRender = true;
    if (t >= 1) {
      this._camAnim = null;
      this.engine.onViewportChange();
    }
  }

  requestRender(): void {
    this._needsRender = true;
  }

  dispose(): void {
    this._disposed = true;
    if (this._rafId != null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    this.engine.destroy();
    this.scene.dispose();
    this._ctx = null;
  }

  // ── Gesture operations (called from the gesture handlers on the JS thread) ──

  panBy(prevX: number, prevY: number, curX: number, curY: number): void {
    this.camera.dragFrom(prevX, prevY, curX, curY);
    this._afterCameraChange();
  }

  zoomAround(focalX: number, focalY: number, dZoom: number): void {
    this.camera.zoomAround(focalX, focalY, dZoom);
    this._afterCameraChange();
  }

  rotateBy(dBearingDeg: number, dPitchDeg: number): void {
    this.camera.rotateBy(dBearingDeg, dPitchDeg);
    this._afterCameraChange();
  }

  private _afterCameraChange(): void {
    this._needsRender = true;
    this.engine.onViewportChange();
  }
}
