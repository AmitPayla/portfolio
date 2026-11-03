import { createStore } from 'zustand/vanilla';
import type { OrderSide } from '@/domain/orders';

export type SheetRequest =
  | { readonly kind: 'trade'; readonly symbol: string; readonly side: OrderSide }
  | { readonly kind: 'add-symbol' }
  | { readonly kind: 'dev' };

/** Which sheet is open. One host at the root renders it above tabs and stack screens. */
export const sheetStore = createStore<{ readonly current: SheetRequest | null }>()(() => ({ current: null }));

export function openSheet(request: SheetRequest): void {
  sheetStore.setState({ current: request });
}

export function closeSheet(): void {
  sheetStore.setState({ current: null });
}
