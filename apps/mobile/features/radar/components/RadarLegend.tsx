import { View, Text, StyleSheet } from 'react-native';

import { getLegendBands } from '../colors';

export function RadarLegend({ testID }: { testID?: string }) {
  const bands = getLegendBands();
  return (
    <View style={styles.container} testID={testID}>
      {bands.map((b) => (
        <View key={b.label} style={styles.row}>
          <View style={[styles.swatch, { backgroundColor: b.color }]} />
          <Text style={styles.label}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(13,17,23,0.82)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1,
  },
  swatch: {
    width: 14,
    height: 10,
    borderRadius: 2,
    marginRight: 6,
  },
  label: {
    color: '#c9d1d9',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
