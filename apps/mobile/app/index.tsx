import { useEffect, useCallback } from 'react';
import { ScrollView, RefreshControl, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useWeatherStore } from '../features/weather/weather.store';
import { HeroModule } from '../features/weather/components/HeroModule';
import { MeasurementGrid } from '../features/weather/components/MeasurementGrid';
import { RadarMap } from '../features/radar/RadarMap';
import { ForecastStrip } from '../features/weather/components/ForecastStrip';
import { HistoryChart } from '../features/weather/components/HistoryChart';

export default function WeatherScreen() {
  const { current, forecast, history, units, loading, error, refresh, fetchAll } =
    useWeatherStore();

  useEffect(() => {
    fetchAll();
  }, []);

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  if (!current && loading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#f5c842" testID="loading-indicator" />
        <Text className="text-text-secondary mt-4 font-mono text-sm">Loading weather…</Text>
      </View>
    );
  }

  if (!current && error) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <StatusBar style="light" />
        <Text className="text-red-400 text-center text-base mb-4" testID="error-message">
          {error}
        </Text>
        <Text
          className="text-accent text-base"
          onPress={fetchAll}
          testID="retry-button"
        >
          Retry
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" testID="weather-screen">
      <StatusBar style="light" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor="#f5c842"
            colors={['#f5c842']}
          />
        }
        testID="weather-scroll"
      >
        {current && (
          <HeroModule current={current} units={units} testID="hero-module" />
        )}
        {current && (
          <MeasurementGrid current={current} units={units} testID="measurement-grid" />
        )}
        <RadarMap
          lat={current?.lat ?? 39.7}
          lon={current?.lon ?? -104.9}
          testID="radar-map"
        />
        {forecast.length > 0 && (
          <ForecastStrip forecast={forecast} units={units} testID="forecast-strip" />
        )}
        {history.length > 0 && (
          <HistoryChart
            history={history}
            currentTemp={current?.temp ?? null}
            units={units}
            testID="history-chart"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
