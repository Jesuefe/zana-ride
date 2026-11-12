import { api, setToken } from './client';

export async function createAdmin(data: { phone: string; email: string; password: string; firstName?: string; lastName?: string; recoverySecret: string }) {
  return api.post<any>('/auth/admin/recover', data);
}

export async function createTestAccounts(data: { password: string }) {
  return api.post<any>('/admin/test-accounts', data);
}

export async function login(identifier: string, password: string) {
  const result = await api.post<any>('/auth/login', { identifier, password });
  if (result?.token) setToken(result.token);
  return result;
}

export async function startAdminTotpSetup(setupToken: string) {
  return api.post<{ secret: string; otpauthUrl: string; accountLabel: string }>('/auth/admin/2fa/setup', { setupToken });
}

export async function enableAdminTotp(setupToken: string, code: string) {
  const result = await api.post<any>('/auth/admin/2fa/enable', { setupToken, code });
  if (result?.token) setToken(result.token);
  return result;
}

export async function verifyAdminTotpLogin(challengeToken: string, code: string) {
  const result = await api.post<any>('/auth/admin/2fa/verify-login', { challengeToken, code });
  if (result?.token) setToken(result.token);
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

export async function resetUserPassword(id: string, newPassword: string) {
  return api.post(`/admin/users/${id}/reset-password`, { newPassword });
}

export async function getDrivers(status?: string) {
  return api.get<any[]>(`/admin/drivers${status ? `?status=${status}` : ''}`);
}

export async function getDriverOperationsOverview() { return api.get<any>('/admin/drivers/operations/overview'); }
export async function getDriverDetail(id: string) { return api.get<any>('/admin/drivers/' + id + '/detail'); }
export async function getDriverAuditHistory(id: string) { return api.get<any[]>('/admin/drivers/' + id + '/audit'); }
export async function updateDriverProfile(id: string, data: any) { return api.patch<any>('/admin/drivers/' + id + '/profile', data); }
export async function reviewDriver(id: string, status: string, reason: string) { return api.patch<any>('/admin/drivers/' + id + '/review', { status, reason }); }
export async function updateDriverVehicle(driverId: string, vehicleId: string, data: any) { return api.patch<any>('/admin/drivers/' + driverId + '/vehicles/' + vehicleId, data); }
export async function setDriverVehicleStatus(driverId: string, vehicleId: string, status: string, reason: string) { return api.patch<any>('/admin/drivers/' + driverId + '/vehicles/' + vehicleId + '/status', { status, reason }); }
export async function verifyDriverDocument(documentId: string, verified: boolean, reason: string) { return api.patch<any>('/admin/drivers/documents/' + documentId + '/verify', { verified, reason }); }
export async function updateDriverDocument(documentId: string, data: any) { return api.patch<any>('/admin/drivers/documents/' + documentId + '/metadata', data); }
export async function approveDriver(id: string) { return api.patch(`/admin/drivers/${id}/approve`); }
export async function rejectDriver(id: string) { return api.patch(`/admin/drivers/${id}/reject`); }
export async function suspendDriver(id: string) { return api.patch(`/admin/drivers/${id}/suspend`); }

export async function getMerchants(status?: string) {
  return api.get<any[]>(`/admin/merchants${status ? `?status=${status}` : ''}`);
}
export async function approveMerchant(id: string) { return api.patch(`/admin/merchants/${id}/approve`); }
export async function suspendMerchant(id: string) { return api.patch(`/admin/merchants/${id}/suspend`); }

export async function getMediaLibrary() { return api.get<any[]>('/admin/media'); }

export async function getProducts(status?: string) {
  return api.get<any[]>(`/admin/products${status ? `?status=${status}` : ''}`);
}
export async function reviewProduct(id: string, status: 'APPROVED' | 'REJECTED', adminNote?: string) {
  return api.patch(`/admin/products/${id}/review`, { status, adminNote });
}

export async function getTrips() { return api.get<any[]>('/admin/trips'); }
export async function getDeliveries() { return api.get<any[]>('/admin/deliveries'); }

export async function getMarkets() { return api.get<any[]>('/admin/markets'); }
export async function getMarketDashboard(id: string) { return api.get<any>(`/admin/markets/${id}/dashboard`); }
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
export async function getAccountingLedger(limit = 500) { return api.get<any>(`/admin/accounting/ledger?limit=${limit}`); }
export async function getLiveOperations() { return api.get<any>('/admin/operations/live'); }
export async function getCommissions() { return api.get<any[]>('/admin/commissions'); }
export async function getCommissionSummary() { return api.get<any>('/admin/commissions/summary'); }

export async function getExpenses() { return api.get<any[]>('/admin/expenses'); }
export async function createExpense(data: any) { return api.post('/admin/expenses', data); }
export async function approveExpense(id: string) { return api.post('/admin/expenses/' + id + '/approve', {}); }
export async function voidExpense(id: string, reason: string) { return api.post(`/admin/expenses/${id}/void`, { reason }); }
export async function updateExpensePayment(id: string, amountPaid: number, paymentReference?: string) { return api.patch(`/admin/expenses/${id}/payment`, { amountPaid, paymentReference }); }

export async function getStaff(month?: string) { return api.get<any[]>(`/admin/staff${month ? `?month=${encodeURIComponent(month)}` : ''}`); }
export async function createStaff(data: { name: string; role: string; accessRole: string; phone: string; email?: string; password: string; salary: number }) { return api.post('/admin/staff', data); }
export async function updateStaff(id: string, data: any) { return api.patch(`/admin/staff/${id}`, data); }

export async function getPayrollPreview(month: string) { return api.get<any>('/admin/payroll/preview?month=' + encodeURIComponent(month)); }
export async function getSalaryPayments(month?: string) {
  return api.get<any[]>(`/admin/salary-payments${month ? `?month=${month}` : ''}`);
}
export async function recordSalaryPayment(data: any) { return api.post('/admin/salary-payments', data); }
export async function getOrders() { return api.get<any[]>('/admin/orders'); }

export async function deleteProduct(id: string) { return api.delete(`/admin/products/${id}`); }


export async function getMerchantFinance(merchantId: string) {
  return api.get<any>(`/admin/finance/merchants/${merchantId}`);
}

export async function getAgentFinance(agentId: string) {
  return api.get<any>(`/admin/finance/agents/${agentId}`);
}

export async function getMarketPriceConfig() {
  return api.get<any>('/admin/market-price-config');
}

export async function getMarketPriceHistory(productId?: string) {
  return api.get<any[]>(`/admin/market-price-history${productId ? `?productId=${encodeURIComponent(productId)}` : ''}`);
}

export async function getMarketPriceReviews() {
  return api.get<any[]>('/admin/market-price-reviews');
}

export async function reviewMarketPrice(id: string, approve: boolean, reason?: string) {
  return api.patch(`/admin/market-price-reviews/${id}`, { approve, reason });
}

export async function updateMarketAgentRate(rate: number) {
  return api.patch('/admin/market-agent-rate', { rate });
}

export async function getFinanceAudit(limit = 100) {
  return api.get<any[]>(`/admin/audit?limit=${limit}`);
}

export async function getDriverTestLocations() { return api.get<any[]>('/admin/drivers/test-locations'); }
export async function setDriverTestLocation(id: string, lat: number | null, lng: number | null) { return api.patch<any>(`/admin/drivers/${id}/test-location`, { lat, lng }); }
export async function scatterDriverTestLocations(centerLat: number, centerLng: number, radiusMeters = 500) { return api.post<any>('/admin/drivers/test-locations/scatter', { centerLat, centerLng, radiusMeters }); }
export async function clearDriverTestLocations() { return api.post<any>('/admin/drivers/test-locations/clear-all'); }
export async function getCustomerTestLocations() { return api.get<any[]>('/admin/customers/test-locations'); }
export async function setCustomerTestLocation(id: string, lat: number | null, lng: number | null) { return api.patch<any>(`/admin/customers/${id}/test-location`, { lat, lng }); }
export async function clearAllTestLocations() { return api.post<any>('/admin/test-locations/clear-all'); }


export type ZanaAiProvider = 'gemini' | 'groq' | 'openrouter';
export type ZanaAiProviderSettings = { enabled:boolean; model:string; configured:boolean; apiKeyHint?:string|null; features: ZanaAiSettings['features']; updatedAt?:string|null };
export type ZanaAiSettings = {
  enabled: boolean;
  provider: ZanaAiProvider;
  model: string;
  configured: boolean;
  apiKeyHint?: string | null;
  features: { customerChat:boolean; rideBooking:boolean; foodOrdering:boolean; marketShopping:boolean; deliveryBooking:boolean; placeDiscovery:boolean };
  providers: Record<ZanaAiProvider, ZanaAiProviderSettings>;
  updatedAt?: string | null;
};

export async function getAiSettings() {
  return api.get<ZanaAiSettings>('/admin/settings/ai');
}

export async function saveAiSettings(data: {
  provider: ZanaAiProvider;
  enabled: boolean;
  model: string;
  apiKey?: string;
  clearApiKey?: boolean;
  features: ZanaAiSettings['features'];
}) {
  return api.patch<ZanaAiSettings & { saved: boolean }>('/admin/settings/ai', data);
}

export async function testAiConnection() {
  return api.post<{ ok: boolean; provider?: ZanaAiProvider; model?: string; response?: string }>('/admin/settings/ai/test');
}


export async function getSystemHealth() { return api.get<any>('/admin/system-health'); }
export async function getFinancialReconciliation() { return api.get<any>('/admin/financial/reconciliation'); }

export async function getStaffSecurity() { return api.get<any[]>('/admin/security/staff'); }
export async function getAuditLog(params?: { limit?: number; action?: string; entityType?: string }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.action) q.set('action', params.action);
  if (params?.entityType) q.set('entityType', params.entityType);
  const qs = q.toString();
  return api.get<any[]>(`/admin/audit${qs ? `?${qs}` : ''}`);
}



