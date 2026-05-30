import { z } from 'zod';

// ---------------------------------------------------------------------------
// Current PWS Observation
// ---------------------------------------------------------------------------

export const CurrentObservationSchema = z.object({
  stationId: z.string(),
  neighborhood: z.string().nullable(),
  observationTime: z.string(),
  lat: z.number(),
  lon: z.number(),
  // Temperature
  temp: z.number().nullable(),
  feelsLike: z.number().nullable(),
  dewPoint: z.number().nullable(),
  // Humidity & Pressure
  humidity: z.number().nullable(),
  pressure: z.number().nullable(),
  // Precipitation
  precipRate: z.number().nullable(),
  precipTotal: z.number().nullable(),
  // Wind
  windSpeed: z.number().nullable(),
  windDir: z.number().nullable(),
  windGust: z.number().nullable(),
  // Solar / UV
  uv: z.number().nullable(),
  solarRadiation: z.number().nullable(),
  // Units indicator
  units: z.enum(['e', 'm']),
});

export type CurrentObservation = z.infer<typeof CurrentObservationSchema>;

export const CurrentObservationResponseSchema = z.object({
  data: CurrentObservationSchema,
});

// ---------------------------------------------------------------------------
// 5-Day Forecast
// ---------------------------------------------------------------------------

export const ForecastDaySchema = z.object({
  dayOfWeek: z.string(),
  validDate: z.string(),
  // Day period
  dayIcon: z.number().nullable(),
  dayPhrase: z.string().nullable(),
  dayPrecipChance: z.number().nullable(),
  dayTemp: z.number().nullable(),
  dayHumidity: z.number().nullable(),
  dayWindSpeed: z.number().nullable(),
  dayWindDir: z.string().nullable(),
  // Night period
  nightIcon: z.number().nullable(),
  nightPhrase: z.string().nullable(),
  nightPrecipChance: z.number().nullable(),
  nightTemp: z.number().nullable(),
  nightHumidity: z.number().nullable(),
  nightWindSpeed: z.number().nullable(),
  nightWindDir: z.string().nullable(),
  // Day-level
  tempHigh: z.number().nullable(),
  tempLow: z.number().nullable(),
  sunrise: z.string().nullable(),
  sunset: z.string().nullable(),
  moonPhase: z.string().nullable(),
});

export type ForecastDay = z.infer<typeof ForecastDaySchema>;

export const ForecastResponseSchema = z.object({
  data: z.array(ForecastDaySchema),
});

// ---------------------------------------------------------------------------
// 7-Day PWS History
// ---------------------------------------------------------------------------

export const HistoryDaySchema = z.object({
  date: z.string(),
  tempHigh: z.number().nullable(),
  tempLow: z.number().nullable(),
  tempAvg: z.number().nullable(),
  precipTotal: z.number().nullable(),
  humidityHigh: z.number().nullable(),
  humidityLow: z.number().nullable(),
  windSpeedAvg: z.number().nullable(),
  windSpeedHigh: z.number().nullable(),
  pressureMax: z.number().nullable(),
  pressureMin: z.number().nullable(),
});

export type HistoryDay = z.infer<typeof HistoryDaySchema>;

export const HistoryResponseSchema = z.object({
  data: z.array(HistoryDaySchema),
});

// ---------------------------------------------------------------------------
// Query param schemas (used on backend routes)
// ---------------------------------------------------------------------------

export const CurrentQuerySchema = z.object({
  stationId: z.string().min(1),
  units: z.enum(['e', 'm']).default('e'),
});

export const ForecastQuerySchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  units: z.enum(['e', 'm']).default('e'),
});

export const HistoryQuerySchema = z.object({
  stationId: z.string().min(1),
  units: z.enum(['e', 'm']).default('e'),
});
