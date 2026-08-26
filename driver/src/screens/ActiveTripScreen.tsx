import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MessageCircle, Phone, Navigation } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, TripStatus } from '../types';
import { colors, radius, spacing, typography, shadow } from '../theme/theme';
import { useDriverStore } from '../store/driverStore';
import PrimaryButton from '../components/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveTrip'>;

const STATUS_COPY: Record<TripStatus, string> = {
  ACCEPTED: 'Head to pickup',
  EN_ROUTE_TO_PICKUP: 'On your way to pickup',
  ARRIVED_AT_PICKUP: "You've arrived — waiting for rider",
  TRIP_IN_PROGRESS: 'Trip in progress',
  COMPLETED: 'Trip completed',
};

const NEXT_STATUS: Record<TripStatus, TripStatus | null> = {
  ACCEPTED: 'EN_ROUTE_TO_PICKUP',
  EN_ROUTE_TO_PICKUP: 'ARRIVED_AT_PICKUP',
  ARRIVED_AT_PICKUP: 'TRIP_IN_PROGRESS',
  TRIP_IN_PROGRESS: 'COMPLETED',
  COMPLETED: null,
};

const NEXT_LABEL: Record<TripStatus, string> = {
  ACCEPTED: "I'm on my way",
  EN_ROUTE_TO_PICKUP: "I've arrived",
  ARRIVED_AT_PICKUP: 'Start trip',
  TRIP_IN_PROGRESS: 'Complete trip',
  COMPLETED: 'Done',
};

export default function ActiveTripScreen({ route, navigation }: Props) {
  const { request } = route.params;
  const tripStatus = useDriverStore((s) => s.tripStatus) ?? 'ACCEPTED';
  const setTripStatus = useDriverStore((s) => s.setTripStatus);
  const completeTrip = useDriverStore((s) => s.completeTrip);

  const isBeforePickup = tripStatus === 'ACCEPTED' || tripStatus === 'EN_ROUTE_TO_PICKUP';
  const destination = isBeforePickup ? request.pickupCoords : request.destinationCoords;
  const destinationLabel = isBeforePickup ? request.pickupAddress : request.destinationAddress;

  const handlePrimaryAction = () => {
    const next = NEXT_STATUS[tripStatus];
    if (next === 'COMPLETED') {
      completeTrip(request.estimatedEarningsRwf);
      navigation.replace('MainTabs');
      return;
    }
    if (next) setTripStatus(next);
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ ...request.pickupCoords, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
      >
        <Marker coordinate={request.pickupCoords} pinColor={colors.primary} title="Pickup" />
        <Marker coordinate={request.destinationCoords} pinColor={colors.secondaryDark} title="Destination" />
        <Polyline
          coordinates={[request.pickupCoords, request.destinationCoords]}
          strokeColor={colors.primary}
          strokeWidth={3}
        />
      </MapView>

      <View style={styles.navBanner}>
        <Navigation size={14} color={colors.primary} />
        <Text style={styles.navBannerText} numberOfLines={1}>
          Navigate to {destinationLabel}
        </Text>
      </View>

      <View style={styles.sheet}>
        <Text style={typography.h3}>{STATUS_COPY[tripStatus]}</Text>

        <View style={styles.customerCard}>
          <View style={{ flex: 1 }}>
            <Text style={typography.body}>{request.customerName}</Text>
            <Text style={typography.bodyMuted}>{destinationLabel}</Text>
          </View>
          <Pressable
            style={styles.iconAction}
            onPress={() => navigation.navigate('Chat', { customerName: request.customerName })}
          >
            <MessageCircle size={18} color={colors.primary} />
          </Pressable>
          <Pressable style={styles.iconAction}>
            <Phone size={18} color={colors.primary} />
          </Pressable>
        </View>

        <PrimaryButton
          label={NEXT_LABEL[tripStatus]}
          onPress={handlePrimaryAction}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  navBanner: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    ...shadow.card,
  },
  navBannerText: { fontSize: 13, color: colors.ink, flexShrink: 1 },
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
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  iconAction: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
