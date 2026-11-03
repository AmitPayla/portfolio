import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { marketData } from '@/services/marketData';
import { useLoadState, useRefreshState, useWatchlist, useWatchlistHydrated } from '@/state/hooks';
import { watchlistStore } from '@/state/watchlistStore';
import { openSheet } from '@/features/sheets/sheetStore';
import { PausedBanner } from '@/ui/components/FeedStatus';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/primitives';
import { HeaderBackdrop, ScreenTitle, StatusBarScrim } from '@/ui/components/ScreenHeader';
import { ThemeToggle } from '@/ui/components/ThemeToggle';
import { GroupDivider, useGroupedItemStyle } from '@/ui/components/GroupedList';
import { Skeleton } from '@/ui/components/Skeleton';
import { ErrorState, StateView } from '@/ui/components/StateView';
import { showToast } from '@/ui/components/Toast';
import { DURATION, EASE_IN_OUT } from '@/ui/theme/motion';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, space } from '@/ui/theme/tokens';
import { WATCH_ROW_HEIGHT, WatchlistRow } from './WatchlistRow';

const keyExtractor = (symbol: string) => symbol;
const openAdd = () => openSheet({ kind: 'add-symbol' });
const openDevMenu = () => openSheet({ kind: 'dev' });
const layoutTransition = LinearTransition.duration(DURATION.slow).easing(EASE_IN_OUT);

const SKELETON_ROWS = 5;

/** Placeholder with the same shape as WatchlistRow, inside the same grouped surface. */
function SkeletonRow({ index }: { readonly index: number }) {
  const last = index === SKELETON_ROWS - 1;
  const itemStyle = useGroupedItemStyle(index === 0, last, WATCH_ROW_HEIGHT);
  return (
    <View style={itemStyle}>
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonColumn}>
          <Skeleton width={90} height={15} />
          <Skeleton width={140} height={11} />
        </View>
        <View style={[styles.skeletonColumn, styles.skeletonRight]}>
          <Skeleton width={84} height={15} />
          <Skeleton width={110} height={11} />
        </View>
      </View>
      {last ? null : <GroupDivider />}
    </View>
  );
}

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
  const lastIndex = symbols.length - 1;
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<string>) => (
      <Animated.View exiting={FadeOut.duration(160)}>
        <WatchlistRow symbol={item} onOpen={openStock} onRemove={removeWithUndo} first={index === 0} last={index === lastIndex} />
      </Animated.View>
    ),
    [openStock, lastIndex],
  );

  const header = useMemo(
    () => (
      <View>
        <HeaderBackdrop height={insets.top + 150} />
        <ScreenTitle
          eyebrow={hydrated ? `${symbols.length} ${symbols.length === 1 ? 'stock' : 'stocks'}` : 'Loading'}
          title="Watchlist"
          right={<ThemeToggle />}
          onLongPress={openDevMenu}
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
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <SkeletonRow key={i} index={i} />
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
      <StatusBarScrim />
      <PausedBanner top={insets.top + space.sm} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md },
  addButton: { minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill },
  hint: { flex: 1, opacity: 0.7 },
  errorCard: { marginHorizontal: space.lg, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth },
  skeletonRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  skeletonColumn: { gap: 8 },
  skeletonRight: { alignItems: 'flex-end' },
});
