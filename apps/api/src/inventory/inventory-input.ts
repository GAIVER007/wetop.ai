import { BadRequestException } from '@nestjs/common';
export function inventoryText(value: unknown, label: string): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > 100 ||
    [...value].some((char) => char.codePointAt(0)! < 32)
  )
    throw new BadRequestException(`${label}: укажите от 1 до 100 символов`);
  return value.trim();
}
export function categoryInput(body: Record<string, unknown>) {
  const name = inventoryText(body.name, 'Название');
  const kind = body.kind;
  const capacityAdults = body.capacityAdults;
  if (kind !== 'PRIVATE_ROOM' && kind !== 'DORM_BED' && kind !== 'APARTMENT')
    throw new BadRequestException('Выберите тип размещения');
  if (
    typeof capacityAdults !== 'number' ||
    !Number.isSafeInteger(capacityAdults) ||
    capacityAdults < 1 ||
    capacityAdults > 100 ||
    (kind === 'DORM_BED' && capacityAdults !== 1)
  )
    throw new BadRequestException(
      'Вместимость — целое число от 1 до 100; койко-место рассчитано на одного гостя',
    );
  return { name, kind: kind as 'PRIVATE_ROOM' | 'DORM_BED' | 'APARTMENT', capacityAdults };
}
export function roomInput(body: Record<string, unknown>) {
  if (!Array.isArray(body.codes) || !body.codes.length || body.codes.length > 100)
    throw new BadRequestException('Добавьте от 1 до 100 обозначений мест');
  const codes = body.codes.map((v) => inventoryText(v, 'Обозначение места'));
  if (new Set(codes).size !== codes.length || codes.some((c) => !/^[\p{L}\p{N}_-]+$/u.test(c)))
    throw new BadRequestException(
      'Обозначения должны различаться; используйте буквы, цифры, дефис или подчёркивание',
    );
  return {
    categoryCode: inventoryText(body.categoryCode, 'Категория'),
    building: inventoryText(body.building, 'Корпус'),
    floor: inventoryText(body.floor, 'Этаж'),
    roomNumber: inventoryText(body.roomNumber, 'Комната'),
    codes,
  };
}

/** Выбор тарифа категории (ADR-118): существующий, новый с названием или — только при создании — «настроить позже» */
export type RatePlanChoice =
  | { kind: 'existing'; code: string }
  | { kind: 'new'; name: string }
  | { kind: 'later' };
export function ratePlanChoice(body: Record<string, unknown>, allowLater: boolean): RatePlanChoice {
  if (body.ratePlanCode) return { kind: 'existing', code: inventoryText(body.ratePlanCode, 'Тариф') };
  if (body.newRatePlanName !== undefined && body.newRatePlanName !== '')
    return { kind: 'new', name: inventoryText(body.newRatePlanName, 'Название нового тарифа') };
  if (allowLater && body.ratePlanLater === true) return { kind: 'later' };
  throw new BadRequestException(
    allowLater
      ? 'Выберите тариф или «Настроить позже»'
      : 'Выберите тариф или назовите новый',
  );
}
