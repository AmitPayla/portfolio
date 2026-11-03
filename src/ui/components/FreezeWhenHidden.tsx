import { useIsFocused } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Freeze } from 'react-freeze';

/** Long enough for the tab-switch animation to finish before we freeze the outgoing tab. */
const FREEZE_DELAY_MS = 400;

/**
 * Stops a hidden tab from rendering. Expo Router's JS tabs ignore the
 * `freezeOnBlur` option (they pass `freezeOnBlur: false` to every tab
 * screen), so a hidden Portfolio would keep re-rendering rows on every tick.
 * Freeze suspends the subtree: store updates still arrive, but React skips
 * rendering until the tab is focused again, then renders once with the
 * latest state.
 */
export function FreezeWhenHidden({ children }: { readonly children: ReactNode }) {
  const focused = useIsFocused();
  const [hiddenLongEnough, setHiddenLongEnough] = useState(false);
  // Thaw immediately on focus (render-phase update, no extra effect pass).
  if (focused && hiddenLongEnough) setHiddenLongEnough(false);

  useEffect(() => {
    if (focused) return;
    const id = setTimeout(() => setHiddenLongEnough(true), FREEZE_DELAY_MS);
    return () => clearTimeout(id);
  }, [focused]);

  return <Freeze freeze={!focused && hiddenLongEnough}>{children}</Freeze>;
}
