import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EarningsPeriod } from '../types';
import { colors, radius, spacing, typography, shadow } from '../theme/theme';
import { useDriverStore } from '../store/driverStore';

const periods: { id: EarningsPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

export default function EarningsScreen() {
  const [period, setPeriod] = useState<EarningsPeriod>('today');
  const todayEarnings = useDriverStore((s) => s.todayEarnings);
  const todayTrips = useDriverStore((s) => s.todayTrips);

  // Mock scaling per period — a real backend aggregates from completed trips.
  const summary = useMemo(() => {
    const multiplier = { today: 1, week: 6.2, month: 24, all: 180 }[period];
    const gross = Math.round(todayEarnings * multiplier);
    const commission = Math.round(gross * 0.1);
    const bonus = period === 'today' ? 0 : Math.round(gross * 0.02);
    return { gross, commission, bonus, net: gross - commission + bonus, trips: Math.round(todayTrips * multiplier) };
  }, [period, todayEarnings, todayTrips]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={typography.h2}>Earnings</Text>
      </View>

      <View style={styles.periodRow}>
        {periods.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.periodChip, period === p.id && styles.periodChipActive]}
            onPress={() => setPeriod(p.id)}
          >
            <Text style={[styles.periodText, period === p.id && styles.periodTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.netCard}>
        <Text style={styles.netLabel}>Net earnings</Text>
        <Text style={styles.netValue}>{summary.net.toLocaleString()} RWF</Text>
        <Text style={styles.netTrips}>{summary.trips} trips</Text>
      </View>

      <View style={styles.breakdown}>
        <BreakdownRow label="Gross fare" value={summary.gross} />
        <BreakdownRow label="Platform commission" value={-summary.commission} />
        <BreakdownRow label="Bonuses" value={summary.bonus} />
        <View style={styles.divider} />
        <BreakdownRow label="Net earnings" value={summary.net} bold />
      </View>
    </SafeAreaView>
  );
}

function BreakdownRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={bold ? typography.body : typography.bodyMuted}>{label}</Text>
      <Text style={[bold ? typography.body : typography.bodyMuted, value < 0 && { color: colors.error }]}>
        {value >= 0 ? '' : '-'}
        {Math.abs(value).toLocaleString()} RWF
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.md, paddingBottom: 0 },
  periodRow: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  periodChip: { paddingHorizontal: spacing.sm + 2, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  periodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodText: { fontSize: 12, color: colors.ink },
  periodTextActive: { color: colors.white, fontWeight: '600' },
  netCard: { margin: spacing.md, backgroundColor: colors.primaryDark, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  netLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  netValue: { color: colors.white, fontSize: 28, fontWeight: '700', marginTop: 6 },
  netTrips: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  breakdown: { marginHorizontal: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  divider: { height: 0.5, backgroundColor: colors.border, marginVertical: 2 },
});
