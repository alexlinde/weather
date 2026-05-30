import { View, Text } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { degToCardinal, type Units, UNIT_LABELS } from '../weather.utils';

interface WindDialProps {
  speed: number | null;
  gust: number | null;
  dir: number | null;
  units: Units;
  testID?: string;
}

export function WindDial({ speed, gust, dir, units, testID }: WindDialProps) {
  const angle = dir ?? 0;
  const rad = (angle * Math.PI) / 180;
  const cx = 22;
  const cy = 22;
  const r = 20;
  const arrowLen = 16;
  const x2 = cx + arrowLen * Math.sin(rad);
  const y2 = cy - arrowLen * Math.cos(rad);
  const speedUnit = UNIT_LABELS[units].speed;
  const cardinal = degToCardinal(dir);

  const cardinalPoints = ['N', 'E', 'S', 'W'];

  return (
    <View
      className="flex-col gap-0.5 p-3 bg-surface rounded-md border border-border"
      testID={testID}
    >
      <Text className="text-xs tracking-widest text-text-secondary uppercase font-mono">
        Wind
      </Text>
      <View className="flex-row items-center gap-3">
        <Svg width={44} height={44}>
          <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#333" strokeWidth={1.5} />
          {cardinalPoints.map((d, i) => {
            const a = (i * 90 * Math.PI) / 180;
            const tx = cx + 14 * Math.sin(a);
            const ty = cy - 14 * Math.cos(a);
            return (
              <SvgText
                key={d}
                x={tx}
                y={ty}
                textAnchor="middle"
                fontSize={7}
                fill="#555"
                fontFamily="monospace"
              >
                {d}
              </SvgText>
            );
          })}
          <Line
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke="#f5c842"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx={cx} cy={cy} r={2.5} fill="#f5c842" />
        </Svg>
        <View className="flex-1">
          <View className="flex-row items-baseline">
            <Text className="text-2xl font-bold text-accent font-mono leading-none">
              {speed !== null ? speed : '—'}
            </Text>
            <Text className="text-sm text-text-secondary font-mono ml-1">{speedUnit}</Text>
          </View>
          <Text className="text-xs text-text-muted font-mono">
            {cardinal} · gust {gust !== null ? gust : '—'} {speedUnit}
          </Text>
        </View>
      </View>
    </View>
  );
}
