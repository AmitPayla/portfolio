/**
 * Radius a circle centred on the tap point needs to cover the whole screen:
 * the distance to the farthest corner, rounded up, plus 1px so anti-aliasing
 * at the circle's edge never leaves a sliver of the old theme in that corner.
 */
export function revealRadius(x: number, y: number, width: number, height: number): number {
  const dx = Math.max(Math.abs(x), Math.abs(width - x));
  const dy = Math.max(Math.abs(y), Math.abs(height - y));
  return Math.ceil(Math.hypot(dx, dy)) + 1;
}

export type ScreenEdge = 'top' | 'bottom';

/**
 * Radius at which the circle has swept a whole horizontal edge of the screen
 * (both of its corners). The status bar sits on the top edge and the navigation
 * bar on the bottom one; each flips its icons once its edge is covered.
 */
export function edgeCoverRadius(x: number, y: number, width: number, height: number, edge: ScreenEdge): number {
  const dx = Math.max(Math.abs(x), Math.abs(width - x));
  const dy = edge === 'top' ? Math.abs(y) : Math.abs(height - y);
  return Math.hypot(dx, dy);
}