export async function getRiderRegistrations(params?: { status?: string; search?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const q = query.toString();
  return api.get<any[]>(`/admin/rider-registrations${q ? `?${q}` : ''}`);
}
export async function updateRiderRegistrationStatus(id: string, status: 'NEW' | 'CONTACTED' | 'APPROVED' | 'REJECTED') {
  return api.patch<any>(`/admin/rider-registrations/${id}/status`, { status });
}

export async function getRiderRegistrationDailyStats() {
  return api.get<Array<{ day: string; count: number }>>('/admin/rider-registrations/daily');
}


export type ServiceZone = { id:string; name:string; city:string; boundary:{type:'Polygon';coordinates:number[][][]}; serviceTypes:string[]; nearbyZoneIds:string[]; active:boolean };
export async function getServiceZones(city?:string) { return api.get<ServiceZone[]>('/admin/service-zones'+(city?'?city='+encodeURIComponent(city):'')); }
export async function createServiceZone(data:Omit<ServiceZone,'id'>) { return api.post<ServiceZone>('/admin/service-zones',data); }
export async function updateServiceZone(id:string,data:Partial<Omit<ServiceZone,'id'>>) { return api.patch<ServiceZone>('/admin/service-zones/'+id,data); }


export async function getImpactFunds(params?: { from?: string; to?: string; sourceType?: string }) {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.sourceType) query.set('sourceType', params.sourceType);
  const q = query.toString();
  return api.get<any>(`/admin/impact-funds${q ? `?${q}` : ''}`);
}
export async function updateImpactFundsRate(ratePercent: number, confirm: boolean) {
  return api.patch<any>('/admin/impact-funds/rate', { ratePercent, confirm });
}
export async function reverseImpactFundsEntry(id: string, reason: string) {
  return api.post<any>(`/admin/impact-funds/${encodeURIComponent(id)}/reverse`, { reason });
}
export async function getImpactFundDisbursements() { return api.get<any>('/admin/impact-funds/disbursements'); }
export async function requestImpactFundDisbursement(data: { amount: number; recipientName: string; recipientType: string; purpose: string }) { return api.post<any>('/admin/impact-funds/disbursements', data); }
export async function approveImpactFundDisbursement(id: string) { return api.post<any>(`/admin/impact-funds/disbursements/${encodeURIComponent(id)}/approve`, {}); }
export async function rejectImpactFundDisbursement(id: string, reason: string) { return api.post<any>(`/admin/impact-funds/disbursements/${encodeURIComponent(id)}/reject`, { reason }); }
export async function markImpactFundDisbursementPaid(id: string, data: { paymentMethod: string; paymentReference: string; evidenceUrl?: string }) { return api.post<any>(`/admin/impact-funds/disbursements/${encodeURIComponent(id)}/paid`, data); }

