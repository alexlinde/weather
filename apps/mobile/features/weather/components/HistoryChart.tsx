import { View, Text, useWindowDimensions } from 'react-native';
import Svg, { Rect, Line, Circle, Text as SvgText, G } from 'react-native-svg';
import type { HistoryDay } from '@weather-cloud/shared';
import { UNIT_LABELS, type Units } from '../weather.utils';

interface HistoryChartProps {
  history: HistoryDay[];
  currentTemp: number | null;
  units: Units;
  testID?: string;
}

const CHART_HEIGHT = 120;
const PADDING = { top: 12, bottom: 24, left: 36, right: 12 };
const BAR_GAP = 6;

export function HistoryChart({ history, currentTemp, units, testID }: HistoryChartProps) {
  const { width } = useWindowDimensions();
  const labels = UNIT_LABELS[units];

  // Filter out days with no data
  const validDays = history.filter((d) => d.tempHigh !== null || d.tempLow !== null);
  if (validDays.length === 0) return null;

  const chartW = width - 32; // mx-4 = 16px each side
  const innerW = chartW - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const barW = Math.floor((innerW - BAR_GAP * (validDays.length - 1)) / validDays.length);

  // Compute temp range for Y axis
  const allTemps = validDays.flatMap((d) => [d.tempHigh, d.tempLow, currentTemp].filter((t): t is number => t !== null));
  const rawMin = Math.min(...allTemps);
  const rawMax = Math.max(...allTemps);
  const padding = Math.max((rawMax - rawMin) * 0.15, 5);
  const yMin = Math.floor(rawMin - padding);
  const yMax = Math.ceil(rawMax + padding);
  const yRange = yMax - yMin || 1;

  const toY = (temp: number) => innerH - ((temp - yMin) / yRange) * innerH;

  // Y axis ticks — 3-4 evenly spaced
  const tickCount = 4;
  const tickStep = Math.ceil(yRange / tickCount / 5) * 5;
  const ticks: number[] = [];
  for (let t = Math.ceil(yMin / tickStep) * tickStep; t <= yMax; t += tickStep) {
    ticks.push(t);
  }

  return (
    <View className="mx-4 mb-4" testID={testID}>
      <Text className="text-xs tracking-widest text-text-secondary uppercase font-mono mb-2">
        7-Day Temperature History
      </Text>
      <View className="bg-surface rounded-md border border-border overflow-hidden">
        <Svg width={chartW} height={CHART_HEIGHT + 4} viewBox={`0 0 ${chartW} ${CHART_HEIGHT + 4}`}>
          <G x={PADDING.left} y={PADDING.top}>
            {/* Y-axis grid lines and labels */}
            {ticks.map((t) => {
              const y = toY(t);
              return (
                <G key={t}>
                  <Line
                    x1={0}
                    y1={y}
                    x2={innerW}
                    y2={y}
                    stroke="#1e1e1e"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                  <SvgText
                    x={-4}
                    y={y}
                    textAnchor="end"
                    fontSize={8}
                    fill="#888"
                    fontFamily="monospace"
                    alignmentBaseline="middle"
                  >
                    {t}°
                  </SvgText>
                </G>
              );
            })}

            {/* Bars */}
            {validDays.map((day, idx) => {
              const x = idx * (barW + BAR_GAP);
              const high = day.tempHigh ?? (day.tempLow ?? 0);
              const low = day.tempLow ?? (day.tempHigh ?? 0);
              const isToday = idx === validDays.length - 1;

              const barTop = toY(high);
              const barBottom = toY(low);
              const barHeight = Math.max(barBottom - barTop, 2);

              const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
              });

              const currentTempY =
                isToday && currentTemp !== null ? toY(currentTemp) : null;

              return (
                <G key={day.date}>
                  <Rect
                    x={x}
                    y={barTop}
                    width={barW}
                    height={barHeight}
                    fill={isToday ? '#f5c842' : 'rgba(245,200,66,0.35)'}
                    rx={2}
                  />
                  {/* Day label */}
                  <SvgText
                    x={x + barW / 2}
                    y={innerH + 12}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#888"
                    fontFamily="monospace"
                  >
                    {dayLabel}
                  </SvgText>
                  {/* Current temp dot on today's bar */}
                  {currentTempY !== null && (
                    <Circle
                      cx={x + barW / 2}
                      cy={currentTempY}
                      r={4}
                      fill="#f5c842"
                      stroke="#080808"
                      strokeWidth={1.5}
                    />
                  )}
                </G>
              );
            })}
          </G>
        </Svg>

        {/* Precipitation row */}
        <View className="flex-row px-4 py-2 gap-1 border-t border-border">
          {validDays.map((d) => (
            <View key={d.date} className="items-center flex-1">
              {d.precipTotal !== null && d.precipTotal > 0 ? (
                <Text style={{ color: '#4a90d9', fontSize: 8, fontFamily: 'monospace' }}>
                  {d.precipTotal.toFixed(1)}
                </Text>
              ) : (
                <Text style={{ color: '#333', fontSize: 8, fontFamily: 'monospace' }}>—</Text>
              )}
            </View>
          ))}
        </View>
        <Text className="text-xs text-text-muted font-mono text-center pb-2">
          Precipitation ({labels.precip})
        </Text>
      </View>
    </View>
  );
}
