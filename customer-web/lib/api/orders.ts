import { api } from './client';

export async function cancelOrder(id: string) {
  return api.patch<any>('/orders/' + id + '/cancel');
}
