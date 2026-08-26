import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Car, FileText, ShieldCheck, CircleHelp, LogOut, ChevronRight, Star } from 'lucide-react-native';
import { colors, radius, spacing, typography, shadow } from '../theme/theme';

const menuItems = [
  { icon: Car, label: 'Vehicle details' },
  { icon: FileText, label: 'Documents' },
  { icon: ShieldCheck, label: 'Safety' },
  { icon: CircleHelp, label: 'Help & support' },
];

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <User size={28} color={colors.primary} />
          </View>
          <Text style={typography.h2}>Eric Niyonzima</Text>
          <View style={styles.ratingRow}>
            <Star size={13} color={colors.secondary} fill={colors.secondary} />
            <Text style={typography.bodyMuted}>4.9 · 1,204 trips</Text>
          </View>
        </View>

        <View style={styles.menu}>
          {menuItems.map((item, i) => (
            <Pressable key={i} style={[styles.menuRow, i === menuItems.length - 1 && { borderBottomWidth: 0 }]}>
              <item.icon size={18} color={colors.ink} />
              <Text style={[typography.body, { flex: 1 }]}>{item.label}</Text>
              <ChevronRight size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logoutRow}>
          <LogOut size={18} color={colors.error} />
          <Text style={[typography.body, { color: colors.error }]}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { alignItems: 'center', padding: spacing.xl, gap: 6 },
  avatar: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  menu: { marginHorizontal: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: spacing.md, ...shadow.card },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.xl, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, ...shadow.card },
});
