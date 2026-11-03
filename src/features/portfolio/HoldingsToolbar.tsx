import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { SortKey, SortSpec } from '@/domain/holdingsList';
import { AppText } from '@/ui/components/AppText';
import { Chip } from '@/ui/components/primitives';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts, radius, space } from '@/ui/theme/tokens';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'value', label: 'Value' },
  { key: 'pnl', label: 'P&L' },
  { key: 'name', label: 'Name' },
];

export const HoldingsToolbar = memo(function HoldingsToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
}: {
  readonly query: string;
  readonly onQueryChange: (q: string) => void;
  readonly sort: SortSpec;
  readonly onSortChange: (s: SortSpec) => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const pick = (key: SortKey) => {
    if (key === sort.key) {
      onSortChange({ key, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ key, direction: key === 'name' ? 'asc' : 'desc' });
    }
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.search,
          { backgroundColor: colors.surface, borderColor: focused ? colors.brand : colors.border },
        ]}
      >
        <Ionicons name="search" size={18} color={focused ? colors.brand : colors.textMuted} />
        <View style={styles.inputBox}>
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Filter holdings by symbol"
            placeholderTextColor={colors.textFaint}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.input, { color: colors.text }]}
            selectionColor={colors.brand}
            accessibilityLabel="Filter holdings by symbol"
            testID="holdings-search"
          />
        </View>
        {query.length > 0 ? (
          <Pressable onPress={() => onQueryChange('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.chips}>
        <AppText variant="caption" tone="muted" style={styles.sortLabel}>
          Sort
        </AppText>
        {SORTS.map(({ key, label }) => {
          const selected = sort.key === key;
          return (
            <Chip
              key={key}
              label={label}
              selected={selected}
              icon={selected ? (sort.direction === 'asc' ? 'arrow-up' : 'arrow-down') : undefined}
              onPress={() => pick(key)}
              accessibilityLabel={`Sort by ${label}${selected ? `, ${sort.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
            />
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, gap: space.md, paddingTop: space.xl, paddingBottom: space.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1.2,
    paddingHorizontal: space.md,
  },
  inputBox: { flex: 1, justifyContent: 'center', height: '100%' },
  input: { fontFamily: fonts.semibold, fontSize: 14.5, paddingVertical: 0, height: '100%' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sortLabel: { marginRight: 2 },
});
