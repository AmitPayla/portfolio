import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_SORT, type SortSpec } from '@/domain/holdingsList';
import { marketData } from '@/services/marketData';
import { useHoldingSymbols, useLoadState, useRefreshState } from '@/state/hooks';
import { openSheet } from '@/features/sheets/sheetStore';
import { FeedStatusPill, PausedBanner } from '@/ui/components/FeedStatus';
import { HeaderBackdrop, ScreenTitle } from '@/ui/components/ScreenHeader';
import { Skeleton } from '@/ui/components/Skeleton';
import { ErrorState, StateView } from '@/ui/components/StateView';
import { showToast } from '@/ui/components/Toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, space } from '@/ui/theme/tokens';
import { HOLDING_ROW_GAP, HOLDING_ROW_HEIGHT, HoldingRow } from './HoldingRow';
import { HoldingsToolbar } from './HoldingsToolbar';
import { SummaryCard, SummaryCardSkeleton } from './SummaryCard';
import { useHoldingOrder } from './useHoldingOrder';

const ITEM_LENGTH = HOLDING_ROW_HEIGHT + HOLDING_ROW_GAP;
const keyExtractor = (symbol: string) => symbol;
const openDevMenu = () => openSheet({ kind: 'dev' });
// Springy glide when a sort moves rows; runs as a native layout animation.
const reorderTransition = LinearTransition.springify().damping(20).stiffness(170);

function TitleBand({ count }: { readonly count: number }) {
  return (
    <ScreenTitle
      eyebrow={`${count} ${count === 1 ? 'holding' : 'holdings'}`}
      title="Portfolio"
      right={<FeedStatusPill onLongPress={openDevMenu} />}
    />
  );
}

function RowSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.skeletonRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.skeletonTop}>
        <Skeleton width={42} height={42} rounded={13} />
        <View style={styles.skeletonText}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="70%" height={11} />
        </View>
        <Skeleton width={80} height={18} />
      </View>
      <Skeleton width="100%" height={12} />
    </View>
  );
}

export function PortfolioScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const focused = useIsFocused();
  const load = useLoadState();
  const refresh = useRefreshState();
  const symbols = useHoldingSymbols();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortSpec>(DEFAULT_SORT);
  const isInteracting = useRef(false);
  const headerHeight = useRef(0);
  const order = useHoldingOrder(sort, query, { enabled: focused, isInteracting });

  useEffect(() => {
    if (refresh.error) showToast({ tone: 'error', title: 'Refresh failed', message: `${refresh.error}. Showing the last prices.` });
  }, [refresh.error]);

  const openStock = useCallback((symbol: string) => router.push(`/stock/${symbol}`), [router]);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => <HoldingRow symbol={item} onOpen={openStock} />,
    [openStock],
  );
  // Fixed-height rows: the list never has to measure them. Offsets include the header above the rows.
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: ITEM_LENGTH, offset: headerHeight.current + ITEM_LENGTH * index, index }),
    [],
  );
  const onRefresh = useCallback(() => void marketData.refresh(), []);

  // A stable element (not an inline component) so typing in the search box never remounts it.
  const listHeader = useMemo(
    () => (
      <View onLayout={(e) => (headerHeight.current = e.nativeEvent.layout.height)}>
        <HeaderBackdrop height={insets.top + 210} />
        <TitleBand count={symbols.length} />
        <SummaryCard />
        <HoldingsToolbar query={query} onQueryChange={setQuery} sort={sort} onSortChange={setSort} />
      </View>
    ),
    [insets.top, symbols.length, query, sort],
  );

  const listEmpty = useMemo(
    () =>
      symbols.length === 0 ? (
        <StateView
          icon="briefcase-outline"
          tone="brand"
          title="No holdings yet"
          message="Buy a stock from its detail page and it will show up here."
          actionLabel="Browse watchlist"
          actionIcon="star"
          onAction={() => router.navigate('/watchlist')}
        />
      ) : (
        <StateView
          icon="search"
          title={`No holdings match "${query.trim()}"`}
          message="Try another symbol."
          actionLabel="Clear search"
          onAction={() => setQuery('')}
        />
      ),
    [symbols.length, query, router],
  );

  if (load.status !== 'ready') {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <HeaderBackdrop height={insets.top + 210} />
        <TitleBand count={symbols.length} />
        {load.status === 'error' ? (
          <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ErrorState message={load.error ?? 'Please check your connection.'} onRetry={() => void marketData.load()} />
          </View>
        ) : (
          <View testID="portfolio-loading">
            <SummaryCardSkeleton />
            <View style={styles.skeletonList}>
              {Array.from({ length: 5 }, (_, i) => (
                <RowSkeleton key={i} />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Animated.FlatList
        data={order}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        itemLayoutAnimation={reorderTransition}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={9}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        onScrollBeginDrag={() => (isInteracting.current = true)}
        onScrollEndDrag={() => (isInteracting.current = false)}
        onMomentumScrollBegin={() => (isInteracting.current = true)}
        onMomentumScrollEnd={() => (isInteracting.current = false)}
        refreshControl={
          <RefreshControl
            refreshing={refresh.inFlight}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.onBrand]}
            progressBackgroundColor={colors.brand}
            progressViewOffset={insets.top}
          />
        }
        testID="holdings-list"
      />
      <PausedBanner top={insets.top + space.sm} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  errorCard: {
    marginHorizontal: space.lg,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  skeletonList: { paddingTop: space.xl },
  skeletonRow: {
    height: HOLDING_ROW_HEIGHT,
    marginHorizontal: space.lg,
    marginBottom: HOLDING_ROW_GAP,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    justifyContent: 'space-between',
  },
  skeletonTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  skeletonText: { flex: 1, gap: 8 },
});
