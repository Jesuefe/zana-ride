import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IdCard, FileText, Car, ShieldCheck, Check } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, radius, spacing, typography, shadow } from '../theme/theme';
import PrimaryButton from '../components/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'DocumentUpload'>;

const documents = [
  { id: 'id', label: 'National ID or passport', icon: IdCard },
  { id: 'license', label: 'Driving licence', icon: FileText },
  { id: 'vehicle', label: 'Vehicle registration', icon: Car },
  { id: 'insurance', label: 'Insurance certificate', icon: ShieldCheck },
];

export default function DocumentUploadScreen({ navigation }: Props) {
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setUploaded((prev) => ({ ...prev, [id]: !prev[id] }));
  const allUploaded = documents.every((d) => uploaded[d.id]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h2}>Upload your documents</Text>
        <Text style={[typography.bodyMuted, { marginTop: 4 }]}>
          We review these before you can go online. Usually takes under 24 hours.
        </Text>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {documents.map((doc) => (
            <Pressable
              key={doc.id}
              style={[styles.docCard, uploaded[doc.id] && styles.docCardDone]}
              onPress={() => toggle(doc.id)}
            >
              <doc.icon size={20} color={uploaded[doc.id] ? colors.success : colors.ink} />
              <Text style={[typography.body, { flex: 1 }]}>{doc.label}</Text>
              {uploaded[doc.id] ? (
                <Check size={18} color={colors.success} />
              ) : (
                <Text style={styles.uploadLabel}>Upload</Text>
              )}
            </Pressable>
          ))}
        </View>

        <View style={{ flex: 1, minHeight: spacing.xl }} />
        <PrimaryButton
          label="Submit for review"
          disabled={!allUploaded}
          onPress={() => navigation.replace('PendingApproval')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flexGrow: 1, padding: spacing.lg },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.card,
  },
  docCardDone: { borderColor: colors.success, backgroundColor: '#EAF3DE' },
  uploadLabel: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
