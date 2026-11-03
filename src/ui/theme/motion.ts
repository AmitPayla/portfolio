import { Easing } from 'react-native-reanimated';

/**
 * Motion tokens. A money screen should feel precise, not bouncy: everything
 * decelerates into place with no overshoot. Springs appear only where a
 * gesture hands over velocity (releasing a dragged sheet), and those are
 * critically damped (dampingRatio 1), so they settle without a wobble.
 */

/** Quick start, soft landing. Used for things arriving or moving into place. */
export const EASE_OUT = Easing.bezier(0.2, 0, 0, 1);
/** Symmetric curve for things moving between two resting positions. */
export const EASE_IN_OUT = Easing.bezier(0.4, 0, 0.2, 1);
/** For things leaving the screen. */
export const EASE_IN = Easing.bezier(0.4, 0, 1, 1);

export const DURATION = {
  press: 90,
  release: 150,
  fast: 160,
  base: 220,
  slow: 280,
} as const;

/** Critically damped: follows gesture velocity, never overshoots. */
export const SETTLE_SPRING = { dampingRatio: 1, duration: 320 } as const;

export const easeOut = (duration: number) => ({ duration, easing: EASE_OUT });
export const easeInOut = (duration: number) => ({ duration, easing: EASE_IN_OUT });
