import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useStore } from 'zustand';
import { formatMoney } from '@/domain/format';
import { companyName, MARKET_SYMBOLS } from '@/domain/symbols';
import { useLtp } from '@/state/hooks';
import { watchlistStore } from '@/state/watchlistStore';
import { AppText } from '@/ui/components/AppText';
import { SymbolAvatar } from '@/ui/components/primitives';
import { PressableScale } from '@/ui/components/PressableScale';
import { DURATION } from '@/ui/theme/motion';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts, radius, space } from '@/ui/theme/tokens';

/** Watch toggle: an outlined "+ Watch" pill that springs into a filled "Watching" state. */
function WatchToggle({ added, onPress, symbol }: { readonly added: boolean; readonly onPress: () => void; readonly symbol: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityState={{ selected: added }}
      accessibilityLabel={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
      testID={`watch-toggle-${symbol}`}
      style={[
        styles.watch,
        added
          ? { backgroundColor: colors.brand, borderColor: colors.brand }
          : { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft },
      ]}
    >
      {added ? (
        <Animated.View entering={FadeIn.duration(DURATION.fast)} style={styles.watchInner}>
          <Ionicons name="checkmark" size={14} color={colors.onBrand} />
          <AppText variant="caption" weight="extrabold" color={colors.onBrand}>
            Watching
          </AppText>
        </Animated.View>
      ) : (
        <View style={styles.watchInner}>
          <Ionicons name="add" size={15} color={colors.brand} />
          <AppText variant="caption" weight="extrabold" color={colors.brand}>
            Watch
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const PickerRow = memo(function PickerRow({ symbol, added }: { readonly symbol: string; readonly added: boolean }) {
  const { colors } = useTheme();
  const ltp = useLtp(symbol);
  const toggle = () => {
    const { add, remove } = watchlistStore.getState();
    if (added) remove(symbol);
    else add(symbol);
  };
  return (
    <View style={[styles.row, { borderBottomColor: colors.hairline }]}>
      <SymbolAvatar symbol={symbol} size={38} />
      <View style={styles.names}>
        <AppText variant="label">{symbol}</AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {companyName(symbol)}
        </AppText>
      </View>
      <AppText variant="caption" tone="muted" numeric>
        {formatMoney(ltp)}
      </AppText>
      <WatchToggle added={added} onPress={toggle} symbol={symbol} />
    </View>
  );
});

/** Picker over the 25 tradable symbols, searchable; toggles membership in place. */
export function AddSymbolSheet() {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const watched = useStore(watchlistStore, (s) => s.symbols);
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const q = query.trim().toUpperCase();
    return MARKET_SYMBOLS.filter((s) => q === '' || s.includes(q) || companyName(s).toUpperCase().includes(q));
  }, [query]);

  return (
    // flexShrink lets the list give way when BottomSheet caps its height above the keyboard.
    <View style={{ maxHeight: height * 0.78, flexShrink: 1 }} testID="add-symbol-sheet">
      <View style={styles.header}>
        <AppText variant="title">Add to watchlist</AppText>
        <AppText variant="caption" tone="muted">
          {watched.length} of {MARKET_SYMBOLS.length} added
        </AppText>
      </View>
      <View style={[styles.search, { backgroundColor: colors.sunken }]}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search symbol or company"
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
          autoCapitalize="characters"
          style={[styles.input, { color: colors.text }]}
          selectionColor={colors.brand}
          testID="add-symbol-search"
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(s) => s}
        renderItem={({ item }) => <PickerRow symbol={item} added={watched.includes(item)} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <AppText variant="body" tone="muted" style={styles.empty}>
            No symbol matches “{query.trim()}”.
          </AppText>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: 2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.xl,
    marginTop: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    height: 44,
    borderRadius: radius.md,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, paddingVertical: 0 },
  listContent: { paddingHorizontal: space.xl, paddingBottom: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  names: { flex: 1 },
  watch: {
    minWidth: 96,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  watchInner: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  empty: { textAlign: 'center', paddingVertical: space.xl },
});
