# Weather Cloud Mobile — Frontend

Expo SDK 54, React Native, Expo Router v4 (single screen), Nativewind, Zustand.

## Screen Structure

Single screen (`app/index.tsx`) with vertical ScrollView composing:
1. `HeroModule` — large temp, feels-like, condition, unit toggle
2. `MeasurementGrid` — humidity, dew point, pressure, precip, solar, UV, wind dial, sun arc
3. `RadarMap` — RainViewer tile overlay with scrub/play controls
4. `ForecastStrip` — horizontal 5-day forecast cards
5. `HistoryChart` — 7-day high/low temperature bar chart

## Key Files

- `app/index.tsx` — main screen
- `features/weather/weather.store.ts` — Zustand store (current, forecast, history, units)
- `features/weather/weather.api.ts` — typed API calls to backend
- `features/weather/weather.utils.ts` — icon codes, unit labels, formatting helpers
- `features/weather/components/` — all UI components

## Run Commands

```bash
pnpm start    # expo start
pnpm test     # jest --watchAll=false
```

## Styling

Dark theme: bg `#080808`, accent `#f5c842` (gold), surface `#111111`, border `#1e1e1e`.
All colors defined in `tailwind.config.js`. Use Nativewind classes, not inline styles.

## Testing

All components must have co-located `.test.tsx` files.
Use `testID` props on all interactive/assertable elements.
