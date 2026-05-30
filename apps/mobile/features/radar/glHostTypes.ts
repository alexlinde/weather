import type { StyleProp, ViewStyle } from 'react-native';

import type { GLHostContext } from './RadarController';

export interface GLHostProps {
  onCreated: (ctx: GLHostContext) => void;
  onResize?: (width: number, height: number, pixelRatio: number) => void;
  /** Web-only: mouse wheel / trackpad zoom. `focalX/Y` are canvas-relative px. */
  onWheelZoom?: (focalX: number, focalY: number, dZoom: number) => void;
  style?: StyleProp<ViewStyle>;
}
