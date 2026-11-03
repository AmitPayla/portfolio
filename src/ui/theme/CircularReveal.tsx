import { Canvas, Group, Image, Skia, type SkImage } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { useAnimatedReaction, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { edgeCoverRadius, type ScreenEdge } from './revealMath';

export interface RevealFrame {
  /** Snapshot of the whole app in the old theme. */
  readonly image: SkImage;
  /** Tap point, in the same window coordinates as the snapshot. */
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
}

interface CircularRevealProps {
  readonly frame: RevealFrame;
  readonly radius: SharedValue<number>;
  /** Called once per edge, when the circle has swept the whole top or bottom edge. */
  readonly onEdgeCovered: (edge: ScreenEdge) => void;
}

/**
 * Draws the old-theme snapshot everywhere EXCEPT inside a circle growing from
 * the tap point; the live app, already in the new theme, shows through the
 * hole. The hole is a clip path rebuilt on the UI thread from the shared
 * `radius` each frame, so React does not re-render during the reveal.
 */
export function CircularReveal({ frame, radius, onEdgeCovered }: CircularRevealProps) {
  const { image, cx, cy, width, height } = frame;
  const topCover = edgeCoverRadius(cx, cy, width, height, 'top');
  const bottomCover = edgeCoverRadius(cx, cy, width, height, 'bottom');

  const hole = useDerivedValue(() => Skia.PathBuilder.Make().addCircle(cx, cy, radius.get()).detach());

  // Status and navigation bar icons flip the moment the wave has passed under them.
  useAnimatedReaction(
    () => radius.get() >= topCover,
    (covered, was) => {
      if (covered && !was) scheduleOnRN(onEdgeCovered, 'top');
    },
  );
  useAnimatedReaction(
    () => radius.get() >= bottomCover,
    (covered, was) => {
      if (covered && !was) scheduleOnRN(onEdgeCovered, 'bottom');
    },
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="theme-reveal">
      <Canvas style={StyleSheet.absoluteFill}>
        <Group clip={hole} invertClip>
          <Image image={image} x={0} y={0} width={width} height={height} fit="fill" />
        </Group>
      </Canvas>
    </View>
  );
}
