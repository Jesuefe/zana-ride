import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock3 } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, radius, spacing, typography } from '../theme/theme';
import PrimaryButton from '../components/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'PendingApproval'>;

export default function PendingApprovalScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Clock3 size={40} color={colors.secondaryDark} />
        </View>
        <Text style={typography.h2}>Your documents are under review</Text>
        <Text style={[typography.bodyMuted, styles.copy]}>
          The Zana team is reviewing your documents. This usually takes under 24 hours — we'll notify you the
          moment you're approved to go online.
        </Text>

        {/* Demo-only shortcut — a real backend flips this to APPROVED via push notification. */}
        <PrimaryButton
          label="Simulate approval (demo)"
          variant="outline"
          onPress={() => navigation.replace('MainTabs')}
          style={{ marginTop: spacing.xl }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: '#FAEEDA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  copy: { textAlign: 'center', marginTop: spacing.sm },
});
