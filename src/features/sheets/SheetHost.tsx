import { useCallback, useState } from 'react';
import { useStore } from 'zustand';
import { BottomSheet } from '@/ui/components/BottomSheet';
import { DevMenuSheet } from '../dev/DevMenuSheet';
import { TradeSheet } from '../trade/TradeSheet';
import { AddSymbolSheet } from '../watchlist/AddSymbolSheet';
import { closeSheet, sheetStore, type SheetRequest } from './sheetStore';

/**
 * Renders the active sheet. It keeps the last request mounted while the exit
 * animation plays, then unmounts it, so a closed sheet costs nothing (no
 * subscriptions to live prices while hidden).
 */
export function SheetHost() {
  const current = useStore(sheetStore, (s) => s.current);
  const [rendered, setRendered] = useState<SheetRequest | null>(current);
  // Adopt a new request during render (React's "adjust state on prop change" pattern), not in an effect.
  if (current && current !== rendered) setRendered(current);

  const onClosed = useCallback(() => {
    if (!sheetStore.getState().current) setRendered(null);
  }, []);

  if (!rendered) return null;
  return (
    <BottomSheet visible={current != null} onRequestClose={closeSheet} onClosed={onClosed} testID="bottom-sheet">
      {rendered.kind === 'trade' ? (
        <TradeSheet key={`${rendered.symbol}-${rendered.side}`} symbol={rendered.symbol} initialSide={rendered.side} />
      ) : rendered.kind === 'add-symbol' ? (
        <AddSymbolSheet />
      ) : (
        <DevMenuSheet />
      )}
    </BottomSheet>
  );
}
