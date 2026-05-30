/**
 * Web basemap tile loader. Native uses basemapTexture.native.ts (expo-three).
 */
import * as THREE from 'three';

export async function loadRasterTexture(
  url: string,
  signal?: AbortSignal,
): Promise<THREE.Texture | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    // createImageBitmap is available in all modern browsers (web target).
    const bmp = await createImageBitmap(blob);
    const tex = new THREE.Texture(bmp as unknown as HTMLImageElement);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      // eslint-disable-next-line no-console
      console.warn('basemap load failed', url, err);
    }
    return null;
  }
}
