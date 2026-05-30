import type { StyleProp, ViewStyle } from 'react-native';

import type { GLHostContext } from './RadarController';

export interface GLHostProps {
  onCreated: (ctx: GLHostContext) => void;
  onResize?: (width: number, height: number, pixelRatio: number) => void;
  style?: StyleProp<ViewStyle>;
}
