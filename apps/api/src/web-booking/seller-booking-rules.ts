import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';

/** Цена и срок предложения приходят из сохранённой котировки, не из текста модели. */
export function assertBookingConfirmation(
  intent: { state: string; expiresAt: Date },
  input: { confirmed?: unknown },
  now: Date,
): void {
  if (input.confirmed !== true) throw new BadRequestException('Сначала подтвердите выбранное предложение');
  if (intent.state === 'CONFIRMED') return;
  if (intent.state !== 'QUOTED') throw new ConflictException('Предложение недоступно. Запросите новое.');
  if (intent.expiresAt.getTime() <= now.getTime()) throw new ConflictException('Срок предложения истек. Запросите новое.');
}

export function bookingRequestHash(input: {
  categoryCode: string; adults: number; arrivalDate: string; departureDate: string;
}): string {
  return createHash('sha256').update(JSON.stringify([
    input.categoryCode, input.adults, input.arrivalDate, input.departureDate,
  ])).digest('hex');
}
