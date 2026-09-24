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
