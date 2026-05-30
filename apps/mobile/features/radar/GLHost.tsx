/**
 * Web GL host: a WebGL2 <canvas> backing a three.js renderer. Native resolves
 * GLHost.native.tsx (expo-gl) instead.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import type { GLHostProps } from './glHostTypes';

export function GLHost({ onCreated, onResize, style }: GLHostProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCreatedRef = useRef(onCreated);
  const onResizeRef = useRef(onResize);
  onCreatedRef.current = onCreated;
  onResizeRef.current = onResize;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      // eslint-disable-next-line no-console
      console.error('WebGL2 is not available in this browser.');
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl,
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    onCreatedRef.current({
      renderer,
      width: rect.width,
      height: rect.height,
      pixelRatio: dpr,
      endFrame: () => {},
    });

    const ro = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      onResizeRef.current?.(r.width, r.height, window.devicePixelRatio || 1);
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', ...(style as object) }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
