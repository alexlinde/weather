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
    // WebGL ignores texture.flipY for ImageBitmap sources, so pre-flip the
    // bitmap at decode time to match three.js's default (flipped-Y) UV
    // convention that the ground-quad UVs assume. Without this the raster
    // tiles render upside down.
    const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY' });
    const tex = new THREE.Texture(bmp as unknown as HTMLImageElement);
    tex.flipY = false;
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
