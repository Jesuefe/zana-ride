import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

export class JwtAuthGuard extends AuthGuard('jwt') {}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!requiredRoles.includes(user?.role)) return false;

    // ADMIN remains unrestricted by this staff matrix. STAFF access is
    // centrally narrowed by the staff member's accessRole so a frontend
    // button can never become an authorization boundary by itself.
    if (user?.role !== 'STAFF' || !request.path.includes('/admin')) return true;

    const path = request.path.replace(/^\/api\/v1/, '');
    const method = request.method;
    const accessRole = user.accessRole || 'OPERATIONS';

    const readOnly = method === 'GET';
    const commonReads = ['/admin/search', '/admin/users', '/admin/users/'];
    const operationReads = ['/admin/operations/live', '/admin/delivery-kpis', '/admin/trips', '/admin/deliveries', '/admin/orders', '/admin/orders/'];
    const marketReads = ['/admin/markets', '/admin/markets/', '/admin/agents', '/admin/agents/'];
    const peopleReads = ['/admin/users', '/admin/users/', '/admin/merchants', '/admin/merchants/', '/admin/orders', '/admin/orders/', '/admin/deliveries', '/admin/trips'];

    const matches = (prefixes: string[]) => prefixes.some(p => path === p || path.startsWith(p));

    if (accessRole === 'OPERATIONS') {
      return (readOnly && (matches(commonReads) || matches(operationReads) || matches(marketReads))) ||
        (!readOnly && matches(['/admin/notifications']));
    }

    if (accessRole === 'DRIVER_OPERATIONS') {
      return readOnly && (matches(commonReads) || matches(operationReads) || matches(['/admin/drivers', '/admin/drivers/']));
    }

    if (accessRole === 'MARKET_OPERATIONS') {
      return (readOnly && (matches(commonReads) || matches(operationReads) || matches(marketReads))) ||
        (!readOnly && matches(['/admin/agents/']));
    }

    if (accessRole === 'CUSTOMER_SUPPORT') {
      return (readOnly && (matches(commonReads) || matches(peopleReads))) ||
        (!readOnly && matches(['/admin/notifications']));
    }

    return false;
  }
}
