import { api } from './client';

export async function cancelOrder(id: string) {
  return api.post<any>('/orders/' + id + '/cancel');
}
