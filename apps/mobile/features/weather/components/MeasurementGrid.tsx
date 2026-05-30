import { View } from 'react-native';
import type { CurrentObservation } from '@weather-cloud/shared';
import { StatCard } from './StatCard';
import { WindDial } from './WindDial';
import { UVBar } from './UVBar';
import { SunArc } from './SunArc';
import { UNIT_LABELS, type Units } from '../weather.utils';
import { useWeatherStore } from '../weather.store';

interface MeasurementGridProps {
  current: CurrentObservation;
  units: Units;
  testID?: string;
}

function round1(n: number | null): number | null {
  return n !== null ? Math.round(n * 10) / 10 : null;
}

function round(n: number | null): number | null {
  return n !== null ? Math.round(n) : null;
}

export function MeasurementGrid({ current, units, testID }: MeasurementGridProps) {
  const forecast = useWeatherStore((s) => s.forecast);
  const labels = UNIT_LABELS[units];

  // Get today's sunrise/sunset from forecast day 0
  const today = forecast[0] ?? null;

  return (
    <View className="px-4 pb-2" testID={testID}>
      <View className="flex-row flex-wrap gap-2">
        {/* Two-column grid items */}
        <View className="flex-1 min-w-[44%]">
          <StatCard
            label="Humidity"
            value={round(current.humidity)}
            unit="%"
            testID="stat-humidity"
          />
        </View>
        <View className="flex-1 min-w-[44%]">
          <StatCard
            label="Dew Point"
            value={round(current.dewPoint)}
            unit={labels.temp}
            testID="stat-dewpoint"
          />
        </View>
        <View className="flex-1 min-w-[44%]">
          <StatCard
            label="Pressure"
            value={round1(current.pressure)}
            unit={labels.pressure}
            testID="stat-pressure"
          />
        </View>
        <View className="flex-1 min-w-[44%]">
          <StatCard
            label="Precip Rate"
            value={round1(current.precipRate)}
            unit={labels.precipRate}
            sub={`Total: ${current.precipTotal ?? '—'} ${labels.precip}`}
            testID="stat-precip"
          />
        </View>
        <View className="flex-1 min-w-[44%]">
          <StatCard
            label="Solar Rad"
            value={round(current.solarRadiation)}
            unit="W/m²"
            testID="stat-solar"
          />
        </View>
        <View className="flex-1 min-w-[44%]">
          <UVBar uv={current.uv} testID="stat-uv" />
        </View>
        {/* Full-width items */}
        <View className="w-full">
          <WindDial
            speed={round(current.windSpeed)}
            gust={round(current.windGust)}
            dir={current.windDir}
            units={units}
            testID="stat-wind"
          />
        </View>
        <View className="w-full">
          <SunArc
            sunrise={today?.sunrise ?? null}
            sunset={today?.sunset ?? null}
            testID="stat-sun"
          />
        </View>
      </View>
    </View>
  );
}
