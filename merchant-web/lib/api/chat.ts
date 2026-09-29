import { api } from './client';
import { getStoredLang, Lang } from '../lang';

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

export async function sendDeliveryMessage(deliveryId: string, content: string, senderLang: Lang = getStoredLang()) {
  return api.post<ChatMessage>(`/chat/delivery/${deliveryId}`, { content, senderLang });
}

export async function getDeliveryMessages(deliveryId: string, lang: Lang = getStoredLang()) {
  return api.get<ChatMessage[]>(`/chat/delivery/${deliveryId}?lang=${lang}`);
}
