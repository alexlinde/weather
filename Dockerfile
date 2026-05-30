## Stage 1: build the Expo web export (react-native-web) into a static bundle
FROM node:20-slim AS web
RUN corepack enable
WORKDIR /build

# Install workspace deps (manifests first for layer caching).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN pnpm install --frozen-lockfile

# Copy sources and export the web app. The web bundle resolves the backend at
# its own origin (see shared/lib/constants.ts), so no API URL is baked in.
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm --filter mobile exec expo export --platform web --output-dir /build/web-export

## Stage 2: Python runtime serving the API + the web export
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY --from=web /build/web-export/ backend/web/

ENV DATA_DIR=/data

EXPOSE 8080

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
