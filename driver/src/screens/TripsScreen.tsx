import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bike, Car } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme/theme';

const mockTrips = [
  { id: '1', service: 'BIKE' as const, route: 'Kigali Heights → Convention Centre', date: 'Today, 9:12 AM', amount: 2000, rating: 5 },
  { id: '2', service: 'ECONOMY' as const, route: 'Remera → Kimihurura', date: 'Today, 8:30 AM', amount: 4500, rating: 5 },
  { id: '3', service: 'BIKE' as const, route: 'Nyamirambo → Airport', date: 'Yesterday, 6:45 PM', amount: 3200, rating: 4 },
];

export default function TripsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={typography.h2}>Trips</Text>
      </View>
      <FlatList
        data={mockTrips}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => {
          const Icon = item.service === 'BIKE' ? Bike : Car;
          return (
            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Icon size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{item.route}</Text>
                <Text style={typography.bodyMuted}>{item.date}</Text>
              </View>
              <Text style={typography.body}>{item.amount.toLocaleString()} RWF</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.md, paddingBottom: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md },
  iconWrap: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});
