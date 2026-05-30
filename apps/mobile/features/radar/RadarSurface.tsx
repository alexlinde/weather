/**
 * RadarSurface — the GL drawing area: the platform GL host wrapped in a gesture
 * detector, with a loading/error overlay and an optional legend. Controls are
 * rendered by the parent so they can sit outside the map area.
 */
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { GLHost } from './GLHost';
import { RadarLegend } from './components/RadarLegend';
import { useRadarGestures } from './useRadarGestures';
import type { useRadarController } from './useRadarController';

interface RadarSurfaceProps {
  radar: ReturnType<typeof useRadarController>;
  style?: StyleProp<ViewStyle>;
  showLegend?: boolean;
  testID?: string;
}

export function RadarSurface({ radar, style, showLegend, testID }: RadarSurfaceProps) {
  const gesture = useRadarGestures(radar.controller);
  const loading = radar.frame.total === 0 && radar.status.state !== 'error';
  const error = radar.status.state === 'error';

  return (
    <View style={[styles.container, style]} testID={testID}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <GLHost
            onCreated={radar.onGLCreated}
            onResize={radar.onResize}
            onWheelZoom={(fx, fy, dz) => radar.controller.zoomAround(fx, fy, dz)}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </GestureDetector>

      {showLegend && (
        <View style={styles.legend} pointerEvents="none">
          <RadarLegend testID="radar-legend" />
        </View>
      )}

      {loading && (
        <View style={styles.overlay} testID="radar-loading" pointerEvents="none">
          <Text style={styles.overlayText}>{radar.status.message || 'Loading radar\u2026'}</Text>
        </View>
      )}

      {error && (
        <View style={styles.overlay} testID="radar-error" pointerEvents="none">
          <Text style={[styles.overlayText, styles.errorText]}>{radar.status.message}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d1117',
    overflow: 'hidden',
  },
  legend: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    color: '#c9d1d9',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  errorText: {
    color: '#ff7b72',
  },
});
