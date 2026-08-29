import { api } from './client';
import type { Lang } from '../lang';

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  originalContent: string;
  originalLang: string;
  createdAt: string;
};

export async function sendMessage(
  context: 'trip' | 'delivery',
  contextId: string,
  content: string,
  senderLang: Lang,
) {
  return api.post<ChatMessage>(`/chat/${context}/${contextId}`, { content, senderLang });
}

export async function getMessages(
  context: 'trip' | 'delivery',
  contextId: string,
  lang: Lang,
) {
  return api.get<ChatMessage[]>(`/chat/${context}/${contextId}?lang=${lang}`);
}

export async function updateLanguage(language: Lang) {
  return api.patch('/users/language', { language });
}
