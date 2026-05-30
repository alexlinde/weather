/**
 * Touch gestures → camera transforms, replacing MapLibre's built-in handlers.
 * One finger pans and pinch zooms about the focal point. Rotation (bearing) and
 * user-driven pitch are intentionally disabled — the only camera tilt is the
 * automatic pitch applied when switching to 3D/volume view modes.
 *
 * Handlers run on the JS thread (`runOnJS(true)`) so they can call straight into
 * the controller's camera math.
 */
import { useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import type { RadarController } from './RadarController';

export function useRadarGestures(controller: RadarController | null) {
  const state = useRef({
    lastX: 0,
    lastY: 0,
    lastScale: 1,
  });

  return useMemo(() => {
    const s = state.current;

    const pan = Gesture.Pan()
      .maxPointers(1)
      .onBegin((e) => {
        s.lastX = e.x;
        s.lastY = e.y;
      })
      .onUpdate((e) => {
        if (!controller) return;
        controller.panBy(s.lastX, s.lastY, e.x, e.y);
        s.lastX = e.x;
        s.lastY = e.y;
      })
      .runOnJS(true);

    const pinch = Gesture.Pinch()
      .onBegin(() => {
        s.lastScale = 1;
      })
      .onUpdate((e) => {
        if (!controller || e.scale <= 0) return;
        const dZoom = Math.log2(e.scale / s.lastScale);
        controller.zoomAround(e.focalX, e.focalY, dZoom);
        s.lastScale = e.scale;
      })
      .runOnJS(true);

    return Gesture.Simultaneous(pan, pinch);
  }, [controller]);
}
