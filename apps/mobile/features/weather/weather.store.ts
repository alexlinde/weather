import { create } from 'zustand';
import type { CurrentObservation, ForecastDay, HistoryDay } from '@weather-cloud/shared';
import { getCurrentObservation, getForecast, getHistory } from './weather.api';
import { DEFAULT_STATION_ID } from '../../shared/lib/constants';

type Units = 'e' | 'm';

interface WeatherState {
  current: CurrentObservation | null;
  forecast: ForecastDay[];
  history: HistoryDay[];
  units: Units;
  stationId: string;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  fetchAll: () => Promise<void>;
  toggleUnits: () => void;
  refresh: () => Promise<void>;
}

export const useWeatherStore = create<WeatherState>((set, get) => ({
  current: null,
  forecast: [],
  history: [],
  units: 'e',
  stationId: DEFAULT_STATION_ID,
  loading: true,
  error: null,
  lastUpdated: null,

  fetchAll: async () => {
    const { units, stationId } = get();
    set({ loading: true, error: null });

    try {
      // Fetch current and history in parallel
      const [current, history] = await Promise.all([
        getCurrentObservation(stationId, units),
        getHistory(stationId, units),
      ]);

      // Use lat/lon from current obs to fetch forecast
      const forecast = await getForecast(current.lat, current.lon, units);

      set({
        current,
        forecast,
        history,
        loading: false,
        lastUpdated: new Date(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch weather data';
      set({ loading: false, error: message });
    }
  },

  toggleUnits: () => {
    const { units } = get();
    set({ units: units === 'e' ? 'm' : 'e' });
    // Re-fetch with new units
    get().fetchAll();
  },

  refresh: async () => {
    await get().fetchAll();
  },
}));
