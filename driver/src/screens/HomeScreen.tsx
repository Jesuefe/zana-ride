import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Platform } from 'react-native';
import { Menu, Bell } from 'lucide-react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../types';
import { colors, radius, spacing, typography, shadow } from '../theme/theme';
import { KIGALI_CENTER, mockIncomingRequest } from '../data/mockData';
import { useDriverStore } from '../store/driverStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'HomeTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function HomeScreen({ navigation }: Props) {
  const onlineStatus = useDriverStore((s) => s.onlineStatus);
  const setOnlineStatus = useDriverStore((s) => s.setOnlineStatus);
  const todayEarnings = useDriverStore((s) => s.todayEarnings);
  const todayTrips = useDriverStore((s) => s.todayTrips);
  const activeTrip = useDriverStore((s) => s.activeTrip);

  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // While online and idle, simulate an incoming ride request after a short delay —
  // in production this arrives over the driver's websocket channel (ride.request.created).
  useEffect(() => {
    if (onlineStatus === 'ONLINE' && !activeTrip) {
      requestTimer.current = setTimeout(() => {
        const request = mockIncomingRequest(KIGALI_CENTER);
        navigation.navigate('IncomingRequest', { request });
      }, 4000);
    }
    return () => {
      if (requestTimer.current) clearTimeout(requestTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineStatus]);

  const toggleOnline = () => {
    setOnlineStatus(onlineStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ ...KIGALI_CENTER, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        <Marker coordinate={KIGALI_CENTER} title="You" />
      </MapView>

      <View style={styles.topBar}>
        <Pressable style={styles.iconButton}>
          <Menu size={18} color={colors.ink} />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Notifications')}>
          <Bell size={18} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.sheet}>
        <View style={styles.statusRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.statusDot, { backgroundColor: onlineStatus === 'ONLINE' ? colors.success : colors.muted }]} />
            <Text style={typography.h3}>{onlineStatus === 'ONLINE' ? 'You are online' : 'You are offline'}</Text>
          </View>
          <Switch
            value={onlineStatus === 'ONLINE'}
            onValueChange={toggleOnline}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        {onlineStatus === 'ONLINE' && (
          <Text style={typography.bodyMuted}>Waiting for a ride request nearby…</Text>
        )}
        {onlineStatus === 'OFFLINE' && (
          <Text style={typography.bodyMuted}>Go online to start receiving ride requests.</Text>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={typography.caption}>Today's earnings</Text>
            <Text style={styles.statValue}>{todayEarnings.toLocaleString()} RWF</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={typography.caption}>Trips</Text>
            <Text style={styles.statValue}>{todayTrips}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    ...shadow.card,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.ink, marginTop: 4 },
});
