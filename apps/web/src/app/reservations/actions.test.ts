import { afterEach, describe, expect, it, vi } from 'vitest';
import { assignUnitAction, createReservationAction, updateStayGuestsAction } from './actions';
import { ApiError, reservationsApi } from '../../lib/api';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
};
describe('поля существующего API из форм стойки', () => {
  it('создаёт группу из разных категорий и сохраняет все позиции после отказа', async () => {
    const create = vi
      .spyOn(reservationsApi, 'create')
      .mockRejectedValue(new ApiError(409, 'Конфликт'));
    const result = await createReservationAction(
      { error: null },
      form({
        placementIds: '0,1',
        accommodationTypeCode: 'ROOM',
        ratePlanCode: 'BASE',
        adults: '2',
        quantity: '1',
        unitCode: 'R01',
        'item.1.accommodationTypeCode': 'MALE',
        'item.1.ratePlanCode': 'BASE',
        'item.1.adults': '1',
        'item.1.quantity': '4',
        'item.1.unitCode': 'M01',
      }),
    );
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      items: [
        { accommodationTypeCode: 'ROOM', adults: 2, quantity: 1, unitCode: 'R01' },
        { accommodationTypeCode: 'MALE', adults: 1, quantity: 4, unitCode: null },
      ],
    });
    expect(result.values).toMatchObject({ placementIds: '0,1', 'item.1.quantity': '4' });
  });
  it('передаёт email и отчество, сохраняя их при отказе вместе с заметкой', async () => {
    const create = vi
      .spyOn(reservationsApi, 'create')
      .mockRejectedValue(new ApiError(409, 'Место занято'));
    const result = await createReservationAction(
      { error: null },
      form({
        firstName: 'Тест',
        lastName: 'Пример',
        middleName: 'Тестович',
        email: 'test@example.invalid',
        notes: 'Синтетический тест',
      }),
    );
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      guest: { middleName: 'Тестович', email: 'test@example.invalid' },
    });
    expect(result.values).toMatchObject({
      middleName: 'Тестович',
      email: 'test@example.invalid',
      notes: 'Синтетический тест',
    });
    expect(result.error).toBe('Место занято');
  });
  it('передаёт выбранный тариф при переселении в другую категорию', async () => {
    const assign = vi
      .spyOn(reservationsApi, 'assign')
      .mockRejectedValue(new ApiError(409, 'Конфликт'));
    await assignUnitAction(
      'TEST',
      'item',
      { error: null },
      form({ unitCode: 'R2', fromDate: '2026-09-13', ratePlanCode: 'BASE' }),
    );
    expect(assign.mock.calls[0]?.[2]).toMatchObject({
      unitCode: 'R2',
      fromDate: '2026-09-13',
      ratePlanCode: 'BASE',
    });
  });
  it('сохраняет число детей по поддержанному UpdateItemDto', async () => {
    const update = vi
      .spyOn(reservationsApi, 'updateItem')
      .mockRejectedValue(new ApiError(422, 'Вместимость'));
    await updateStayGuestsAction(
      'TEST',
      'item',
      { error: null },
      form({ adults: '1', children: '1' }),
    );
    expect(update.mock.calls[0]?.[2]).toEqual({ adults: 1, children: 1 });
  });
});

it('возвращает заметку и источник при отказе редактирования брони', async () => {
  const { updateReservationAction } = await import('./actions');
  vi.spyOn(reservationsApi, 'update').mockRejectedValueOnce(new Error('Отказ'));
  const fd = new FormData();
  fd.set('notes', 'Введённая заметка');
  fd.set('source', 'PHONE');
  const result = await updateReservationAction('TEST', { error: null }, fd);
  expect(result).toMatchObject({
    error: 'Отказ',
    attempt: 1,
    values: { notes: 'Введённая заметка', source: 'PHONE' },
  });
});
