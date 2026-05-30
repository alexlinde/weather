import { View, Text, TouchableOpacity } from 'react-native';
import type { CurrentObservation } from '@weather-cloud/shared';
import { getWeatherIcon, formatTime, UNIT_LABELS, type Units } from '../weather.utils';
import { useWeatherStore } from '../weather.store';

interface HeroModuleProps {
  current: CurrentObservation;
  units: Units;
  testID?: string;
}

export function HeroModule({ current, units, testID }: HeroModuleProps) {
  const toggleUnits = useWeatherStore((s) => s.toggleUnits);
  const labels = UNIT_LABELS[units];
  const obsTime = formatTime(current.observationTime);

  // Pick a sensible condition icon from forecast — for now use a default
  const conditionIcon = '🌡️';

  return (
    <View className="px-4 pt-6 pb-4" testID={testID}>
      {/* Station + time */}
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-text-secondary font-mono text-xs tracking-widest uppercase">
          {current.neighborhood ?? current.stationId}
        </Text>
        <Text className="text-text-muted font-mono text-xs">obs {obsTime}</Text>
      </View>

      {/* Main temperature */}
      <View className="flex-row items-end justify-between">
        <View className="flex-row items-end gap-1">
          <Text
            className="font-mono font-bold text-text-primary"
            style={{ fontSize: 80, lineHeight: 88 }}
            testID="hero-temp"
          >
            {current.temp !== null ? Math.round(current.temp) : '—'}
          </Text>
          <View className="pb-3">
            <TouchableOpacity
              onPress={toggleUnits}
              className="border border-border rounded px-2 py-1"
              testID="unit-toggle"
            >
              <Text className="text-accent font-mono text-lg font-bold">
                {labels.temp}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={{ fontSize: 56 }} className="pb-2">
          {conditionIcon}
        </Text>
      </View>

      {/* Feels like */}
      {current.feelsLike !== null && (
        <Text className="text-text-secondary font-mono text-sm" testID="hero-feels-like">
          Feels like {Math.round(current.feelsLike)}{labels.temp}
        </Text>
      )}
    </View>
  );
}
