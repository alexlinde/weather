/**
 * GLSL shaders for the radar layer — ported verbatim from frontend/radar-layer.js.
 *
 * The meshes use world-space mercator vertices and the projection matrix is
 * supplied by RadarCamera, so the shader math is unchanged from the web engine.
 */

// Shared colorize: dBZ-proportional alpha with opacity-shaped curve.
export const COLORIZE_GLSL = `
  uniform sampler2D u_colorRamp;
  uniform float u_opacity;
  uniform float u_dbzMin;
  uniform float u_dbzMax;

  vec4 colorize(float encoded) {
    if (encoded < 0.004) return vec4(0.0);
    float dbz = encoded * 127.5 - 30.0;
    if (dbz < u_dbzMin || dbz > u_dbzMax) return vec4(0.0);
    vec3 color = texture2D(u_colorRamp, vec2(encoded, 0.5)).rgb;
    if (dot(color, color) < 0.001) return vec4(0.0);
    float dLo = max(u_dbzMin, 5.0);
    float dHi = min(u_dbzMax, 70.0);
    float t = clamp((dbz - dLo) / (dHi - dLo), 0.0, 1.0);
    float alpha = pow(t, mix(1.5, 0.4, u_opacity));
    alpha *= smoothstep(dLo, dLo + 10.0, dbz);
    return vec4(color, alpha);
  }
`;

export const RADAR_VERT = `
  varying vec2 v_uv;
  void main() {
    v_uv = uv;
    gl_Position = projectionMatrix * vec4(position, 1.0);
  }
`;

export const RADAR_FRAG = `
  precision highp float;

  uniform sampler2D u_tex0;
  uniform sampler2D u_tex1;
  uniform float u_timeMix;
  uniform int u_tiltIndex;

  uniform sampler2D u_motionTex;
  uniform float u_hasMotion;
  uniform float u_tileX;
  uniform float u_tileY;
  uniform float u_tileZ;
  uniform vec4  u_motionBounds;
  uniform float u_maxDispDeg;

  varying vec2 v_uv;

  ${COLORIZE_GLSL}

  #define M_PI 3.14159265359

  float sampleBand(sampler2D tex, vec2 uv, int band) {
    float bandF = float(band);
    float bandStart = bandF / 8.0;
    float halfTexel = 0.5 / 2048.0;
    float v = clamp((1.0 - uv.y) / 8.0 + bandStart, bandStart + halfTexel, bandStart + 0.125 - halfTexel);
    return texture2D(tex, vec2(uv.x, v)).r;
  }

  void getMotion(vec2 uv, out vec2 uvDisp, out float conf) {
    uvDisp = vec2(0.0);
    conf = 0.0;
    if (u_hasMotion < 0.5) return;

    float n = pow(2.0, u_tileZ);
    float lon = (u_tileX + uv.x) / n * 360.0 - 180.0;
    float mercY = (u_tileY + 1.0 - uv.y) / n;
    float latRad = atan(sinh(M_PI * (1.0 - 2.0 * mercY)));
    float lat = latRad * 180.0 / M_PI;

    vec2 mUV = vec2(
      (lon - u_motionBounds.x) / (u_motionBounds.z - u_motionBounds.x),
      (lat - u_motionBounds.y) / (u_motionBounds.w - u_motionBounds.y)
    );
    if (mUV.x < 0.0 || mUV.x > 1.0 || mUV.y < 0.0 || mUV.y > 1.0) return;

    vec3 mot = texture2D(u_motionTex, mUV).rgb;
    vec2 disp_deg = (mot.rg - 0.5) * 2.0 * u_maxDispDeg;
    conf = mot.b;

    float cosLat = max(cos(latRad), 0.01);
    uvDisp = vec2(
      disp_deg.x * n / 360.0,
      disp_deg.y * n / (360.0 * cosLat)
    );
  }

  float sampleInterp(vec2 uv, int band, vec2 uvDisp, float conf) {
    float alpha = u_timeMix;
    if (conf > 0.01) {
      vec2 uvA = clamp(uv - alpha * uvDisp, vec2(0.0), vec2(1.0));
      vec2 uvB = clamp(uv + (1.0 - alpha) * uvDisp, vec2(0.0), vec2(1.0));
      float advected = mix(sampleBand(u_tex0, uvA, band), sampleBand(u_tex1, uvB, band), alpha);
      float crossfade = mix(sampleBand(u_tex0, uv, band), sampleBand(u_tex1, uv, band), alpha);
      return mix(crossfade, advected, conf);
    }
    return mix(sampleBand(u_tex0, uv, band), sampleBand(u_tex1, uv, band), alpha);
  }

  float getComposite(vec2 uv, vec2 uvDisp, float conf) {
    float maxVal = 0.0;
    for (int i = 0; i < 8; i++) {
      maxVal = max(maxVal, sampleInterp(uv, i, uvDisp, conf));
    }
    return maxVal;
  }

  void main() {
    vec2 uvDisp;
    float conf;
    getMotion(v_uv, uvDisp, conf);

    float encoded = u_tiltIndex < 0
      ? getComposite(v_uv, uvDisp, conf)
      : sampleInterp(v_uv, u_tiltIndex, uvDisp, conf);
    vec4 col = colorize(encoded);
    if (col.a < 0.01) discard;
    if (u_tiltIndex < 0) {
      col.a = min(1.0, col.a * (1.0 + col.a));
    } else {
      col.a = min(1.0, col.a * 1.3);
    }
    col.a *= u_opacity;
    gl_FragColor = vec4(col.rgb * col.a, col.a);
  }
`;

