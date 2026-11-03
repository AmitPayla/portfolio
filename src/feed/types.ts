/**
 * The contract between the app and any live price source. The simulator and a
 * real WebSocket client both implement `PriceFeed`; the rest of the app only
 * ever sees this interface, so swapping one for the other is a one-line change
 * in the composition root (src/services/marketData.ts).
 */

export type FeedConnectionState = 'connecting' | 'open' | 'closed';

/**
 * A tick as it arrives on the wire: prices in rupees, only the fields that
 * changed. `seq` increases per symbol; a tick with a lower seq than one
 * already seen is late and must be ignored by the consumer.
 */
export interface WireTick {
  readonly symbol: string;
  readonly seq: number;
  readonly ltp?: number;
  readonly high?: number;
  readonly low?: number;
  readonly volume?: number;
}

export type Unsubscribe = () => void;

export interface PriceFeed {
  /** Opens the connection. Safe to call when already connecting or open. */
  connect(): void;
  /** Closes the connection on purpose (app backgrounded, screen unmounted). */
  disconnect(): void;
  /** Which symbols to stream, like a socket subscription message. */
  subscribe(symbols: readonly string[]): void;
  onTick(handler: (tick: WireTick) => void): Unsubscribe;
  onStateChange(handler: (state: FeedConnectionState) => void): Unsubscribe;
}
