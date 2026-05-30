import {
  CurrentObservationResponseSchema,
  ForecastResponseSchema,
  HistoryResponseSchema,
  type CurrentObservation,
  type ForecastDay,
  type HistoryDay,
} from '@weather-cloud/shared';
import { apiFetch } from '../../shared/lib/api-client';

type Units = 'e' | 'm';

export async function getCurrentObservation(
  stationId: string,
  units: Units,
): Promise<CurrentObservation> {
  const raw = await apiFetch('/api/weather/current', { stationId, units });
  const parsed = CurrentObservationResponseSchema.parse(raw);
  return parsed.data;
}

export async function getForecast(
  lat: number,
  lon: number,
  units: Units,
): Promise<ForecastDay[]> {
  const raw = await apiFetch('/api/weather/forecast', {
    lat: lat.toString(),
    lon: lon.toString(),
    units,
  });
  const parsed = ForecastResponseSchema.parse(raw);
  return parsed.data;
}

export async function getHistory(
  stationId: string,
  units: Units,
): Promise<HistoryDay[]> {
  const raw = await apiFetch('/api/weather/history', { stationId, units });
  const parsed = HistoryResponseSchema.parse(raw);
  return parsed.data;
}
