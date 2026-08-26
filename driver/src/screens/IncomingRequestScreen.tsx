import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Navigation, Bike, Car, Star } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, radius, spacing, typography, shadow } from '../theme/theme';
import { useDriverStore } from '../store/driverStore';

type Props = NativeStackScreenProps<RootStackParamList, 'IncomingRequest'>;

const REQUEST_TIMEOUT_SECONDS = 15;

export default function IncomingRequestScreen({ route, navigation }: Props) {
  const { request } = route.params;
  const [secondsLeft, setSecondsLeft] = useState(REQUEST_TIMEOUT_SECONDS);
  const setActiveTrip = useDriverStore((s) => s.setActiveTrip);
  const setTripStatus = useDriverStore((s) => s.setTripStatus);

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigation.goBack();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, navigation]);

  const handleAccept = () => {
    setActiveTrip(request);
    setTripStatus('ACCEPTED');
    navigation.replace('ActiveTrip', { request });
  };

  const handleDecline = () => navigation.goBack();

  const ServiceIcon = request.serviceType === 'BIKE' ? Bike : Car;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.timerBar}>
          <View style={[styles.timerFill, { width: `${(secondsLeft / REQUEST_TIMEOUT_SECONDS) * 100}%` }]} />
        </View>

        <Text style={typography.caption}>New ride request</Text>
        <View style={styles.customerRow}>
          <Text style={typography.h2}>{request.customerName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Star size={13} color={colors.secondary} fill={colors.secondary} />
            <Text style={typography.bodyMuted}>{request.customerRating}</Text>
          </View>
        </View>

        <View style={styles.serviceRow}>
          <ServiceIcon size={16} color={colors.primary} />
          <Text style={typography.bodyMuted}>{request.serviceType === 'BIKE' ? 'Zana Moto' : 'Zana Car'}</Text>
        </View>

        <View style={styles.routeBlock}>
          <View style={styles.routeRow}>
            <MapPin size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{request.pickupAddress}</Text>
              <Text style={typography.caption}>{request.distanceToPickupKm} km to pickup</Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <Navigation size={16} color={colors.secondaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{request.destinationAddress}</Text>
              <Text style={typography.caption}>{request.tripDistanceKm} km trip</Text>
            </View>
          </View>
        </View>

        <View style={styles.earningsRow}>
          <Text style={typography.bodyMuted}>Estimated earnings</Text>
          <Text style={styles.earningsValue}>{request.estimatedEarningsRwf.toLocaleString()} RWF</Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={[styles.actionButton, styles.declineButton]} onPress={handleDecline}>
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.acceptButton]} onPress={handleAccept}>
            <Text style={styles.acceptText}>Accept ({secondsLeft}s)</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  timerBar: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden', marginBottom: spacing.sm },
  timerFill: { height: '100%', backgroundColor: colors.secondary },
  customerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeBlock: { marginTop: spacing.sm, gap: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  routeLine: { width: 1, height: 16, backgroundColor: colors.border, marginLeft: 8 },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  earningsValue: { fontSize: 17, fontWeight: '700', color: colors.ink },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  declineButton: { backgroundColor: colors.surface },
  declineText: { fontWeight: '600', color: colors.ink },
  acceptButton: { backgroundColor: colors.primary },
  acceptText: { fontWeight: '700', color: colors.white },
});
