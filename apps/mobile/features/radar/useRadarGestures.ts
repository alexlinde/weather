/**
 * Multi-touch gestures → camera transforms, replacing MapLibre's built-in
 * handlers. One finger pans, pinch zooms about the focal point, two-finger
 * rotation sets bearing, and a two-finger vertical drag sets pitch.
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
    lastRotation: 0,
    lastTwoY: 0,
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

    const pitchPan = Gesture.Pan()
      .minPointers(2)
      .maxPointers(2)
      .onBegin((e) => {
        s.lastTwoY = e.y;
      })
      .onUpdate((e) => {
        if (!controller) return;
        const dPitch = -(e.y - s.lastTwoY) * 0.4;
        if (Math.abs(dPitch) > 0.01) controller.rotateBy(0, dPitch);
        s.lastTwoY = e.y;
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

    const rotation = Gesture.Rotation()
      .onBegin(() => {
        s.lastRotation = 0;
      })
      .onUpdate((e) => {
        if (!controller) return;
        const dDeg = ((e.rotation - s.lastRotation) * 180) / Math.PI;
        controller.rotateBy(dDeg, 0);
        s.lastRotation = e.rotation;
      })
      .runOnJS(true);

    return Gesture.Simultaneous(pan, pitchPan, pinch, rotation);
  }, [controller]);
}
