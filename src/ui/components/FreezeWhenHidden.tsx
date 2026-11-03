import { useIsFocused, useNavigation, useRoute } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Freeze } from 'react-freeze';
import { HoldPrices } from '@/state/marketSource';

/** Long enough for the tab-switch animation to finish before we freeze the outgoing tab. */
const FREEZE_DELAY_MS = 400;

type TabState = { readonly index: number; readonly routes: readonly { readonly key: string }[] };

const selectedKey = (state: TabState | undefined) => state?.routes[state.index]?.key;

/**
 * Whether this tab is the one selected in the tab bar. Unlike `useIsFocused`,
 * it stays true while a stack screen (stock detail) is pushed on top.
 */
function useIsSelectedTab(): boolean {
  const navigation = useNavigation();
  const { key } = useRoute();
  const [selected, setSelected] = useState(() => selectedKey(navigation.getState()) === key);
  useEffect(
    () => navigation.addListener('state', (e) => setSelected(selectedKey(e.data.state) === key)),
    [navigation, key],
  );
  return selected;
}

/**
 * Stops a tab that another tab is covering from rendering. Expo Router's JS
 * tabs ignore the `freezeOnBlur` option (they pass `freezeOnBlur: false` to
 * every tab screen), so a hidden Portfolio would keep re-rendering rows on
 * every tick. Freeze suspends the subtree: store updates still arrive, but
 * React skips rendering until the tab is selected again, then renders once
 * with the latest state.
 *
 * The tab under a pushed stock detail is NOT frozen. Freezing hides the
 * content, and on iOS the swipe-back gesture shows that screen before it
 * regains focus, so it would appear blank until the thaw finished rendering.
 * Instead, any tab without focus holds its prices (<HoldPrices>): it stays
 * visible with the prices it last showed, skips every tick, and catches up in
 * one render when it is focused again.
 */
export function FreezeWhenHidden({ children }: { readonly children: ReactNode }) {
  const selected = useIsSelectedTab();
  const focused = useIsFocused();
  const [hiddenLongEnough, setHiddenLongEnough] = useState(false);
  // Thaw immediately on selection (render-phase update, no extra effect pass).
  if (selected && hiddenLongEnough) setHiddenLongEnough(false);

  useEffect(() => {
    if (selected) return;
    const id = setTimeout(() => setHiddenLongEnough(true), FREEZE_DELAY_MS);
    return () => clearTimeout(id);
  }, [selected]);

  return (
    <HoldPrices held={!focused}>
      <Freeze freeze={!selected && hiddenLongEnough}>{children}</Freeze>
    </HoldPrices>
  );
}
