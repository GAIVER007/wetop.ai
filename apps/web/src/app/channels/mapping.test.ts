import { describe, expect, it } from 'vitest';
import type { ChannelMappingRow } from '../../lib/api';
import { categoryMappings, planMappings } from './mapping';

/** Как пишет `setup`: строка объекта без номера, затем категория × тариф BASE */
const row = (code: string | null, roomTypeId: string | null, ratePlanId: string | null) =>
  ({
    id: `map-${code ?? 'property'}`,
    localAccommodationTypeCode: code,
    localRatePlanId: code ? 'plan-base' : null,
    localRatePlanCode: code ? 'BASE' : null,
    providerPropertyId: 'prop',
    providerRoomTypeId: roomTypeId,
    providerRatePlanId: ratePlanId,
  }) satisfies ChannelMappingRow;

const categories = [
  { code: 'ROOM', name: 'Двухместный номер' },
  { code: 'MALE', name: 'Мужской общий номер' },
  { code: 'FEMALE', name: 'Женский общий номер' },
];
const plan = (code: string) => ({ code, name: code, currency: 'KZT', active: true });

describe('категории на вкладке «Сопоставление»', () => {
  const mapping = [row(null, null, null), row('ROOM', 'rt-room', 'rp-room'), row('MALE', 'rt-male', 'rp-male')];

  it('сопоставленная — с названием номера Channex, несопоставленная — без номера', () => {
    const [room, male, female] = categoryMappings(categories, mapping, { 'rt-room': 'Double Room' });
    expect(room).toMatchObject({ roomTypeId: 'rt-room', ratePlanId: 'rp-room', channexName: 'Double Room' });
    // название не пришло: категория всё равно сопоставлена, вместо названия — null, а не id
    expect(male).toMatchObject({ roomTypeId: 'rt-male', channexName: null });
    expect(female).toMatchObject({ roomTypeId: null, ratePlanId: null, channexName: null });
  });

  it('строка объекта (без номера Channex) категорию сопоставленной не делает', () => {
    const onlyProperty = [{ ...row(null, null, null), localAccommodationTypeCode: 'ROOM' }];
    expect(categoryMappings(categories, onlyProperty, {})[0]!.roomTypeId).toBeNull();
  });
});

describe('тарифы на вкладке «Сопоставление»: «K из N» по данным', () => {
  const codes = categories.map((c) => c.code);

  it('во всех категориях — выгружается, не во всех — видно, ни в одной — не выгружается', () => {
    const all = [row('ROOM', 'a', 'x'), row('MALE', 'b', 'y'), row('FEMALE', 'c', 'z')];
    const two = all.slice(0, 2);
    expect(planMappings([plan('BASE')], codes, all)[0]).toMatchObject({ mappedIn: 3, status: 'full' });
    expect(planMappings([plan('BASE')], codes, two)[0]).toMatchObject({ mappedIn: 2, status: 'partial' });
    // второй тариф `setup` не сопоставляет — это не ошибка, а «в каналы не выгружается»
    expect(planMappings([plan('NONREF')], codes, all)[0]).toMatchObject({ mappedIn: 0, status: 'none' });
  });

  it('строка без тарифа Channex тариф не считает', () => {
    const noRatePlan = [row('ROOM', 'a', null)];
    expect(planMappings([plan('BASE')], codes, noRatePlan)[0]!.mappedIn).toBe(0);
  });

  it('категорий нет — тариф не выгружается, а не «во всех из нуля»', () => {
    expect(planMappings([plan('BASE')], [], [])[0]!.status).toBe('none');
  });
});
