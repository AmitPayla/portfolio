import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import { companyName, isMarketSymbol } from '@/domain/symbols';
import { marketData } from '@/services/marketData';
import { marketStore } from '@/state/marketStore';
import { useHeldQty, useIsUnavailable, useIsWatched, useLoadState } from '@/state/hooks';
import { watchlistStore } from '@/state/watchlistStore';
import { openSheet } from '@/features/sheets/sheetStore';
import { AppText } from '@/ui/components/AppText';
import { PausedBanner } from '@/ui/components/FeedStatus';
import { Button, IconButton, SymbolAvatar } from '@/ui/components/primitives';
import { Skeleton } from '@/ui/components/Skeleton';
import { ErrorState, StateView } from '@/ui/components/StateView';
import { showToast } from '@/ui/components/Toast';
import { DURATION, EASE_OUT } from '@/ui/theme/motion';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, space } from '@/ui/theme/tokens';
import { LiveChartCard, PositionCard, PriceHero, StatsCard } from './DetailSections';

function toggleWatch(symbol: string, watched: boolean) {
  const store = watchlistStore.getState();
  if (watched) store.remove(symbol);
  else store.add(symbol);
  showToast({ tone: 'success', title: watched ? `${symbol} removed from watchlist` : `${symbol} added to watchlist` });
}

const Header = memo(function Header({ symbol, canWatch }: { readonly symbol: string; readonly canWatch: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const watched = useIsWatched(symbol);
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <IconButton icon="arrow-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Back" />
      <View style={styles.headerTitle}>
        <SymbolAvatar symbol={symbol} size={36} />
        <View style={styles.headerText}>
          <AppText variant="heading" numberOfLines={1} accessibilityRole="header">
            {symbol}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {companyName(symbol)}
          </AppText>
        </View>
      </View>
      {canWatch ? (
        <IconButton
          icon={watched ? 'star' : 'star-outline'}
          color={watched ? colors.brand : colors.text}
          background={watched ? colors.brandSoft : colors.surface}
          onPress={() => toggleWatch(symbol, watched)}
          accessibilityLabel={watched ? 'Remove from watchlist' : 'Add to watchlist'}
        />
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
});

/** Sticky Buy / Sell bar. Disabled without a price: we never fill at a guessed price. */
const ActionBar = memo(function ActionBar({ symbol }: { readonly symbol: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const hasPrice = useStore(marketStore, (s) => s.quotes[symbol] != null);
  const held = useHeldQty(symbol);
  return (
    <View
      style={[
        styles.actionBar,
        { paddingBottom: Math.max(insets.bottom, space.md), backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}
    >
      {!hasPrice ? (
        <AppText variant="caption" tone="muted" style={styles.actionNote}>
          Trading is off: there is no live price for {symbol}.
        </AppText>
      ) : null}
      <View style={styles.actionRow}>
        <Button
          label="Sell"
          tone="ghost"
          onPress={() => openSheet({ kind: 'trade', symbol, side: 'sell' })}
          disabled={!hasPrice || held === 0}
          style={[styles.actionButton, { borderColor: colors.loss }]}
          accessibilityLabel={held === 0 ? `Sell ${symbol}, unavailable: you hold no shares` : `Sell ${symbol}`}
        />
        <Button
          label="Buy"
          tone="buy"
          onPress={() => openSheet({ kind: 'trade', symbol, side: 'buy' })}
          disabled={!hasPrice}
          style={styles.actionButton}
          accessibilityLabel={`Buy ${symbol}`}
        />
      </View>
    </View>
  );
});

function DetailSkeleton() {
  return (
    <View style={styles.skeleton} testID="detail-loading">
      <Skeleton width="55%" height={36} />
      <Skeleton width="35%" height={18} />
      <Skeleton width="100%" height={180} rounded={radius.xl} style={{ marginTop: space.lg }} />
      <Skeleton width="100%" height={140} rounded={radius.xl} />
    </View>
  );
}

export function StockDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ symbol?: string }>();
  const symbol = String(params.symbol ?? '').toUpperCase();
  const load = useLoadState();
  const unavailable = useIsUnavailable(symbol);
  const held = useHeldQty(symbol);
  const known = isMarketSymbol(symbol) || held > 0;

  let body;
  if (!known) {
    body = (
      <StateView
        icon="help-circle-outline"
        title={`We don't track ${symbol || 'this symbol'}`}
        message="Pick a stock from your portfolio or watchlist."
      />
    );
  } else if (load.status === 'error') {
    body = <ErrorState message={load.error ?? 'Please check your connection.'} onRetry={() => void marketData.load()} />;
  } else if (load.status !== 'ready') {
    body = <DetailSkeleton />;
  } else {
    body = (
      <>
        {unavailable ? (
          <View style={[styles.unavailable, { backgroundColor: colors.warnSoft }]} testID="detail-unavailable">
            <AppText variant="label" color={colors.warn}>
              No live price for {symbol}
            </AppText>
            <AppText variant="caption" tone="muted">
              The price service doesn&apos;t return this symbol, so values show as --. They are never filled in or guessed.
            </AppText>
          </View>
        ) : null}
        <PriceHero symbol={symbol} />
        <Animated.View entering={FadeInDown.duration(DURATION.slow).easing(EASE_OUT)}>
          <LiveChartCard symbol={symbol} />
          <PositionCard symbol={symbol} />
          <StatsCard symbol={symbol} />
        </Animated.View>
      </>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Header symbol={symbol} canWatch={isMarketSymbol(symbol)} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
      {known && load.status === 'ready' ? <ActionBar symbol={symbol} /> : null}
      <PausedBanner top={insets.top + 64} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerText: { flexShrink: 1 },
  headerSpacer: { width: 40 },
  scroll: { paddingBottom: space.xxxl },
  unavailable: { marginHorizontal: space.lg, marginTop: space.sm, padding: space.md, borderRadius: radius.lg, gap: 2 },
  skeleton: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  actionBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  actionNote: { textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: space.md },
  actionButton: { flex: 1 },
});
