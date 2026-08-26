import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Wallet, ShieldCheck, Star } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, radius, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const notifications = [
  { id: '1', icon: Wallet, title: 'Weekly payout sent', body: '112,000 RWF deposited to your Mobile Money.', time: '3h ago' },
  { id: '2', icon: Star, title: 'New 5-star rating', body: 'Chantal M. rated your last trip 5 stars.', time: '1d ago' },
  { id: '3', icon: ShieldCheck, title: 'Document reminder', body: 'Your insurance certificate expires in 30 days.', time: '2d ago' },
];

export default function NotificationsScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={18} color={colors.ink} />
        </Pressable>
        <Text style={typography.h2}>Notifications</Text>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <item.icon size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{item.title}</Text>
              <Text style={typography.bodyMuted}>{item.body}</Text>
              <Text style={typography.caption}>{item.time}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  backButton: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md },
  iconWrap: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});
