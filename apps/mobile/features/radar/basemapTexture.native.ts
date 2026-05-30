/**
 * Native basemap tile loader (iOS/Android) via expo-three's loadAsync, which
 * downloads the remote image with expo-asset and uploads it through expo-gl.
 */
import * as THREE from 'three';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - expo-three ships its own (loose) types
import { loadAsync } from 'expo-three';

export async function loadRasterTexture(
  url: string,
  _signal?: AbortSignal,
): Promise<THREE.Texture | null> {
  try {
    const tex: THREE.Texture = await loadAsync(url);
    if (!tex) return null;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('basemap load failed (native)', url, err);
    return null;
  }
}
