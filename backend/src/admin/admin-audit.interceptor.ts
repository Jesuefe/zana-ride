import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { mergeMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const method = String(request.method || 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();

    const actorId = request.user?.sub;
    const routePath = String(request.route?.path || request.path || '/admin/unknown').slice(0, 190);
    const action = `ADMIN_API_${method}`;
    const bodyKeys = request.body && typeof request.body === 'object'
      ? Object.keys(request.body).filter((key: string) => !/password|secret|token|authorization|otp|pin/i.test(key)).slice(0, 40)
      : [];

    return next.handle().pipe(mergeMap(async (response) => {
      // Never persist request-body values: they can contain customer or payment PII.
      // Endpoint-specific financial services also write detailed before/after audit events.
      try {
        await this.prisma.auditLog.create({
          data: {
            actorId,
            action,
            entityType: 'AdminEndpoint',
            entityId: routePath,
            metadataJson: JSON.stringify({
              method,
              route: routePath,
              queryKeys: Object.keys(request.query || {}).slice(0, 20),
              bodyKeys,
              ip: String(request.ip || '').slice(0, 64),
              userAgent: String(request.headers?.['user-agent'] || '').slice(0, 180),
            }),
          },
        });
      } catch {
        // Do not turn a completed business operation into a misleading HTTP failure.
        // Critical financial workflows still write their own audit event transactionally.
      }
      return response;
    }));
  }
}