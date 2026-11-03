# Live Portfolio

A React Native (Expo SDK 58, TypeScript strict) stock portfolio that stays correct and smooth while prices tick about 20 times a second.

## 1. Install and run on iOS

**Requirements:** a Mac or PC with **Node 22** (Expo SDK 58 needs Node ≥ 22.13; `.nvmrc` pins it), and an iPhone with **Expo Go** from the App Store. No Apple developer account is needed.

```bash
nvm use          # Node 22
npm install
```

### On an iPhone (Expo Go)

iOS Expo Go only opens a project from your computer when **both sides are signed in to the same Expo account** (a free account; required since September 2026).

1. Install **Expo Go** from the App Store and sign in (account icon, top-right). Create a free account at [expo.dev/signup](https://expo.dev/signup) if you don't have one.
2. Sign in to the same account on the computer: `npx expo login` (check with `npx expo whoami`).
3. Start the dev server and scan the QR code with the iPhone Camera, or open the project under "Development servers" in Expo Go:

   ```bash
   npx expo start
   ```

Notes:

- The phone and the computer must be on the same Wi-Fi. If the network blocks that, use `npx expo start --tunnel`.
- App Store Expo Go supports only the latest SDK. If it reports an incompatible SDK, upgrade the project (`npx expo install expo@latest && npx expo install --fix`) or use a development build (below).

### On the iOS Simulator (Mac with Xcode)

Run `npx expo start` and press **`i`**. The Expo CLI boots a simulator and installs the matching Expo Go on it.

### Development build (no Expo Go)

With Xcode and a free Apple ID (Personal Team signing), connect the iPhone, turn on Developer Mode, and run:

```bash
npx expo run:ios --device
```

Free-account builds expire after 7 days. If the bundle ID is taken, change `ios.bundleIdentifier` in `app.json`.

### Checks

```bash
npm test           # 129 unit tests (Jest, jest-expo)
npm run typecheck  # tsc --noEmit, strict + noUncheckedIndexedAccess
npm run lint       # eslint-config-expo, including the React Compiler hook rules
```

**Dev menu:** long-press the summary card's current value (Portfolio) or the "Watchlist" title. From there you can:

- change the tick rate (5/20/50/100 per second);
- drop the connection for 10 s, to watch the backoff and catch-up;
- show the loading skeletons for 3 s (display only, nothing is refetched);
- see pipeline counters (received / applied / late-dropped / commits).

## 2. State and re-render approach, and why

**Choice: zustand vanilla stores, read through narrow selectors** (`useSyncExternalStore` underneath).

**Why:**

- **Re-renders follow the data.** Prices change 20 times a second, so a component must re-render only when a value it actually shows changes. Selector subscriptions give exactly that.
- **Not React context:** it re-renders every consumer on every change.
- **Not Redux:** it has the same subscription model with more ceremony.
- **Testable without React:** the stores are plain objects, so the price pipeline, the order logic and the summary maths are unit-tested directly.

**Where the work goes:**

- **Data flow.** The simulated feed (behind a socket-like `PriceFeed` interface) and one REST snapshot go into `MarketDataService`, which writes the market store. Screens never talk to the feed; they read the stores.
- **Calculations.** P&L, averages, rounding and the summary are plain functions in `src/domain`, outside components, with unit tests.
- **Money.** It is integer paise behind a branded `Paise` type, so rounding is deliberate and every total equals the sum of its rows to the paisa.

The rules that keep renders scoped:

1. **Ticks are buffered and flushed once per animation frame:** one store commit per frame, however fast the feed runs. Late ticks (older sequence numbers) are dropped before they reach the store.
2. **The list's data is an array of symbols, not quotes.** It changes only when the visible order changes, so a tick never re-renders the `FlatList` itself.
3. **Each row subscribes to its own primitives:** its holding, `ltp` and `prevClose`. A tick replaces only that symbol's quote object, and primitives compare by value. A tick for RELIANCE re-renders the RELIANCE row and nothing else; a volume-only tick re-renders no row.
4. **The summary uses a value-equality selector** (`useStoreWithEqualityFn`). Totals are recomputed on every flush (21 holdings: microseconds), but the card re-renders only when a number it shows changed.
5. **Status is written only on transitions** (live ↔ paused ↔ reconnecting), never per tick.
6. **Live sorts are throttled.** Value/P&L order is re-checked every 1.5 s, skipped while the user is dragging the list, and committed only if it actually changed. Rows glide to their new place instead of jumping 20 times a second.
7. **Covered screens stop rendering, without going blank:**
   - A tab hidden behind the other tab is frozen with `react-freeze`. Expo Router's JS tabs ignore `freezeOnBlur`, so each tab route wraps its screen.
   - The tab under a pushed stock detail is not frozen, because freezing hides content and the iOS swipe-back would show a blank page. Instead it **holds its prices** (`HoldPrices`): it stays visible with the prices it last showed, skips every tick, and catches up in one render when focused again.
8. **The theme context changes only when light/dark flips.** The circular theme reveal and every other animation (price flash, presses, sheets, pull-to-refresh) run on the UI thread with Reanimated 4.
9. **List hygiene:**
   - fixed-height rows with `getItemLayout`;
   - stable `renderItem` and `keyExtractor`;
   - memoised row halves (the static half skips every tick);
   - a memoised header, so typing in the filter never remounts it.

**Measured on the Android emulator** (temporary render counters, 10-second windows at 20 ticks/s, Portfolio visible):

| Component | Renders / 10 s |
| --- | --- |
| `PortfolioScreen`, toolbar, tab bar | 0 |
| Row identity (static half of each row) | 0 |
| `HoldingRow` (all rows together) | ~122, one per real price change of a held symbol |
| `SummaryCard` | ~122 (its SVG background: 0) |
| Hidden Watchlist tab | 0 |
| Portfolio while the Watchlist tab is open | 0 (~120 before the freeze) |

**Scrolling under ticks:** Android `dumpsys gfxinfo`, about 15 s of flinging the list while 20 ticks/s flow, in a dev build on the emulator. It rendered 1,159 frames, 12 of them janky (1.0%), with a median frame time of 17 ms (60 fps).

**To check it with the Profiler:**

1. Press `j` in the Expo CLI to open React Native DevTools.
2. Open the Profiler tab and record a few seconds.
3. Each commit should contain one `HoldingRow` and `SummaryCard`.

## 3. How Summary handles a holding with no price

OLDCO is requested from the API like every other symbol. The API leaves it out, so it has no quote. **The summary totals cover only holdings that have a live price, and the card says what is left out.**

- **Not counted as zero, not guessed.** `summarizePortfolio` skips it and lists it separately with what was paid for it (₹12,375.00).
- **The same holdings make up every total.** Current value, Invested, Total P&L and Today's P&L all use only the priced holdings. So value − invested = P&L exactly, and every total equals the sum of the rows on screen.
- **The coverage is shown as a number.** "99.38% priced" beside Invested is ₹19,88,101.03 ÷ (₹19,88,101.03 + ₹12,375.00). It reads 100.00% when everything has a price.
- **A footnote names what is missing:**
  - It reads "ⓘ OLDCO has no live price · ₹12,375.00 left out of totals".
  - Two unpriced holdings are named; three or more are counted ("3 holdings have no live price").
  - It appears only when something has no price (`describeUnpriced`, unit-tested).
- **Edge cases:** if no holding has a price, every figure shows `--`, not ₹0. Today's P&L also skips priced holdings with no previous close.
- **Elsewhere:**
  - OLDCO's row shows quantity, average and cost, with `--` for last price, value and P&L, and it sorts last by value or P&L.
  - Its stock page says there is no live price, and trading is disabled, because there is no honest price to fill at.

**Why this choice:**

- Counting it as ₹0 would show a fake −100% loss.
- Putting its cost in Invested but not in Current value would make the summary contradict itself: value − invested ≠ P&L.
- Blanking the whole summary would let one delisted stock hide 20 good prices.

## 4. What I skipped, and what I'd do next

**Done from the stretch list:**

- Price flash on the UI thread.
- Reconnect with backoff, plus a catch-up REST fetch.
- A simulator dev menu.

**Extras:**

- A circular light/dark reveal from the tap point; the theme follows the system, and the toggle overrides it.
- A branded pull-to-refresh on iOS, with a haptic.

**Skipped:**

- **Limit orders.**
- **Persisted order history and an orders screen.** Fills are recorded in the store but not persisted or shown as a list.
- **Persisted holdings.** Holdings reset to the bundled CSV on each launch; only the watchlist persists, as the brief requires.

**With another day:**

- **Persist holdings and fills**, with an IST day rollover for "today's" shares.
- **A real `WebSocketPriceFeed`** behind the same interface, with JSON parsing, heartbeats, and a per-session sequence baseline (a server that restarts its numbering must not look permanently stale).
- **Component tests that assert render isolation**, using the React Profiler API in Jest, so a regression fails CI instead of showing up in DevTools.
- **End-to-end tests** with Maestro: buy/sell, swipe to remove, offline retry.
- **Market-hours awareness**, so "paused" and "market closed" are told apart outside 9:15–15:30 IST.
- **A richer chart**, with scrubbing and time labels.
- **A faster theme switch**: take the snapshot on press-in instead of on release, hiding most of its cost behind the finger.
- **A full screen-reader pass** and a colour-vision-friendly palette option.

## 5. Time spent

Roughly **5½ hours**, built with an AI coding assistant (allowed by the brief):

- about 2½ hours for the core app: data pipeline, domain maths and tests, all four screens;
- about 3 hours in a second session: iPhone fixes, the theme switch, and UI polish.
