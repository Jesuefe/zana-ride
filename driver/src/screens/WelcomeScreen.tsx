import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Car } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing, typography } from '../theme/theme';
import PrimaryButton from '../components/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Car size={96} color={colors.primary} strokeWidth={1.25} />
      </View>
      <View style={styles.content}>
        <Text style={typography.h1}>Drive with Zana.{'\n'}Earn on your terms.</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>
          Pick your hours, keep more of every trip, get paid weekly.
        </Text>
        <View style={{ height: spacing.xl }} />
        <PrimaryButton label="Get Started" onPress={() => navigation.navigate('PhoneNumber')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, justifyContent: 'flex-end' },
  hero: { flex: 1, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
});
