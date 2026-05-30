# Weather

A unified weather monorepo combining a live NOAA MRMS weather-radar pipeline and a
detailed weather dashboard into a single backend and a single React Native app.

## Architecture

```
weather/
├── apps/
│   └── mobile/          # Expo React Native app (iOS + web)
│       └── features/
│           ├── weather/ # dashboard (current, forecast, history)
│           └── radar/   # native GL radar map (three.js + expo-gl)
├── backend/             # Python FastAPI: MRMS radar pipeline + Weather Company proxy
│   ├── main.py          # app, radar endpoints, /api/weather/*, static web export
│   ├── pipeline.py …    # radar S3 → GRIB2 → sparse → atlas/motion
│   ├── grib2/           # custom pure-Python GRIB2 decoder
│   └── weather/         # ported Weather Company (Weather Underground) proxy
├── packages/
│   └── shared/          # shared TS contract (Zod schemas + generated OpenAPI types)
├── Dockerfile           # multi-stage: build Expo web + Python runtime
├── docker-compose*.yml  # local + prod (Caddy)
├── deploy.sh            # GCE VM lifecycle
└── pnpm-workspace.yaml  # apps/*, packages/*
```

The backend is a single FastAPI service:

- `/api/radar/*` — MRMS radar atlas tiles, raw-bytes atlas, motion fields, timestamps.
- `/api/weather/{current,forecast,history}` — proxy to the Weather Company API.
- `/api/config` — basemap tile keys for the radar.
- `/` — serves the Expo web static export.

The radar map is a true native GL component (three.js running on `expo-gl` on iOS and a
WebGL2 canvas on web) — there is no MapLibre and no WebView. It renders its own
Web-Mercator camera, raster basemap tiles, and the ported GLSL radar shaders
(composite, 3D stacked, and volumetric ray-march).

## Development

```bash
# Backend (Python 3.11+)
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env   # set WU_API_KEY
pnpm dev:backend       # uvicorn on :8000  (DEV_MODE=1 to skip S3 seeding)

# Mobile app (web + iOS)
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev:mobile        # Expo;  press 'w' for web, 'i' for iOS

# Build the web export into the backend (served at /)
pnpm build:web
```

## Deploy

Single Docker image (Expo web export + FastAPI) on a GCE VM behind Caddy. See
[`deploy.sh`](deploy.sh) and [`CLOUD.md`](CLOUD.md).

## Docs

- [`MRMS.md`](MRMS.md) — radar data pipeline deep dive
- [`GRIB2.md`](GRIB2.md) — custom GRIB2 decoder
- [`SPEC.md`](SPEC.md) — weather dashboard product spec
- [`CLAUDE.md`](CLAUDE.md) — agent/contributor conventions