export const VOLUME_VERT = `
  uniform vec3 u_cameraPos;
  varying vec3 v_origin;
  varying vec3 v_direction;
  void main() {
    v_origin = u_cameraPos;
    v_direction = position - u_cameraPos;
    gl_Position = projectionMatrix * vec4(position, 1.0);
  }
`;

export const VOLUME_FRAG = `
  precision highp float;

  uniform sampler2D u_tex0;
  uniform sampler2D u_tex1;
  uniform float u_timeMix;
  uniform vec3  u_boxMin;
  uniform vec3  u_boxMax;
  uniform float u_steps;
  uniform float u_tileZoom;
  uniform vec2  u_tileOrigin;
  uniform vec2  u_tileCount;
  uniform float u_numAtlasCols;

  varying vec3 v_origin;
  varying vec3 v_direction;

  ${COLORIZE_GLSL}

  float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float sampleAtlasBand(sampler2D tex, vec2 worldXY, float band) {
    float n = pow(2.0, u_tileZoom);
    vec2 tileCoord = worldXY * n;
    vec2 tileIdx = floor(tileCoord);
    vec2 localUV = fract(tileCoord);
    float col = (tileIdx.x - u_tileOrigin.x)
              + (tileIdx.y - u_tileOrigin.y) * u_tileCount.x;
    if (col < 0.0 || col >= u_numAtlasCols) return 0.0;

    float u = (col + localUV.x) / u_numAtlasCols;
    float bandStart = band / 8.0;
    float halfTexel = 0.5 / 2048.0;
    float v = clamp(localUV.y / 8.0 + bandStart,
                    bandStart + halfTexel, bandStart + 0.125 - halfTexel);
    return texture2D(tex, vec2(u, v)).r;
  }

  float sampleInterp(vec2 worldXY, float band) {
    return mix(sampleAtlasBand(u_tex0, worldXY, band),
               sampleAtlasBand(u_tex1, worldXY, band), u_timeMix);
  }

  float sampleVolume(vec3 worldPos) {
    vec3 boxSize = u_boxMax - u_boxMin;
    vec3 tc = (worldPos - u_boxMin) / boxSize;
    if (any(lessThan(tc, vec3(0.0))) || any(greaterThan(tc, vec3(1.0)))) return 0.0;
    float zSlice = tc.z * 7.0;
    float lower = floor(zSlice);
    float upper = min(7.0, lower + 1.0);
    return mix(sampleInterp(worldPos.xy, lower),
               sampleInterp(worldPos.xy, upper), fract(zSlice));
  }

  void main() {
    vec3 rayDir = normalize(v_direction);
    vec3 invDir = 1.0 / rayDir;
    vec3 t1 = (u_boxMin - v_origin) * invDir;
    vec3 t2 = (u_boxMax - v_origin) * invDir;
    vec3 tSmall = min(t1, t2);
    vec3 tBig   = max(t1, t2);
    float tNear = max(max(tSmall.x, tSmall.y), tSmall.z);
    float tFar  = min(min(tBig.x, tBig.y), tBig.z);
    tNear = max(tNear, 0.0);
    if (tNear >= tFar) discard;

    float rayLen  = tFar - tNear;
    float stepLen = rayLen / u_steps;
    vec3  marchStep = rayDir * stepLen;
    vec3  pos = v_origin + rayDir * tNear;
    pos += marchStep * hash12(gl_FragCoord.xy);

    vec4 acc = vec4(0.0);
    for (int i = 0; i < 64; i++) {
      if (float(i) >= u_steps) break;
      float val = sampleVolume(pos);
      vec4 col = colorize(val);
      if (col.a > 0.0) {
        col.a = min(1.0, col.a * 1.3);
        col.a = min(1.0, col.a * 12.0 / u_steps);
        float f = col.a * (1.0 - acc.a);
        acc.rgb = (acc.a * acc.rgb + f * col.rgb) / max(acc.a + f, 0.001);
        acc.a  += f;
      }
      pos += marchStep;
      if (acc.a >= 0.99) break;
    }

    if (acc.a < 0.01) discard;
    acc.a *= u_opacity;
    gl_FragColor = vec4(acc.rgb * acc.a, acc.a);
  }
`;
