import { ServiceType } from '@prisma/client';
import { FareService } from './fare.service';

describe('FareService', () => {
  const prisma = {
    fareConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;

  let service: FareService;

  beforeEach(() => {
    service = new FareService(prisma);
  });

  it('uses distance only for normal Moto fare', () => {
    const fares = [10, 20, 40].map(duration => service.estimateFare(ServiceType.BIKE, 8.8, duration, outsideRush()));
    expect(fares[0]).toBe(fares[1]);
    expect(fares[1]).toBe(fares[2]);
    expect(fares[0]).toBeGreaterThanOrEqual(1490);
    expect(fares[0]).toBeLessThanOrEqual(1510);
  });

  it('matches the Moto 16.4 km calibration anchor approximately', () => {
    const fare = service.estimateFare(ServiceType.BIKE, 16.4, 13, outsideRush());
    expect(fare).toBeGreaterThanOrEqual(2490);
    expect(fare).toBeLessThanOrEqual(2510);
  });

  it('does not charge waiting before ARRIVED', () => {
    expect(service.calculateWaitingFee(ServiceType.BIKE, null, new Date())).toBe(0);
  });

  it('keeps the first 10 waiting minutes free', () => {
    const arrived = new Date('2026-10-01T10:00:00+02:00');
    expect(service.calculateWaitingFee(ServiceType.BIKE, arrived, plusMinutes(arrived, 5))).toBe(0);
    expect(service.calculateWaitingFee(ServiceType.BIKE, arrived, plusMinutes(arrived, 10))).toBe(0);
  });
  it('charges waiting only after the free period', () => {
    const arrived = new Date('2026-10-01T10:00:00+02:00');
    expect(service.calculateWaitingFee(ServiceType.BIKE, arrived, plusMinutes(arrived, 11))).toBe(100);
    expect(service.calculateWaitingFee(ServiceType.BIKE, arrived, plusMinutes(arrived, 15))).toBe(500);
    expect(service.calculateWaitingFee(ServiceType.BIKE, arrived, plusMinutes(arrived, 20))).toBe(1000);
  });

  it('handles pre-arrival waiting as zero', () => {
    const now = new Date('2026-10-01T10:30:00+02:00');
    expect(service.calculateWaitingFee(ServiceType.BIKE, undefined, now)).toBe(0);
  });

  it('is safe for negative elapsed time', () => {
    const arrived = new Date('2026-10-01T10:10:00+02:00');
    expect(service.calculateWaitingFee(ServiceType.BIKE, arrived, plusMinutes(arrived, -1))).toBe(0);
  });

  it('applies rush multiplier only inside configured windows', () => {
    const beforeMorning = new Date('2026-10-01T06:59:00+02:00');
    const morningRush = new Date('2026-10-01T07:00:00+02:00');
    const morningEnd = new Date('2026-10-01T10:00:00+02:00');
    const eveningRush = new Date('2026-10-01T17:00:00+02:00');
    const eveningEnd = new Date('2026-10-01T19:00:00+02:00');
    const afterEvening = new Date('2026-10-01T19:00:00+02:00');
    const normal = service.estimateFare(ServiceType.BIKE, 8.8, 13, beforeMorning);
    const expectedRush = Math.round((342 + 8.8 * 132) * 1.2);

    expect(service.estimateFare(ServiceType.BIKE, 8.8, 13, morningRush)).toBe(expectedRush);
    expect(service.estimateFare(ServiceType.BIKE, 8.8, 13, morningEnd)).toBe(normal);
    expect(service.estimateFare(ServiceType.BIKE, 8.8, 13, eveningRush)).toBe(expectedRush);
    expect(service.estimateFare(ServiceType.BIKE, 8.8, 13, eveningEnd)).toBe(normal);
    expect(service.estimateFare(ServiceType.BIKE, 8.8, 13, afterEvening)).toBe(normal);
  });
});

function plusMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function outsideRush() {
  return new Date('2026-10-01T12:00:00+02:00');
}
