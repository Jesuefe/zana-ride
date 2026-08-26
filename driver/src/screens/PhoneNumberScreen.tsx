import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, radius, spacing, typography } from '../theme/theme';
import PrimaryButton from '../components/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneNumber'>;

export default function PhoneNumberScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const valid = phone.replace(/\D/g, '').length >= 9;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={typography.h2}>What's your number?</Text>
          <Text style={[typography.bodyMuted, { marginTop: 4 }]}>
            We'll send a code to verify it's you.
          </Text>

          <View style={styles.inputRow}>
            <View style={styles.countryCode}>
              <Text style={typography.body}>RW +250</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="788 123 456"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={12}
              autoFocus
            />
          </View>

          <View style={{ flex: 1 }} />
          <PrimaryButton
            label="Continue"
            disabled={!valid}
            onPress={() => navigation.navigate('OtpVerification', { phone: `+250${phone}` })}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, padding: spacing.lg },
  inputRow: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  countryCode: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
});
