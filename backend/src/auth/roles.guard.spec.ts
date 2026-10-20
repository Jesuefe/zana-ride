import { RolesGuard, ROLES_KEY } from './roles.guard';

describe('RolesGuard staff access matrix', () => {
  function canActivate(user: any, method: string, path: string, requiredRoles = ['ADMIN', 'STAFF']) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => key === ROLES_KEY ? requiredRoles : undefined),
    };
    const request = { user, method, path };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    };
    return new RolesGuard(reflector as any).canActivate(context as any);
  }

  it('allows customer support to read and update support cases', () => {
    const staff = { role: 'STAFF', accessRole: 'CUSTOMER_SUPPORT' };
    expect(canActivate(staff, 'GET', '/api/v1/admin/support/tickets')).toBe(true);
    expect(canActivate(staff, 'POST', '/api/v1/admin/support/tickets')).toBe(true);
    expect(canActivate(staff, 'PATCH', '/api/v1/admin/support/tickets/ticket-id')).toBe(true);
  });

  it('does not let customer support access financial endpoints', () => {
    const staff = { role: 'STAFF', accessRole: 'CUSTOMER_SUPPORT' };
    expect(canActivate(staff, 'GET', '/api/v1/admin/financial/reconciliation')).toBe(false);
    expect(canActivate(staff, 'POST', '/api/v1/admin/financial/refund')).toBe(false);
  });

  it('does not let other staff roles update support cases', () => {
    expect(canActivate({ role: 'STAFF', accessRole: 'OPERATIONS' }, 'POST', '/api/v1/admin/support/tickets')).toBe(false);
    expect(canActivate({ role: 'STAFF', accessRole: 'DRIVER_OPERATIONS' }, 'PATCH', '/api/v1/admin/support/tickets/ticket-id')).toBe(false);
  });

  it('keeps the role decorator as the first authorization boundary', () => {
    expect(canActivate({ role: 'CUSTOMER' }, 'GET', '/api/v1/admin/support/tickets')).toBe(false);
    expect(canActivate({ role: 'ADMIN' }, 'GET', '/api/v1/admin/financial/reconciliation')).toBe(true);
  });
});
