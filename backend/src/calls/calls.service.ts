import {
  Injectable, ForbiddenException, NotFoundException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ZanaGateway } from '../gateway/zana.gateway';
import { SchedulerRegistry, Cron, CronExpression } from '@nestjs/schedule';
import { AccessToken } from 'livekit-server-sdk';
import { CallStatus } from '@prisma/client';

const RING_TIMEOUT_MS = 30_000; // 30 seconds
const GHOST_TIMEOUT_MS = 60_000; // 60 seconds heartbeat
const LIVEKIT_TOKEN_TTL_SECONDS = 3600;

@Injectable()
export class CallsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private gateway: ZanaGateway,
    private scheduler: SchedulerRegistry,
  ) {}

  private get apiKey() { return this.config.get<string>('LIVEKIT_API_KEY') ?? ''; }
  private get apiSecret() { return this.config.get<string>('LIVEKIT_API_SECRET') ?? ''; }
  private get wsUrl() { return this.config.get<string>('LIVEKIT_URL') ?? ''; }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async mintToken(userId: string, roomName: string, identity: string): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      ttl: LIVEKIT_TOKEN_TTL_SECONDS,
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return at.toJwt();
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async cleanupStaleCalls() {
    const now = new Date();
    const ghostCutoff = new Date(Date.now() - GHOST_TIMEOUT_MS);
    const ringing = await this.prisma.call.findMany({
      where: { status: CallStatus.RINGING, expiresAt: { lte: now } },
      select: { id: true, callerId: true, receiverId: true },
    });
    for (const call of ringing) {
      const updated = await this.prisma.call.updateMany({
        where: { id: call.id, status: CallStatus.RINGING },
        data: { status: CallStatus.MISSED, endedAt: now },
      });
      if (updated.count) {
        this.clearRingTimeout(call.id);
        this.gateway.sendToUser(call.callerId, 'call:missed', { callId: call.id });
        this.gateway.sendToUser(call.receiverId, 'call:missed', { callId: call.id });
      }
    }
    const stale = await this.prisma.call.findMany({
      where: {
        status: { in: [CallStatus.ACCEPTED, CallStatus.CONNECTING, CallStatus.CONNECTED] },
        updatedAt: { lt: ghostCutoff },
      },
      select: { id: true, callerId: true, receiverId: true },
    });
    for (const call of stale) {
      const updated = await this.prisma.call.updateMany({
        where: {
          id: call.id,
          status: { in: [CallStatus.ACCEPTED, CallStatus.CONNECTING, CallStatus.CONNECTED] },
          updatedAt: { lt: ghostCutoff },
        },
        data: { status: CallStatus.ENDED, endedAt: now },
      });
      if (updated.count) {
        this.gateway.sendToUser(call.callerId, 'call:ended', { callId: call.id, reason: 'TIMEOUT' });
        this.gateway.sendToUser(call.receiverId, 'call:ended', { callId: call.id, reason: 'TIMEOUT' });
      }
    }
  }

  private async getRideParties(rideId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: rideId },
      include: {
        customer: { select: { id: true, firstName: true, phone: true } },
        driver: { include: { user: { select: { id: true, firstName: true } } } },
      },
    });
    if (!trip) throw new NotFoundException('Ride not found');
    return trip;
  }

  private scheduleRingTimeout(callId: string) {
    const timeout = setTimeout(async () => {
      try {
        const call = await this.prisma.call.findUnique({ where: { id: callId } });
        if (!call || call.status !== CallStatus.RINGING) return;
        await this.prisma.call.update({
          where: { id: callId },
          data: { status: CallStatus.MISSED, endedAt: new Date() },
        });
        // Notify caller — missed
        this.gateway.sendToUser(call.callerId, 'call:missed', { callId });
        // Notify receiver — cancel their ringing UI
        this.gateway.sendToUser(call.receiverId, 'call:missed', { callId });
        console.log(`[CALL] ${callId} MISSED — no answer in ${RING_TIMEOUT_MS / 1000}s`);
      } catch (err) {
        console.error('[CALL] Ring timeout error:', err);
      }
    }, RING_TIMEOUT_MS);

    try {
      this.scheduler.addTimeout(`call_ring_${callId}`, timeout);
    } catch { /* already exists */ }
  }

  private clearRingTimeout(callId: string) {
    try {
      this.scheduler.deleteTimeout(`call_ring_${callId}`);
    } catch { /* not found */ }
  }


  private async getDeliveryParties(deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        driver: { include: { user: { select: { id: true, firstName: true } } } },
        order: { include: { merchant: { select: { userId: true, businessName: true } } } },
      },
    });
    if (!delivery) throw new NotFoundException('DELIVERY_NOT_FOUND');
    return delivery;
  }

  // ── CREATE CALL ─────────────────────────────────────────────────────────

  async createCall(callerId: string, context: 'trip' | 'delivery', contextId: string) {
    let receiverId: string;
    let callerName: string;
    let receiverName: string;

    if (context === 'delivery') {
      const delivery = await this.getDeliveryParties(contextId);

      const merchantUserId = delivery.order?.merchant?.userId;
      const driverUserId = delivery.driver?.user?.id;
      const isMerchant = merchantUserId === callerId;
      const isDriver = driverUserId === callerId;
      if (!isMerchant && !isDriver) throw new ForbiddenException('CALL_NOT_AUTHORIZED');

      // Callable once a rider is actually assigned and holding the parcel —
      // before that there is nobody on the other end of the line yet.
      const callableStatuses = ['COURIER_ASSIGNED', 'PICKED_UP'];
      if (!callableStatuses.includes(delivery.status)) {
        throw new BadRequestException('DELIVERY_NOT_ACTIVE');
      }
      if (!driverUserId) throw new NotFoundException('DRIVER_NOT_FOUND');

      receiverId = isMerchant ? driverUserId : (merchantUserId as string);
      callerName = isMerchant
        ? (delivery.order?.merchant?.businessName ?? 'Merchant')
        : (delivery.driver?.user?.firstName ?? 'Rider');
      receiverName = isMerchant
        ? (delivery.driver?.user?.firstName ?? 'Rider')
        : (delivery.order?.merchant?.businessName ?? 'Merchant');
    } else {
      const trip = await this.getRideParties(contextId);

      const isCustomer = trip.customerId === callerId;
      const isDriver = trip.driver?.user?.id === callerId;
      if (!isCustomer && !isDriver) throw new ForbiddenException('CALL_NOT_AUTHORIZED');

      const callableStatuses = ['DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'RIDE_IN_PROGRESS'];
      if (!callableStatuses.includes(trip.status)) {
        throw new BadRequestException('RIDE_NOT_ACTIVE');
      }
      if (!trip.driver) throw new NotFoundException('DRIVER_NOT_FOUND');

      receiverId = isCustomer ? trip.driver.user.id : trip.customerId;
      callerName = isCustomer
        ? (trip.customer.firstName ?? 'Customer')
        : (trip.driver.user.firstName ?? 'Driver');
      receiverName = isCustomer
        ? (trip.driver.user.firstName ?? 'Driver')
        : (trip.customer.firstName ?? 'Customer');
    }

    // Check for an existing active call on this ride or delivery, whichever
    // applies.
    await this.cleanupStaleCalls();

    const existing = await this.prisma.call.findFirst({
      where: {
        ...(context === 'delivery' ? { deliveryId: contextId } : { rideId: contextId }),
        status: { in: [CallStatus.RINGING, CallStatus.ACCEPTED, CallStatus.CONNECTING, CallStatus.CONNECTED] },
      },
    });
    if (existing) {
      if (existing.callerId === callerId) throw new ConflictException('CALL_ALREADY_EXISTS');
      throw new ConflictException('DRIVER_BUSY');
    }

    const callId = require('crypto').randomUUID();
    const roomName = `zana_call_${callId}`;
    const expiresAt = new Date(Date.now() + RING_TIMEOUT_MS + 5000);

    const call = await this.prisma.call.create({
      data: {
        id: callId,
        ...(context === 'delivery' ? { deliveryId: contextId } : { rideId: contextId }),
        callerId,
        receiverId,
        roomName,
        status: CallStatus.RINGING,
        expiresAt,
      },
    });

    // Generate caller's token so they can join when call is accepted
    const callerIdentity = `caller_${callerId}`;
    const callerToken = await this.mintToken(callerId, roomName, callerIdentity);

    console.log(`[CALL] CREATED ${callId} | ${callerName} → ${receiverName} | Room: ${roomName}`);

    // Notify receiver via WebSocket
    this.gateway.sendToUser(receiverId, 'call:incoming', {
      callId,
      context,
      contextId,
      roomName,
      callerName,
      callerIdentity,
      expiresAt: expiresAt.toISOString(),
    });

    // Schedule ring timeout
    this.scheduleRingTimeout(callId);

    return {
      callId,
      status: 'RINGING',
      roomName,
      wsUrl: this.wsUrl,
      token: callerToken,
      callerIdentity,
    };
  }

  // ── ACCEPT ──────────────────────────────────────────────────────────────

  async acceptCall(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('CALL_NOT_FOUND');
    if (call.receiverId !== userId) throw new ForbiddenException('INVALID_CALL_PARTICIPANT');
    if (call.status !== CallStatus.RINGING) throw new BadRequestException(`CALL_NOT_RINGING (status: ${call.status})`);
    if (new Date() > call.expiresAt) throw new BadRequestException('CALL_EXPIRED');

    // Clear ring timeout
    this.clearRingTimeout(callId);

    // Identity only needs to distinguish the two sides of this call — it
    // does not need to re-derive roles from the ride or delivery.
    const receiverIdentity = `receiver_${userId}`;

    // Generate receiver's LiveKit token
    const token = await this.mintToken(userId, call.roomName, receiverIdentity);

    const accepted = await this.prisma.call.updateMany({
      where: { id: callId, receiverId: userId, status: CallStatus.RINGING, expiresAt: { gt: new Date() } },
      data: { status: CallStatus.ACCEPTED, answeredAt: new Date(), updatedAt: new Date() },
    });
    if (!accepted.count) throw new ConflictException('CALL_ALREADY_HANDLED');

    console.log(`[CALL] ACCEPTED ${callId} by ${userId}`);

    // Notify caller — accepted, they should join LiveKit now
    this.gateway.sendToUser(call.callerId, 'call:accepted', {
      callId,
      roomName: call.roomName,
      wsUrl: this.wsUrl,
      receiverIdentity,
    });

    return {
      callId,
      roomName: call.roomName,
      wsUrl: this.wsUrl,
      token,
      receiverIdentity,
    };
  }

  // ── DECLINE ─────────────────────────────────────────────────────────────

  async declineCall(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('CALL_NOT_FOUND');
    if (call.receiverId !== userId) throw new ForbiddenException('INVALID_CALL_PARTICIPANT');
    if (call.status !== CallStatus.RINGING) throw new BadRequestException('CALL_NOT_RINGING');

    this.clearRingTimeout(callId);

    await this.prisma.call.update({
      where: { id: callId },
      data: { status: CallStatus.DECLINED, endedAt: new Date(), endedBy: userId },
    });

    console.log(`[CALL] DECLINED ${callId}`);
    this.gateway.sendToUser(call.callerId, 'call:declined', { callId });

    return { callId, status: 'DECLINED' };
  }

  // ── CANCEL ──────────────────────────────────────────────────────────────

  async cancelCall(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('CALL_NOT_FOUND');
    if (call.callerId !== userId) throw new ForbiddenException('INVALID_CALL_PARTICIPANT');
    if (![CallStatus.RINGING, CallStatus.INITIATING].includes(call.status as any)) {
      throw new BadRequestException('CANNOT_CANCEL');
    }

    this.clearRingTimeout(callId);

    await this.prisma.call.update({
      where: { id: callId },
      data: { status: CallStatus.CANCELLED, endedAt: new Date(), endedBy: userId },
    });

    console.log(`[CALL] CANCELLED ${callId}`);
    this.gateway.sendToUser(call.receiverId, 'call:cancelled', { callId });

    return { callId, status: 'CANCELLED' };
  }

  // ── END ─────────────────────────────────────────────────────────────────

  async endCall(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('CALL_NOT_FOUND');
    if (call.callerId !== userId && call.receiverId !== userId) {
      throw new ForbiddenException('INVALID_CALL_PARTICIPANT');
    }

    const endableStatuses = [CallStatus.ACCEPTED, CallStatus.CONNECTING, CallStatus.CONNECTED];
    if (!endableStatuses.includes(call.status as any)) {
      throw new BadRequestException(`CALL_NOT_ACTIVE (status: ${call.status})`);
    }

    await this.prisma.call.update({
      where: { id: callId },
      data: { status: CallStatus.ENDED, endedAt: new Date(), endedBy: userId },
    });

    console.log(`[CALL] ENDED ${callId} by ${userId}`);

    // Notify the other party
    const otherId = call.callerId === userId ? call.receiverId : call.callerId;
    this.gateway.sendToUser(otherId, 'call:ended', { callId });

    return { callId, status: 'ENDED' };
  }

  // ── CONNECTED (media ready) ──────────────────────────────────────────────

  async markConnected(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('CALL_NOT_FOUND');
    if (call.callerId !== userId && call.receiverId !== userId) throw new ForbiddenException('INVALID_CALL_PARTICIPANT');
    if (![CallStatus.ACCEPTED, CallStatus.CONNECTING, CallStatus.CONNECTED].includes(call.status as typeof CallStatus.ACCEPTED)) {
      throw new BadRequestException(`CALL_NOT_ACTIVE (status: ${call.status})`);
    }
    if (call.status !== CallStatus.CONNECTED) {
      await this.prisma.call.update({ where: { id: callId }, data: { status: CallStatus.CONNECTED, connectedAt: new Date(), updatedAt: new Date() } });
      console.log(`[CALL] CONNECTED ${callId}`);
    }
    return { callId, status: 'CONNECTED' };
  }

  // ── HEARTBEAT ────────────────────────────────────────────────────────────

  async heartbeat(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('CALL_NOT_FOUND');
    if (call.callerId !== userId && call.receiverId !== userId) throw new ForbiddenException('INVALID_CALL_PARTICIPANT');
    if (![CallStatus.ACCEPTED, CallStatus.CONNECTING, CallStatus.CONNECTED].includes(call.status as typeof CallStatus.ACCEPTED)) throw new BadRequestException(`CALL_NOT_ACTIVE (status: ${call.status})`);
    await this.prisma.call.update({ where: { id: callId }, data: { updatedAt: new Date() } });
    return { ok: true };
  }

  // ── GET ACTIVE ───────────────────────────────────────────────────────────

  async getActiveCall(userId: string) {
    const call = await this.prisma.call.findFirst({
      where: {
        OR: [{ callerId: userId }, { receiverId: userId }],
        status: { in: [CallStatus.RINGING, CallStatus.ACCEPTED, CallStatus.CONNECTING, CallStatus.CONNECTED] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return call;
  }

  // ── GET TOKEN for existing call ──────────────────────────────────────────

  async getCallToken(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('CALL_NOT_FOUND');
    if (call.callerId !== userId && call.receiverId !== userId) {
      throw new ForbiddenException('INVALID_CALL_PARTICIPANT');
    }
    if (![CallStatus.RINGING, CallStatus.ACCEPTED, CallStatus.CONNECTING, CallStatus.CONNECTED].includes(call.status as typeof CallStatus.ACCEPTED)) throw new BadRequestException(`CALL_NOT_ACTIVE (status: ${call.status})`);
    if (call.status === CallStatus.RINGING && new Date() > call.expiresAt) throw new BadRequestException('CALL_EXPIRED');

    const identity = `${userId === call.callerId ? 'caller' : 'receiver'}_${userId}`;
    const token = await this.mintToken(userId, call.roomName, identity);

    return { token, roomName: call.roomName, wsUrl: this.wsUrl, callId, identity };
  }
}
