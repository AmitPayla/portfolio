import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { marketData } from '@/services/marketData';
import { useLoadState, useRefreshState, useWatchlist, useWatchlistHydrated } from '@/state/hooks';
import { watchlistStore } from '@/state/watchlistStore';
import { openSheet } from '@/features/sheets/sheetStore';
import { FeedStatusPill, PausedBanner } from '@/ui/components/FeedStatus';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/primitives';
import { HeaderBackdrop, ScreenTitle } from '@/ui/components/ScreenHeader';
import { Skeleton } from '@/ui/components/Skeleton';
import { ErrorState, StateView } from '@/ui/components/StateView';
import { showToast } from '@/ui/components/Toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, space } from '@/ui/theme/tokens';
import { WATCH_ROW_HEIGHT, WatchlistRow } from './WatchlistRow';

const keyExtractor = (symbol: string) => symbol;
const openAdd = () => openSheet({ kind: 'add-symbol' });
const openDevMenu = () => openSheet({ kind: 'dev' });
const layoutTransition = LinearTransition.springify().damping(20).stiffness(180);

function removeWithUndo(symbol: string) {
  const index = watchlistStore.getState().symbols.indexOf(symbol);
  watchlistStore.getState().remove(symbol);
  showToast({
    tone: 'info',
    title: `${symbol} removed`,
    action: { label: 'UNDO', onPress: () => watchlistStore.getState().restore(symbol, index) },
  });
}

export function WatchlistScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const symbols = useWatchlist();
  const hydrated = useWatchlistHydrated();
  const load = useLoadState();
  const refresh = useRefreshState();

  const openStock = useCallback((symbol: string) => router.push(`/stock/${symbol}`), [router]);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <Animated.View exiting={FadeOut.duration(160)}>
        <WatchlistRow symbol={item} onOpen={openStock} onRemove={removeWithUndo} />
      </Animated.View>
    ),
    [openStock],
  );

  const header = useMemo(
    () => (
      <View>
        <HeaderBackdrop height={insets.top + 150} />
        <ScreenTitle
          eyebrow={hydrated ? `${symbols.length} ${symbols.length === 1 ? 'stock' : 'stocks'}` : 'Loading'}
          title="Watchlist"
          right={
            <View style={styles.headerActions}>
              <FeedStatusPill onLongPress={openDevMenu} />
            </View>
          }
        />
        {symbols.length > 0 ? (
          <View style={styles.addRow}>
            <AppText variant="caption" color={colors.onHeader} style={styles.hint}>
              Swipe a stock left to remove it
            </AppText>
            <Button label="Add" icon="add" tone="brand" onPress={openAdd} style={styles.addButton} accessibilityLabel="Add a stock to the watchlist" />
          </View>
        ) : null}
      </View>
    ),
    [insets.top, hydrated, symbols.length, colors.onHeader],
  );

  if (!hydrated || load.status === 'loading' || load.status === 'idle') {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]} testID="watchlist-loading">
        <HeaderBackdrop height={insets.top + 150} />
        <ScreenTitle eyebrow="Loading" title="Watchlist" />
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Skeleton width={44} height={44} rounded={14} />
            <View style={styles.skeletonText}>
              <Skeleton width="40%" height={14} />
              <Skeleton width="60%" height={11} />
            </View>
            <Skeleton width={70} height={16} />
          </View>
        ))}
      </View>
    );
  }

  if (load.status === 'error') {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <HeaderBackdrop height={insets.top + 150} />
        <ScreenTitle eyebrow={`${symbols.length} stocks`} title="Watchlist" />
        <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ErrorState message={load.error ?? 'Please check your connection.'} onRetry={() => void marketData.load()} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Animated.FlatList
        data={symbols}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header}
        itemLayoutAnimation={layoutTransition}
        ListEmptyComponent={
          <StateView
            icon="star-outline"
            tone="brand"
            title="Your watchlist is empty"
            message="Add stocks to follow their live price and day change."
            actionLabel="Add stocks"
            actionIcon="add"
            onAction={openAdd}
            testID="watchlist-empty"
          />
        }
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        refreshControl={
          <RefreshControl
            refreshing={refresh.inFlight}
            onRefresh={() => void marketData.refresh()}
            tintColor={colors.text}
            colors={[colors.onBrand]}
            progressBackgroundColor={colors.brand}
            progressViewOffset={insets.top}
          />
        }
        testID="watchlist-list"
      />
      <PausedBanner top={insets.top + space.sm} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md },
  addButton: { minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill },
  hint: { flex: 1, opacity: 0.7 },
  errorCard: { marginHorizontal: space.lg, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth },
  skeletonRow: {
    height: WATCH_ROW_HEIGHT,
    marginHorizontal: space.lg,
    marginBottom: 10,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  skeletonText: { flex: 1, gap: 8 },
});
