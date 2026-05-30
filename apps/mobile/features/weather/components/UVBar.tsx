import { View, Text } from 'react-native';

interface UVBarProps {
  uv: number | null;
  testID?: string;
}

function uvColor(uv: number): string {
  if (uv <= 2) return '#4caf50';
  if (uv <= 5) return '#ffeb3b';
  if (uv <= 7) return '#ff9800';
  if (uv <= 10) return '#f44336';
  return '#9c27b0';
}

function uvLabel(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

export function UVBar({ uv, testID }: UVBarProps) {
  const pct = uv !== null ? Math.min((uv / 11) * 100, 100) : 0;
  const color = uv !== null ? uvColor(uv) : '#444';
  const label = uv !== null ? uvLabel(uv) : '';

  return (
    <View
      className="flex-col gap-1.5 p-3 bg-surface rounded-md border border-border"
      testID={testID}
    >
      <Text className="text-xs tracking-widest text-text-secondary uppercase font-mono">
        UV Index
      </Text>
      <View className="flex-row items-center gap-3">
        <Text className="text-2xl font-bold text-accent font-mono leading-tight">
          {uv !== null ? uv : '—'}
        </Text>
        <View className="flex-1">
          <View className="h-1.5 bg-border rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </View>
          {label ? (
            <Text className="text-xs text-text-muted font-mono mt-0.5">{label}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
