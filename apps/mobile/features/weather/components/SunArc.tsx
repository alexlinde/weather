import { View, Text } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { formatTime } from '../weather.utils';

interface SunArcProps {
  sunrise: string | null;
  sunset: string | null;
  testID?: string;
}

export function SunArc({ sunrise, sunset, testID }: SunArcProps) {
  const rise = sunrise ? new Date(sunrise) : null;
  const set = sunset ? new Date(sunset) : null;
  const nowMs = Date.now();

  let dayPct = 0;
  let isDaytime = false;
  if (rise && set) {
    const riseMs = rise.getTime();
    const setMs = set.getTime();
    if (nowMs >= riseMs && nowMs <= setMs) {
      dayPct = ((nowMs - riseMs) / (setMs - riseMs)) * 100;
      isDaytime = true;
    } else if (nowMs > setMs) {
      dayPct = 100;
    }
  }

  const arcR = 38;
  const arcCx = 50;
  const arcCy = 44;
  const totalArcLen = Math.PI * arcR;
  // SVG arc path: left side to right side over top
  const arcPath = `M ${arcCx - arcR} ${arcCy} A ${arcR} ${arcR} 0 0 1 ${arcCx + arcR} ${arcCy}`;

  const sunAngle = Math.PI - (dayPct / 100) * Math.PI;
  const sunX = arcCx + arcR * Math.cos(sunAngle);
  const sunY = arcCy - arcR * Math.sin(sunAngle);

  const progressDash = `${(dayPct / 100) * totalArcLen} ${totalArcLen}`;

  return (
    <View
      className="flex-col gap-1 p-3 bg-surface rounded-md border border-border"
      testID={testID}
    >
      <Text className="text-xs tracking-widest text-text-secondary uppercase font-mono">
        Daylight
      </Text>
      <View className="flex-row items-center gap-4">
        <Svg width={100} height={52} viewBox="0 0 100 52">
          {/* Background arc */}
          <Path d={arcPath} fill="none" stroke="#222" strokeWidth={2} strokeLinecap="round" />
          {/* Progress arc */}
          {dayPct > 0 && (
            <Path
              d={arcPath}
              fill="none"
              stroke="#f5c842"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={progressDash}
            />
          )}
          {/* Horizon line */}
          <Line
            x1={arcCx - arcR}
            y1={arcCy}
            x2={arcCx + arcR}
            y2={arcCy}
            stroke="#1a1a1a"
            strokeWidth={1}
          />
          {/* Sun position */}
          {isDaytime && (
            <>
              <Circle cx={sunX} cy={sunY} r={5} fill="#f5c842" />
              <Circle
                cx={sunX}
                cy={sunY}
                r={9}
                fill="none"
                stroke="rgba(245,200,66,0.2)"
                strokeWidth={1}
              />
            </>
          )}
          {!isDaytime && dayPct === 0 && (
            <Circle cx={arcCx - arcR} cy={arcCy} r={4} fill="#555" />
          )}
          {!isDaytime && dayPct >= 100 && (
            <Circle cx={arcCx + arcR} cy={arcCy} r={4} fill="#555" />
          )}
        </Svg>
        <View className="flex-row gap-5 flex-1">
          <View className="flex-col gap-0.5">
            <Text className="text-xs text-text-muted font-mono">☀ RISE</Text>
            <Text className="text-base font-bold text-accent font-mono leading-tight">
              {formatTime(sunrise)}
            </Text>
          </View>
          <View className="flex-col gap-0.5">
            <Text className="text-xs text-text-muted font-mono">☾ SET</Text>
            <Text className="text-base font-bold text-accent font-mono leading-tight">
              {formatTime(sunset)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
