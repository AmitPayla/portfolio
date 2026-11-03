import type AsyncStorage from '@react-native-async-storage/async-storage';
import { edgeCoverRadius, revealRadius } from '../revealMath';
import { createThemePreferenceStore, isColorScheme } from '../themePreference';

describe('revealRadius', () => {
  const W = 412;
  const H = 915;
  const corners = [
    [0, 0],
    [W, 0],
    [0, H],
    [W, H],
  ] as const;

  it('reaches the farthest corner from the tap', () => {
    // From the centre every corner is equally far.
    expect(revealRadius(W / 2, H / 2, W, H)).toBe(Math.ceil(Math.hypot(W / 2, H / 2)) + 1);
    // From the top-left corner, the bottom-right corner is the one that matters.
    expect(revealRadius(0, 0, W, H)).toBe(Math.ceil(Math.hypot(W, H)) + 1);
    // A tap near the bottom-right must still reach the top-left.
    expect(revealRadius(380, 860, W, H)).toBe(Math.ceil(Math.hypot(380, 860)) + 1);
  });

  it('covers all four corners from any point on screen', () => {
    for (let x = 0; x <= W; x += W / 8) {
      for (let y = 0; y <= H; y += H / 8) {
        const r = revealRadius(x, y, W, H);
        for (const [cx, cy] of corners) expect(Math.hypot(cx - x, cy - y)).toBeLessThanOrEqual(r);
      }
    }
  });

  it('still covers the screen when the tap is reported slightly outside it', () => {
    const r = revealRadius(-4, H + 6, W, H);
    for (const [cx, cy] of corners) expect(Math.hypot(cx + 4, cy - H - 6)).toBeLessThanOrEqual(r);
  });
});

describe('edgeCoverRadius', () => {
  const W = 412;
  const H = 915;

  it('covers an edge once both of its corners are inside the circle', () => {
    // A tap on the header toggle (top right): the top-left corner is the last part of the top edge.
    expect(edgeCoverRadius(370, 60, W, H, 'top')).toBeCloseTo(Math.hypot(370, 60));
    expect(edgeCoverRadius(370, 60, W, H, 'bottom')).toBeCloseTo(Math.hypot(370, H - 60));
  });

  it('never needs more than the full reveal radius', () => {
    for (let x = 0; x <= W; x += W / 8) {
      for (let y = 0; y <= H; y += H / 8) {
        const full = revealRadius(x, y, W, H);
        expect(edgeCoverRadius(x, y, W, H, 'top')).toBeLessThan(full);
        expect(edgeCoverRadius(x, y, W, H, 'bottom')).toBeLessThan(full);
      }
    }
  });
});

describe('isColorScheme', () => {
  it('accepts light and dark only', () => {
    expect(['light', 'dark'].every(isColorScheme)).toBe(true);
    expect([undefined, 'system', 'blue', 1, null].some(isColorScheme)).toBe(false);
  });
});

describe('theme preference store', () => {
  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      getItem: async (key: string) => data.get(key) ?? null,
      setItem: async (key: string, value: string) => void data.set(key, value),
      removeItem: async (key: string) => void data.delete(key),
    } as unknown as typeof AsyncStorage;
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('starts dark, persists a choice across restarts and reports hydration', async () => {
    const storage = memoryStorage();
    const first = createThemePreferenceStore(storage);
    expect(first.getState()).toMatchObject({ preference: 'dark', hydrated: false });
    await settle();
    expect(first.getState().hydrated).toBe(true);
    first.setState({ preference: 'light' });
    await settle();

    const afterRestart = createThemePreferenceStore(storage);
    await settle();
    expect(afterRestart.getState()).toMatchObject({ preference: 'light', hydrated: true });
  });

  it('falls back to dark for anything unexpected in storage, including the old "system" value', async () => {
    for (const saved of [{ preference: 'system' }, { preference: 'blue' }, 'garbage', null]) {
      const storage = memoryStorage();
      await storage.setItem('theme-preference', JSON.stringify({ state: saved, version: 1 }));
      const store = createThemePreferenceStore(storage);
      await settle();
      expect(store.getState()).toMatchObject({ preference: 'dark', hydrated: true });
    }
  });
});
