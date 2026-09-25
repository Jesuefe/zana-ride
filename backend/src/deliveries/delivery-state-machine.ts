import { BadRequestException } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';

// The real, existing enum has five states — REQUESTED, COURIER_ASSIGNED,
// PICKED_UP, DELIVERED, CANCELLED. No FAILED or DISPUTED state exists in
// the backend, so this deliberately does not invent one — a status this
// map doesn't recognize is rejected rather than silently allowed through.
const VALID_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  REQUESTED: ['COURIER_ASSIGNED', 'CANCELLED'],
  COURIER_ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [], // terminal
  CANCELLED: [], // terminal
};

// Every status mutation in the delivery system — driver pickup, driver
// complete, admin override, anything added later — must pass through
// this one check. The alternative was every call site deciding for
// itself whether a transition made sense, which is exactly how
// REQUESTED -> DELIVERED could happen directly with no real pickup ever
// occurring.
export function assertValidDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus) {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(`INVALID_TRANSITION:${from}:${to}`);
  }
}
