# Weather — Agent Constitution

A single repo with one Python backend and one Expo React Native app.

## Structure

```
weather/
  backend/                 # FastAPI: MRMS radar pipeline + Weather Company proxy
    main.py                # endpoints + static web export mount
    pipeline.py, mrms.py, cache.py, disk_cache.py, tiles.py, motion.py, render.py
    grib2/                 # custom pure-Python GRIB2 decoder
    weather/               # ported Weather Company proxy (service, routes, cache, schemas)
  apps/mobile/             # Expo RN app (iOS + web)
    features/weather/      # dashboard feature
    features/radar/        # native GL radar map (three.js + expo-gl)
  packages/shared/         # shared TS contract (Zod + generated OpenAPI types)
```

## Conventions (frontend)

- Components: `PascalCase.tsx`. Feature files: `featureName.store.ts`, `.api.ts`, `.utils.ts`.
- Co-locate tests as `Name.test.tsx`. Add `testID` to interactive/assertable elements.
- Nativewind classes for styling. Zustand for shared state (no `useState` for shared state).
- No `any`. The mobile app never calls the Weather Company API directly — only via the backend.
- Platform splits use Metro extensions: `*.native.tsx` (iOS/Android) vs `*.tsx`/`*.web.tsx` (web).

## Conventions (backend)

- Radar scientific code (`grib2/`, `pipeline.py`, `tiles.py`, `motion.py`) is battle-tested — change with care.
- Weather proxy lives in `backend/weather/`; response shapes mirror `packages/shared`.
- Heavy CPU work is offloaded with `asyncio.to_thread` / `ThreadPoolExecutor`.

## Radar GL component

- Renders its own Web-Mercator camera, raster basemap tiles, and ported GLSL shaders
  (composite / 3D stacked / volume). No MapLibre, no WebView.
- GL host: `expo-gl` `GLView` on native, a WebGL2 `<canvas>` on web (platform-split host).
- Atlas tiles are fetched as raw single-channel bytes (`/api/radar/atlas-raw/...`) on native
  and uploaded directly to an R8 `DataTexture`; PNG is used on web.

## Run

```bash
# backend
pnpm dev:backend          # uvicorn :8000  (DEV_MODE=1 to skip S3 seeding)
# mobile
pnpm dev:mobile           # expo start (w = web, i = iOS)
pnpm build:web            # export web into backend/web (served at /)
# types
pnpm gen:types            # regenerate packages/shared from the backend OpenAPI
```

## Environment

- Backend: `WU_API_KEY` (required), `WU_DEFAULT_STATION`, `MAPTILER_API_KEY` (optional). See `.env.example`.
- Mobile: `EXPO_PUBLIC_API_URL` (unified backend base URL). See `apps/mobile/.env.example`.
