/**
 * Native GL host (iOS/Android): an expo-gl GLView whose context drives an
 * expo-three renderer. Native uses this; web uses GLHost.tsx (a WebGL2 canvas).
 */
import { PixelRatio } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - expo-three ships loose types
import { Renderer } from 'expo-three';
import type * as THREE from 'three';

import type { GLHostProps } from './glHostTypes';

export function GLHost({ onCreated, style }: GLHostProps) {
  return (
    <GLView
      style={style}
      onContextCreate={(gl: ExpoWebGLRenderingContext) => {
        const pixelRatio = PixelRatio.get();
        const bufW = gl.drawingBufferWidth;
        const bufH = gl.drawingBufferHeight;
        const width = bufW / pixelRatio;
        const height = bufH / pixelRatio;

        const renderer = new Renderer({ gl, alpha: true }) as unknown as THREE.WebGLRenderer;
        renderer.setSize(bufW, bufH, false);

        onCreated({
          renderer,
          width,
          height,
          pixelRatio,
          endFrame: () => gl.endFrameEXP(),
        });
      }}
    />
  );
}
