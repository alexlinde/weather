/**
 * Atlas / motion fetch + decode.
 *
 * Both web and native consume the backend's *raw byte* endpoints
 * (`/api/radar/atlas-raw/...bin`, `/api/radar/motion-raw/...bin`) so there is no
 * PNG/canvas decode anywhere — the bytes upload straight into a DataTexture.
 */

export const ATLAS_WIDTH = 256;
export const ATLAS_HEIGHT = 2048; // 8 bands × 256

export interface MotionTexels {
  data: Uint8Array<ArrayBuffer>; // RGB, row-major
  width: number;
  height: number;
}

/** Fetch a single-channel 256×2048 atlas tile as raw uint8. */
export async function loadAtlasTexels(
  apiBase: string,
  ts: string,
  z: number,
  x: number,
  y: number,
  signal?: AbortSignal,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const url = `${apiBase}/api/radar/atlas-raw/${encodeURIComponent(ts)}/${z}/${x}/${y}.bin`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < ATLAS_WIDTH * ATLAS_HEIGHT) return null;
    return new Uint8Array(buf);
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      // eslint-disable-next-line no-console
      console.warn('atlas load failed', ts, z, x, y, err);
    }
    return null;
  }
}

/** Fetch the RGB motion field for a timestamp as raw uint8 + dimensions. */
export async function loadMotionTexels(
  apiBase: string,
  ts: string,
  signal?: AbortSignal,
): Promise<MotionTexels | null> {
  const url = `${apiBase}/api/radar/motion-raw/${encodeURIComponent(ts)}.bin`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const width = parseInt(res.headers.get('X-Width') ?? '0', 10);
    const height = parseInt(res.headers.get('X-Height') ?? '0', 10);
    const buf = await res.arrayBuffer();
    if (!width || !height || buf.byteLength < width * height * 3) return null;
    return { data: new Uint8Array(buf), width, height };
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      // eslint-disable-next-line no-console
      console.warn('motion load failed', ts, err);
    }
    return null;
  }
}
