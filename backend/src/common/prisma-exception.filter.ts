import {
  ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger,
} from '@nestjs/common';
import { Response } from 'express';

const FIELD_LABELS: Record<string, string> = {
  phone: 'phone number',
  email: 'email address',
  trackingCode: 'tracking code',
  roomName: 'call room',
  userId: 'user',
};

/**
 * Turns raw Prisma errors into messages a person can act on.
 * Without this a duplicate email surfaces as a bare "Internal server error".
 */
@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PrismaError');

  catch(exception: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    // Let Nest's own HttpExceptions through untouched.
    if (typeof exception?.getStatus === 'function') {
      const status = exception.getStatus();
      return res.status(status).json(exception.getResponse());
    }

    const code = exception?.code;

    if (code === 'P2002') {
      const target = exception?.meta?.target;
      const field = Array.isArray(target) ? target[0] : String(target ?? 'value');
      const label = FIELD_LABELS[field] ?? field;
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        error: 'Bad Request',
        message: `That ${label} is already in use by another account.`,
      });
    }

    if (code === 'P2025') {
      return res.status(HttpStatus.NOT_FOUND).json({
        statusCode: 404,
        error: 'Not Found',
        message: 'That record no longer exists.',
      });
    }

    if (code === 'P2003') {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        error: 'Bad Request',
        message: 'A linked record is missing or invalid.',
      });
    }

    this.logger.error(exception?.message ?? 'Unhandled error', exception?.stack);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Something went wrong. Please try again.',
    });
  }
}
