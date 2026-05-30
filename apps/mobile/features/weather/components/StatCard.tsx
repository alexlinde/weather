import { View, Text } from 'react-native';

interface StatCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  sub?: string;
  testID?: string;
}

export function StatCard({ label, value, unit, sub, testID }: StatCardProps) {
  const displayValue = value !== null && value !== undefined ? String(value) : '—';

  return (
    <View
      className="flex-col gap-0.5 p-3 bg-surface rounded-md border border-border"
      testID={testID}
    >
      <Text className="text-xs tracking-widest text-text-secondary uppercase font-mono">
        {label}
      </Text>
      <View className="flex-row items-baseline">
        <Text className="text-2xl font-bold text-accent font-mono leading-tight">
          {displayValue}
        </Text>
        {unit ? (
          <Text className="text-sm text-text-secondary ml-1 font-mono">{unit}</Text>
        ) : null}
      </View>
      {sub ? (
        <Text className="text-xs text-text-muted font-mono">{sub}</Text>
      ) : null}
    </View>
  );
}
