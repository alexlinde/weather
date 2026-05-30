import { View, Text, FlatList } from 'react-native';
import type { ForecastDay } from '@weather-cloud/shared';
import { getWeatherIcon, UNIT_LABELS, type Units } from '../weather.utils';

interface ForecastStripProps {
  forecast: ForecastDay[];
  units: Units;
  testID?: string;
}

interface ForecastCardProps {
  day: ForecastDay;
  units: Units;
  isFirst: boolean;
}

function ForecastCard({ day, units, isFirst }: ForecastCardProps) {
  const labels = UNIT_LABELS[units];
  const dayName = isFirst
    ? 'Today'
    : day.dayOfWeek.slice(0, 3);

  return (
    <View
      className="bg-surface rounded-md border border-border p-3 mr-2"
      style={{ width: 80 }}
      testID={`forecast-card-${day.validDate}`}
    >
      {/* Day name */}
      <Text className="text-xs tracking-widest text-text-secondary uppercase font-mono text-center mb-1">
        {dayName}
      </Text>

      {/* Daytime */}
      <View className="items-center mb-1">
        <Text style={{ fontSize: 22 }}>
          {getWeatherIcon(day.dayIcon)}
        </Text>
        {day.dayPrecipChance !== null && (
          <Text className="text-xs text-blue-400 font-mono">{day.dayPrecipChance}%</Text>
        )}
        <Text className="text-sm font-bold text-accent font-mono">
          {day.tempHigh !== null ? Math.round(day.tempHigh) : '—'}{labels.temp}
        </Text>
      </View>

      {/* Divider */}
      <View className="border-t border-border my-1" />

      {/* Nighttime */}
      <View className="items-center">
        <Text style={{ fontSize: 22 }}>
          {getWeatherIcon(day.nightIcon)}
        </Text>
        {day.nightPrecipChance !== null && (
          <Text className="text-xs text-blue-400 font-mono">{day.nightPrecipChance}%</Text>
        )}
        <Text className="text-sm font-bold text-text-secondary font-mono">
          {day.tempLow !== null ? Math.round(day.tempLow) : '—'}{labels.temp}
        </Text>
      </View>
    </View>
  );
}

export function ForecastStrip({ forecast, units, testID }: ForecastStripProps) {
  return (
    <View className="mb-4" testID={testID}>
      {/* Section header */}
      <View className="px-4 mb-2">
        <Text className="text-xs tracking-widest text-text-secondary uppercase font-mono">
          5-Day Forecast
        </Text>
      </View>
      <FlatList
        data={forecast}
        keyExtractor={(item) => item.validDate}
        renderItem={({ item, index }) => (
          <ForecastCard day={item} units={units} isFirst={index === 0} />
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-4"
        testID="forecast-list"
      />
    </View>
  );
}
