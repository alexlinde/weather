import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

import { formatTimestamp } from '../RadarEngine';
import type { FrameUpdate, PresetKey, ViewMode } from '../types';

const MODES: { key: ViewMode; label: string }[] = [
  { key: 'composite', label: 'Composite' },
  { key: '3d', label: '3D' },
  { key: 'volume', label: 'Volume' },
];

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'precip', label: 'Precip' },
  { key: 'severe', label: 'Severe' },
  { key: 'custom', label: 'Custom' },
];

export interface RadarControlsActions {
  togglePlay: () => void;
  seek: (idx: number) => void;
  setMode: (mode: ViewMode) => void;
  setPreset: (key: PresetKey) => void;
  setOpacity: (val: number) => void;
  setVerticalExaggeration: (val: number) => void;
  setDbzRange: (min: number, max: number) => void;
}

interface RadarControlsProps {
  variant: 'inline' | 'full';
  frame: FrameUpdate;
  playing: boolean;
  viewMode: ViewMode;
  preset: PresetKey;
  opacity: number;
  verticalExaggeration: number;
  dbzMin: number;
  dbzMax: number;
  actions: RadarControlsActions;
  onExpand?: () => void;
  onToggleLegend?: () => void;
  testID?: string;
}

export function RadarControls(props: RadarControlsProps) {
  const { frame, playing, actions, variant } = props;
  const maxIdx = Math.max(frame.total - 1, 1);

  return (
    <View style={styles.wrapper} testID={props.testID}>
      {variant === 'full' && (
        <View style={styles.segmentRow} testID="radar-mode-bar">
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.segment, props.viewMode === m.key && styles.segmentActive]}
              onPress={() => actions.setMode(m.key)}
              testID={`radar-mode-${m.key}`}
            >
              <Text
                style={[styles.segmentText, props.viewMode === m.key && styles.segmentTextActive]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.controlsRow} testID="radar-controls">
        <TouchableOpacity
          style={styles.playPauseButton}
          onPress={actions.togglePlay}
          testID="radar-play-pause"
        >
          <Text style={styles.playPauseText}>{playing ? '\u275a\u275a' : '\u25b6'}</Text>
        </TouchableOpacity>

        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={maxIdx}
          step={1}
          value={frame.index}
          onValueChange={(v) => {
            if (frame.total > 1) actions.seek(Math.round(v));
          }}
          minimumTrackTintColor="#f5c842"
          maximumTrackTintColor="#1e1e1e"
          thumbTintColor="#f5c842"
          testID="radar-timeline"
        />

        {frame.timestamp ? (
          <Text style={styles.timestampText} testID="radar-timestamp">
            {formatTimestamp(frame.timestamp)}
          </Text>
        ) : null}

        <Text style={styles.frameCountText} testID="radar-frame-count">
          {frame.total > 0 ? `${frame.index + 1}/${frame.total}` : ''}
        </Text>

        {variant === 'inline' && props.onExpand && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={props.onExpand}
            testID="radar-expand-button"
          >
            <Text style={styles.expandText}>{'\u26f6'}</Text>
          </TouchableOpacity>
        )}

        {variant === 'full' && props.onToggleLegend && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={props.onToggleLegend}
            testID="radar-legend-toggle"
          >
            <Text style={styles.expandText}>{'\u2630'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {variant === 'full' && (
        <>
          <View style={styles.presetRow} testID="radar-presets">
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.chip, props.preset === p.key && styles.chipActive]}
                onPress={() => actions.setPreset(p.key)}
                testID={`radar-preset-${p.key}`}
              >
                <Text style={[styles.chipText, props.preset === p.key && styles.chipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.intensityRow}>
            <Text style={styles.intensityLabel}>Intensity</Text>
            <Slider
              style={styles.intensitySlider}
              minimumValue={0.2}
              maximumValue={1}
              value={props.opacity}
              onValueChange={actions.setOpacity}
              minimumTrackTintColor="#f5c842"
              maximumTrackTintColor="#1e1e1e"
              thumbTintColor="#f5c842"
              testID="radar-intensity"
            />
          </View>

          {props.viewMode !== 'composite' && (
            <View style={styles.intensityRow} testID="radar-exaggeration">
              <Text style={styles.intensityLabel}>
                {`Vert. scale  ${props.verticalExaggeration.toFixed(1)}x`}
              </Text>
              <Slider
                style={styles.intensitySlider}
                minimumValue={1}
                maximumValue={10}
                step={0.5}
                value={props.verticalExaggeration}
                onValueChange={actions.setVerticalExaggeration}
                minimumTrackTintColor="#f5c842"
                maximumTrackTintColor="#1e1e1e"
                thumbTintColor="#f5c842"
                testID="radar-exaggeration-slider"
              />
            </View>
          )}

          {props.preset === 'custom' && (
            <View style={styles.dbzBlock} testID="radar-dbz-range">
              <Text style={styles.intensityLabel}>
                {`dBZ range  ${props.dbzMin} – ${props.dbzMax}`}
              </Text>
              <View style={styles.dbzRow}>
                <Text style={styles.dbzEnd}>min</Text>
                <Slider
                  style={styles.dbzSlider}
                  minimumValue={-30}
                  maximumValue={75}
                  step={5}
                  value={props.dbzMin}
                  onValueChange={(v) => actions.setDbzRange(v, props.dbzMax)}
                  minimumTrackTintColor="#1e1e1e"
                  maximumTrackTintColor="#3fb950"
                  thumbTintColor="#f5c842"
                  testID="radar-dbz-min"
                />
              </View>
              <View style={styles.dbzRow}>
                <Text style={styles.dbzEnd}>max</Text>
                <Slider
                  style={styles.dbzSlider}
                  minimumValue={-30}
                  maximumValue={75}
                  step={5}
                  value={props.dbzMax}
                  onValueChange={(v) => actions.setDbzRange(props.dbzMin, v)}
                  minimumTrackTintColor="#3fb950"
                  maximumTrackTintColor="#1e1e1e"
                  thumbTintColor="#f5c842"
                  testID="radar-dbz-max"
                />
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#111111',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: { backgroundColor: '#1f6feb' },
  segmentText: { color: '#8b949e', fontSize: 12, fontWeight: '600' },
  segmentTextActive: { color: '#ffffff' },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playPauseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  playPauseText: { color: '#f5c842', fontSize: 14 },
  slider: { flex: 1, height: 36 },
  timestampText: {
    color: '#888888',
    fontSize: 11,
    fontFamily: 'monospace',
    minWidth: 48,
    textAlign: 'right',
  },
  frameCountText: {
    color: '#444444',
    fontSize: 11,
    fontFamily: 'monospace',
    minWidth: 35,
    textAlign: 'right',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  expandText: { color: '#e6edf3', fontSize: 16 },
  presetRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  chipActive: { backgroundColor: '#f5c842', borderColor: '#f5c842' },
  chipText: { color: '#8b949e', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#0d1117' },
  intensityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  intensityLabel: { color: '#8b949e', fontSize: 11, minWidth: 56 },
  intensitySlider: { flex: 1, height: 32 },
  dbzBlock: { gap: 2 },
  dbzRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dbzEnd: { color: '#8b949e', fontSize: 10, minWidth: 26 },
  dbzSlider: { flex: 1, height: 30 },
});
