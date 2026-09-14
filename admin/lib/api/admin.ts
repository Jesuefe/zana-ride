import { api, setToken } from './client';

export async function login(identifier: string, password: string) {
  const result = await api.post<{ token: string; user: any }>('/auth/login', { identifier, password });
  setToken(result.token);
  return result;
}

export async function getOverview() {
  return api.get<any>('/admin/overview');
}

export async function getUsers(params?: { role?: string; status?: string; search?: string }) {
  const q = new URLSearchParams(params as any).toString();
  return api.get<any[]>(`/admin/users${q ? `?${q}` : ''}`);
}

export async function updateUserStatus(id: string, status: string) {
  return api.patch(`/admin/users/${id}/status`, { status });
}

export async function getDrivers(status?: string) {
  return api.get<any[]>(`/admin/drivers${status ? `?status=${status}` : ''}`);
}

export async function approveDriver(id: string) { return api.patch(`/admin/drivers/${id}/approve`); }
export async function rejectDriver(id: string) { return api.patch(`/admin/drivers/${id}/reject`); }
export async function suspendDriver(id: string) { return api.patch(`/admin/drivers/${id}/suspend`); }

export async function getMerchants(status?: string) {
  return api.get<any[]>(`/admin/merchants${status ? `?status=${status}` : ''}`);
}
export async function approveMerchant(id: string) { return api.patch(`/admin/merchants/${id}/approve`); }
export async function suspendMerchant(id: string) { return api.patch(`/admin/merchants/${id}/suspend`); }

export async function getProducts(status?: string) {
  return api.get<any[]>(`/admin/products${status ? `?status=${status}` : ''}`);
}
export async function reviewProduct(id: string, status: 'APPROVED' | 'REJECTED', adminNote?: string) {
  return api.patch(`/admin/products/${id}/review`, { status, adminNote });
}

export async function getTrips() { return api.get<any[]>('/admin/trips'); }
export async function getDeliveries() { return api.get<any[]>('/admin/deliveries'); }

export async function getMarkets() { return api.get<any[]>('/admin/markets'); }
export async function createMarket(data: any) { return api.post('/admin/markets', data); }
export async function updateMarket(id: string, data: any) { return api.patch(`/admin/markets/${id}`, data); }

export async function getAgents() { return api.get<any[]>('/admin/agents'); }
export async function createAgent(data: any) { return api.post('/admin/agents', data); }
export async function assignAgent(id: string, marketId: string) {
  return api.patch(`/admin/agents/${id}/assign-market`, { marketId });
}
export async function toggleAgent(id: string, active: boolean) {
  return api.patch(`/admin/agents/${id}/toggle`, { active });
}

export async function getFares() { return api.get<any[]>('/admin/fares'); }
export async function updateFare(serviceType: string, data: any) {
  return api.patch(`/admin/fares/${serviceType}`, data);
}

export async function getFinancial() { return api.get<any>('/admin/financial'); }
export async function getCommissions() { return api.get<any[]>('/admin/commissions'); }
export async function getCommissionSummary() { return api.get<any>('/admin/commissions/summary'); }

export async function getExpenses() { return api.get<any[]>('/admin/expenses'); }
export async function createExpense(data: any) { return api.post('/admin/expenses', data); }
export async function deleteExpense(id: string) {
  const token = (await import('./client')).getToken();
  await fetch(`https://zana.ajumalink.com/api/v1/admin/expenses/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
}

export async function getStaff() { return api.get<any[]>('/admin/staff'); }
export async function createStaff(data: any) { return api.post('/admin/staff', data); }
export async function updateStaff(id: string, data: any) { return api.patch(`/admin/staff/${id}`, data); }

export async function getSalaryPayments(month?: string) {
  return api.get<any[]>(`/admin/salary-payments${month ? `?month=${month}` : ''}`);
}
export async function recordSalaryPayment(data: any) { return api.post('/admin/salary-payments', data); }
export async function getOrders() { return api.get<any[]>('/admin/orders'); }

export async function deleteProduct(id: string) { return api.delete(`/admin/products/${id}`); }
