import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Phone } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, ChatMessage } from '../types';
import { colors, radius, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const quickReplies = ['On my way', "I'm outside", 'Running 2 min late'];

export default function ChatScreen({ route, navigation }: Props) {
  const { customerName } = route.params;
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const send = (value: string) => {
    if (!value.trim()) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), from: 'driver', text: value.trim(), time: 'now' }]);
    setText('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={18} color={colors.ink} />
        </Pressable>
        <Text style={typography.h3}>{customerName}</Text>
        <Pressable style={styles.callButton}>
          <Phone size={16} color={colors.primary} />
        </Pressable>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{item.text}</Text>
          </View>
        )}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.quickRow}>
          {quickReplies.map((q) => (
            <Pressable key={q} style={styles.quickChip} onPress={() => send(q)}>
              <Text style={styles.quickChipText}>{q}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Message your rider…"
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => send(text)}
          />
          <Pressable style={styles.sendButton} onPress={() => send(text)}>
            <Send size={16} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backButton: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  callButton: { marginLeft: 'auto', width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '78%', padding: spacing.sm + 2, borderRadius: radius.md, backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleText: { color: colors.white, fontSize: 14 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md },
  quickChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 6 },
  quickChipText: { fontSize: 12, color: colors.ink },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14 },
  sendButton: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