export async function getMonthlyProfitability(month: string) { return api.get<any>(`/admin/financial/monthly-profit?month=${encodeURIComponent(month)}`); }
export async function closeMonthlyProfit(month: string) { return api.post<any>('/admin/financial/monthly-profit/close', { month, confirm: true }); }

export async function getPayrollRun(month: string) { return api.get<any>('/admin/payroll/run?month=' + encodeURIComponent(month)); }
export async function createPayrollRun(month: string, adjustments: any[]) { return api.post<any>('/admin/payroll/run', { month, adjustments }); }
export async function approvePayrollRun(id: string) { return api.post<any>('/admin/payroll/run/' + id + '/approve', {}); }
export async function discardDraftPayrollRun(id: string, reason: string) { return api.post<any>('/admin/payroll/run/' + id + '/discard-draft', { reason }); }
export async function recordPayrollLinePayment(id: string, data: { amount: number; paymentReference: string; paymentMethod: string }) { return api.post<any>('/admin/payroll/lines/' + id + '/payment', data); }

// Advanced finance controls
export async function getSalaryAdvances(staffMemberId?: string) { return api.get<any[]>(`/admin/payroll/advances${staffMemberId ? `?staffMemberId=${encodeURIComponent(staffMemberId)}` : ''}`); }
export async function issueSalaryAdvance(data: any) { return api.post('/admin/payroll/advances', data); }
export async function approveSalaryAdvance(id: string) { return api.post(`/admin/payroll/advances/${id}/approve`, {}); }
export async function paySalaryAdvance(id: string, data: any) { return api.post(`/admin/payroll/advances/${id}/payment`, data); }
export async function cancelSalaryAdvance(id: string, reason: string) { return api.post(`/admin/payroll/advances/${id}/cancel`, { reason }); }
export async function getContractorInvoices(status?: string) { return api.get<any[]>(`/admin/contractor-invoices${status ? `?status=${encodeURIComponent(status)}` : ''}`); }
export async function createContractorInvoice(data: any) { return api.post('/admin/contractor-invoices', data); }
export async function reviewContractorInvoice(id: string, approve: boolean, reason?: string) { return api.post(`/admin/contractor-invoices/${id}/${approve ? 'approve' : 'reject'}`, approve ? {} : { reason }); }
export async function payContractorInvoice(id: string, data: any) { return api.post(`/admin/contractor-invoices/${id}/payment`, data); }
export async function getStatutoryRemittances(period?: string) { return api.get<any[]>(`/admin/statutory-remittances${period ? `?period=${encodeURIComponent(period)}` : ''}`); }
export async function generateStatutoryRemittances(period: string) { return api.post('/admin/statutory-remittances/generate', { period }); }
export async function approveStatutoryRemittance(id: string) { return api.post(`/admin/statutory-remittances/${id}/approve`, {}); }
export async function payStatutoryRemittance(id: string, data: any) { return api.post(`/admin/statutory-remittances/${id}/payment`, data); }

