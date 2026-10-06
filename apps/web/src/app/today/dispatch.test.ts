import { describe, expect, it } from 'vitest';
import { TODAY_VERTICALS, todayScreen } from './dispatch';

const me = (
  vertical: string | null,
  businessId: string | null = 'b1',
  locationId: string | null = 'l1',
) => ({
  context: vertical === null ? null : { vertical, businessId, locationId },
});

describe('/today: один адрес, экран по направлению выбранного филиала', () => {
  it('пускает все три направления: ни одно не уводится на другой адрес', () => {
    expect(TODAY_VERTICALS).toEqual(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE']);
  });

  it('салон и ресторан: свой экран, ключ по Business и филиалу', () => {
    expect(todayScreen(me('BEAUTY'))).toEqual({ screen: 'BEAUTY', key: 'b1:l1' });
    expect(todayScreen(me('FOOD_SERVICE', 'b2', 'l2'))).toEqual({
      screen: 'FOOD_SERVICE',
      key: 'b2:l2',
    });
  });

  it('гостиница, вход без выбранного филиала и незнакомое направление: прежняя Главная', () => {
    expect(todayScreen(me('HOSPITALITY')).screen).toBe('HOSPITALITY');
    expect(todayScreen(me(null)).screen).toBe('HOSPITALITY');
    expect(todayScreen(me('SOMETHING_NEW')).screen).toBe('HOSPITALITY');
  });

  it('салон без подтверждённого филиала: экран салона без ключа, данные не берутся из другого выбора', () => {
    expect(todayScreen(me('BEAUTY', 'b1', null))).toEqual({ screen: 'BEAUTY', key: 'b1:' });
  });
});
