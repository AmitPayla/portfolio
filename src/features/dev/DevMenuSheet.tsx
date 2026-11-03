import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatCount } from '@/domain/format';
import { feedDevControls } from '@/services/marketData';
import { previewLoading } from '@/state/loadingPreview';
import { useStream } from '@/state/hooks';
import { closeSheet } from '@/features/sheets/sheetStore';
import { AppText } from '@/ui/components/AppText';
import { Button, Chip } from '@/ui/components/primitives';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, space } from '@/ui/theme/tokens';

const RATES = [5, 20, 50, 100] as const;

/**
 * Simulator controls for demos and profiling. Opened by long-pressing the
 * summary card's current value (Portfolio) or the "Watchlist" title.
 */
export function DevMenuSheet() {
  const { colors } = useTheme();
  const stream = useStream();
  const [rate, setRate] = useState(feedDevControls.ticksPerSecond);
  const [stats, setStats] = useState(feedDevControls.stats);

  useEffect(() => {
    const id = setInterval(() => setStats(feedDevControls.stats()), 500);
    return () => clearInterval(id);
  }, []);

  const lateShare = stats.received > 0 ? (stats.stale / stats.received) * 100 : 0;
  return (
    <View style={styles.body} testID="dev-menu">
      <View>
        <AppText variant="title">Simulator controls</AppText>
        <AppText variant="caption" tone="muted">
          Feed status: {stream.status}
        </AppText>
      </View>

      <View style={styles.section}>
        <AppText variant="label" tone="muted">
          Ticks per second
        </AppText>
        <View style={styles.chips}>
          {RATES.map((r) => (
            <Chip
              key={r}
              label={String(r)}
              selected={rate === r}
              onPress={() => {
                feedDevControls.setTicksPerSecond(r);
                setRate(r);
              }}
            />
          ))}
        </View>
      </View>

      <View style={[styles.stats, { backgroundColor: colors.sunken }]}>
        {[
          ['Received', formatCount(stats.received)],
          ['Applied', formatCount(stats.applied)],
          ['Late, dropped', `${formatCount(stats.stale)} (${lateShare.toFixed(1)}%)`],
          ['Malformed', formatCount(stats.malformed)],
          ['Store commits', formatCount(stats.flushes)],
        ].map(([label, value]) => (
          <View key={label} style={styles.statRow}>
            <AppText variant="body" tone="muted">
              {label}
            </AppText>
            <AppText variant="label" numeric>
              {value}
            </AppText>
          </View>
        ))}
      </View>

      <Button
        label="Show loading skeleton for 3s"
        icon="hourglass-outline"
        tone="ink"
        onPress={() => {
          previewLoading(3_000);
          closeSheet();
        }}
      />
      <Button
        label="Drop connection for 10s"
        icon="cloud-offline-outline"
        tone="ink"
        onPress={() => {
          feedDevControls.simulateOutage(10_000);
          closeSheet();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, gap: space.lg, paddingTop: space.xs },
  section: { gap: space.sm },
  chips: { flexDirection: 'row', gap: space.sm },
  stats: { borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