export async function updateStatutoryRemittance(id: string, data: any) { return api.patch(`/admin/statutory-remittances/${id}`, data); }
export async function verifyStatutoryRemittance(id: string, verificationNote: string) { return api.post(`/admin/statutory-remittances/${id}/verify`, { verificationNote }); }
export async function createAssistedDriver(data: { email: string; phone: string; firstName: string; lastName?: string; vehicle: string; plate: string; serviceType: string; driverMode?: string }) {
  return api.post<any>('/admin/onboarding/driver', data);
}
export async function createAssistedMerchant(data: { email: string; phone: string; firstName: string; lastName?: string; businessName: string; category: string; branch?: string; whatsappPhone?: string }) {
  return api.post<any>('/admin/onboarding/merchant', data);
}
export async function getMerchantPromotions(status?: string) {
  return api.get<any[]>(`/admin/promotions${status ? `?status=${encodeURIComponent(status)}` : ''}`);
}
export async function reviewMerchantPromotion(id: string, status: string, reason?: string) {
  return api.patch(`/admin/promotions/${id}/status`, { status, reason });
}
export async function setMerchantPromotionExemption(id: string, exempt: boolean, reason?: string) {
  return api.patch(`/admin/merchants/${id}/promotion-exemption`, { exempt, reason });
}

export async function resendAssistedCredentials(userId: string) { return api.post<any>(`/admin/onboarding/${encodeURIComponent(userId)}/resend-credentials`, {}); }
