import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CallsService } from './calls.service';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private callsService: CallsService) {}

  // Create a new call (customer or driver initiates)
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    // rideId kept for backward compatibility with the two callers (customer
    // and driver apps) already sending it that way.
    @Body() body: { rideId?: string; context?: 'trip' | 'delivery'; contextId?: string },
  ) {
    const context = body.context ?? 'trip';
    const contextId = body.contextId ?? body.rideId!;
    return this.callsService.createCall(user.sub, context, contextId);
  }

  // Get active call for current user
  @Get('active')
  active(@CurrentUser() user: JwtPayload) {
    return this.callsService.getActiveCall(user.sub);
  }

  // Get token for an existing call
  @Post(':callId/token')
  token(@CurrentUser() user: JwtPayload, @Param('callId') callId: string) {
    return this.callsService.getCallToken(callId, user.sub);
  }

  // Accept (receiver only)
  @Post(':callId/accept')
  accept(@CurrentUser() user: JwtPayload, @Param('callId') callId: string) {
    return this.callsService.acceptCall(callId, user.sub);
  }

  // Decline (receiver only)
  @Post(':callId/decline')
  decline(@CurrentUser() user: JwtPayload, @Param('callId') callId: string) {
    return this.callsService.declineCall(callId, user.sub);
  }

  // Cancel (caller only, while ringing)
  @Post(':callId/cancel')
  cancel(@CurrentUser() user: JwtPayload, @Param('callId') callId: string) {
    return this.callsService.cancelCall(callId, user.sub);
  }

  // End (either party, while active)
  @Post(':callId/end')
  end(@CurrentUser() user: JwtPayload, @Param('callId') callId: string) {
    return this.callsService.endCall(callId, user.sub);
  }

  // Mark as media-connected (called when LiveKit audio is flowing)
  @Post(':callId/connected')
  connected(@CurrentUser() user: JwtPayload, @Param('callId') callId: string) {
    return this.callsService.markConnected(callId, user.sub);
  }

  // Heartbeat to prevent ghost calls
  @Post(':callId/heartbeat')
  heartbeat(@CurrentUser() user: JwtPayload, @Param('callId') callId: string) {
    return this.callsService.heartbeat(callId, user.sub);
  }
}
