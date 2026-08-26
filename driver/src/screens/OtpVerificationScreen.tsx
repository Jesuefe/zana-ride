import React, { useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, radius, spacing, typography } from '../theme/theme';
import PrimaryButton from '../components/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'OtpVerification'>;

const OTP_LENGTH = 6;

export default function OtpVerificationScreen({ route, navigation }: Props) {
  const { phone } = route.params;
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const digits = code.padEnd(OTP_LENGTH, ' ').split('');

  const handleVerify = () => {
    setVerifying(true);
    // In production: POST /auth/verify-otp { phone, code }
    setTimeout(() => {
      setVerifying(false);
      navigation.navigate('DocumentUpload');
    }, 700);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={typography.h2}>Enter the code</Text>
        <Text style={[typography.bodyMuted, { marginTop: 4 }]}>Sent via SMS to {phone}</Text>

        <View style={styles.boxesRow} onTouchEnd={() => inputRef.current?.focus()}>
          {digits.map((d, i) => (
            <View key={i} style={[styles.box, code.length === i && styles.boxActive]}>
              <Text style={styles.boxText}>{d.trim()}</Text>
            </View>
          ))}
        </View>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          keyboardType="number-pad"
          style={styles.hiddenInput}
          autoFocus
        />

        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Verify"
          disabled={code.length !== OTP_LENGTH}
          loading={verifying}
          onPress={handleVerify}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, padding: spacing.lg },
  boxesRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  box: {
    width: 44,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.primary },
  boxText: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0 },
});
