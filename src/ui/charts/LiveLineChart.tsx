import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

export interface ChartPoint {
  readonly t: number;
  readonly v: number;
}

const PAD_Y = 10;
/** Room on the right so the live dot and its pulse are not clipped. */
const PAD_RIGHT = 8;

/** Builds the line and area paths. Pure, so it is easy to test and cheap to memoise. */
export function buildPaths(points: readonly ChartPoint[], width: number, height: number, baseline?: number | null) {
  if (points.length === 0 || width <= 0) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    min = Math.min(min, p.v);
    max = Math.max(max, p.v);
  }
  if (baseline != null) {
    min = Math.min(min, baseline);
    max = Math.max(max, baseline);
  }
  const span = max - min || 1;
  const usable = height - PAD_Y * 2;
  const plotWidth = Math.max(1, width - PAD_RIGHT);
  const x = (i: number) => (points.length === 1 ? plotWidth : (i / (points.length - 1)) * plotWidth);
  const y = (v: number) => PAD_Y + (1 - (v - min) / span) * usable;
  let line = '';
  points.forEach((p, i) => {
    line += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`;
  });
  if (points.length === 1) line = `M0,${y(points[0]?.v ?? 0).toFixed(1)}L${plotWidth},${y(points[0]?.v ?? 0).toFixed(1)}`;
  const area = `${line}L${plotWidth},${height}L0,${height}Z`;
  const last = points[points.length - 1];
  return {
    line,
    area,
    lastX: x(points.length - 1),
    lastY: last ? y(last.v) : height / 2,
    baselineY: baseline == null ? null : y(baseline),
  };
}

/**
 * Line chart of ticks received since the screen opened. Re-renders only when
 * a new point arrives (≈1/s per symbol at 20 ticks/s across 25 symbols); the
 * "last price" pulse is a UI-thread loop.
 */
export const LiveLineChart = memo(function LiveLineChart({
  points,
  color,
  height = 170,
  baseline,
}: {
  readonly points: readonly ChartPoint[];
  readonly color: string;
  readonly height?: number;
  /** Optional reference level (previous close), drawn dashed. */
  readonly baseline?: number | null;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const paths = useMemo(() => buildPaths(points, width, height, baseline), [points, width, height, baseline]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 2.2 }],
  }));

  return (
    <View style={{ height }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {paths ? (
        <>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {paths.baselineY != null ? (
              <Line x1={0} x2={width} y1={paths.baselineY} y2={paths.baselineY} stroke={colors.textFaint} strokeWidth={1} strokeDasharray="4 5" />
            ) : null}
            <Path d={paths.area} fill="url(#area)" />
            <Path d={paths.line} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
          <View pointerEvents="none" style={[styles.dotWrap, { left: paths.lastX - 5, top: paths.lastY - 5 }]}>
            <Animated.View style={[styles.dot, { backgroundColor: color }, pulseStyle]} />
            <View style={[styles.dot, { backgroundColor: color, borderColor: colors.surface, borderWidth: 2 }]} />
          </View>
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  dotWrap: { position: 'absolute', width: 10, height: 10 },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
});
