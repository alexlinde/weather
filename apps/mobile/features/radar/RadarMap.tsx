/**
 * RadarMap — the public radar component. A native GL radar map (no WebView, no
 * iframe): an inline surface with compact controls plus a fullscreen modal with
 * the full control chrome (mode, presets, intensity, legend).
 */
import { useState } from 'react';
import { View, Modal, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { API_BASE_URL } from '../../shared/lib/constants';
import { RadarControls } from './components/RadarControls';
import { RadarSurface } from './RadarSurface';
import { useRadarController } from './useRadarController';

interface RadarMapProps {
  lat: number;
  lon: number;
  testID?: string;
  apiBase?: string;
}

export function RadarMap({ lat, lon, testID, apiBase }: RadarMapProps) {
  const base = apiBase ?? API_BASE_URL;
  const [fullScreen, setFullScreen] = useState(false);
  const radar = useRadarController({ apiBase: base, center: { lng: lon, lat }, zoom: 7 });

  return (
    <View testID={testID}>
      <GestureHandlerRootView style={styles.inlineRoot}>
        <RadarSurface radar={radar} style={StyleSheet.absoluteFill} testID="radar-surface" />
      </GestureHandlerRootView>

      <View style={styles.inlineControls}>
        <RadarControls
          variant="inline"
          frame={radar.frame}
          playing={radar.playing}
          viewMode={radar.viewMode}
          preset={radar.preset}
          opacity={radar.opacity}
          verticalExaggeration={radar.verticalExaggeration}
          dbzMin={radar.dbzMin}
          dbzMax={radar.dbzMax}
          actions={radar.actions}
          onExpand={() => setFullScreen(true)}
        />
      </View>

      <Modal
        visible={fullScreen}
        animationType="slide"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setFullScreen(false)}
        testID="radar-fullscreen-modal"
      >
        {fullScreen && (
          <FullscreenRadar lat={lat} lon={lon} apiBase={base} onClose={() => setFullScreen(false)} />
        )}
      </Modal>
    </View>
  );
}

function FullscreenRadar({
  lat,
  lon,
  apiBase,
  onClose,
}: {
  lat: number;
  lon: number;
  apiBase: string;
  onClose: () => void;
}) {
  const radar = useRadarController({ apiBase, center: { lng: lon, lat }, zoom: 7 });
  const [showLegend, setShowLegend] = useState(true);

  return (
    <GestureHandlerRootView style={styles.fullRoot}>
      <RadarSurface radar={radar} style={StyleSheet.absoluteFill} showLegend={showLegend} />

      <View style={styles.fullControls}>
        <RadarControls
          variant="full"
          frame={radar.frame}
          playing={radar.playing}
          viewMode={radar.viewMode}
          preset={radar.preset}
          opacity={radar.opacity}
          verticalExaggeration={radar.verticalExaggeration}
          dbzMin={radar.dbzMin}
          dbzMax={radar.dbzMax}
          actions={radar.actions}
          onToggleLegend={() => setShowLegend((v) => !v)}
        />
      </View>

      <TouchableOpacity style={styles.closeButton} onPress={onClose} testID="radar-close-button">
        <Text style={styles.closeText}>{'\u2715'}</Text>
      </TouchableOpacity>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  inlineRoot: {
    height: 240,
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  inlineControls: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  fullRoot: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  fullControls: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(13,17,23,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  closeText: { color: '#e6edf3', fontSize: 16 },
});
