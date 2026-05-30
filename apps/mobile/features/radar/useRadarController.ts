/**
 * useRadarController — React glue around RadarController. Creates a single
 * controller, subscribes UI state to engine events, fetches basemap config, and
 * tears everything down on unmount.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { basemapUrlTemplate } from './BasemapLayer';
import { RadarController, type GLHostContext } from './RadarController';
import { RADAR_PRESETS } from './RadarEngine';
import type { LngLat } from './mercator';
import type {
  FrameUpdate,
  PresetKey,
  RadarConfig,
  ViewMode,
} from './types';

export interface UseRadarControllerOpts {
  apiBase: string;
  center?: LngLat;
  zoom?: number;
}

const IS_MOBILE = Platform.OS !== 'web';

export function useRadarController(opts: UseRadarControllerOpts) {
  const [controller] = useState(
    () =>
      new RadarController({
        apiBase: opts.apiBase,
        isMobile: IS_MOBILE,
        config: null,
        initial: { center: opts.center, zoom: opts.zoom },
      }),
  );

  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState<FrameUpdate>({
    index: 0,
    total: 0,
    timestamp: null,
    formattedTime: '--:--',
    isGap: false,
    gapMinutes: null,
  });
  const [status, setStatus] = useState<{ state: string; message: string }>({
    state: 'loading',
    message: 'Loading radar\u2026',
  });
  const [playing, setPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('composite');
  const [preset, setPreset] = useState<PresetKey>('all');
  const [opacity, setOpacityState] = useState(0.8);
  const [verticalExaggeration, setVEState] = useState(1);
  const [dbzRange, setDbzRangeState] = useState<{ min: number; max: number }>({
    min: 5,
    max: 75,
  });

  // Subscribe to engine events.
  useEffect(() => {
    const e = controller.engine;
    const offs = [
      e.on('frame', setFrame),
      e.on('status', setStatus),
      e.on('playstate', ({ playing: p }) => setPlaying(p)),
      e.on('viewmode', ({ mode }) => setViewMode(mode)),
      e.on('preset', ({ preset: p }) => setPreset(p)),
    ];
    return () => offs.forEach((off) => off());
  }, [controller]);

  // Fetch basemap config and apply it once.
  useEffect(() => {
    let cancelled = false;
    fetch(`${opts.apiBase}/api/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: RadarConfig | null) => {
        if (cancelled || !cfg) return;
        controller.scene.setBasemapTemplate(basemapUrlTemplate(cfg));
        controller.requestRender();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [controller, opts.apiBase]);

  // Dispose on unmount.
  useEffect(() => {
    return () => controller.dispose();
  }, [controller]);

  const onGLCreated = useMemo(
    () => (ctx: GLHostContext) => {
      controller.initGL(ctx);
      setReady(true);
    },
    [controller],
  );

  const actions = useMemo(
    () => ({
      togglePlay: () => controller.engine.togglePlay(),
      seek: (idx: number) => controller.engine.setFrameIndex(idx),
      setMode: (mode: ViewMode) => controller.setViewMode(mode),
      setPreset: (key: PresetKey) => {
        controller.engine.switchPreset(key);
        const p = RADAR_PRESETS[key];
        if (p) {
          setDbzRangeState({ min: p.dbzMin, max: p.dbzMax });
          setOpacityState(p.intensity);
        }
        controller.requestRender();
      },
      setOpacity: (val: number) => {
        controller.engine.setOpacity(val);
        setOpacityState(val);
        controller.requestRender();
      },
      setVerticalExaggeration: (val: number) => {
        controller.engine.setVerticalExaggeration(val);
        setVEState(val);
        controller.requestRender();
      },
      setDbzRange: (min: number, max: number) => {
        controller.engine.setDbzRange(min, max);
        setDbzRangeState({ min, max });
        controller.requestRender();
      },
    }),
    [controller],
  );

  return {
    controller,
    ready,
    frame,
    status,
    playing,
    viewMode,
    preset,
    opacity,
    verticalExaggeration,
    dbzMin: dbzRange.min,
    dbzMax: dbzRange.max,
    onGLCreated,
    onResize: (w: number, h: number, dpr: number) => controller.setSize(w, h, dpr),
    actions,
  };
}
