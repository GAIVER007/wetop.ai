import { describe, expect, it } from 'vitest';
import {
  TODAY_VERTICALS,
  anonymousHospitalityAllowed,
  todayScreen,
  unresolvedTarget,
} from './dispatch';

const me = (
  vertical: string | null,
  businessId: string | null = 'b1',
  locationId: string | null = 'l1',
) => ({
  user: { id: 'u' },
  context: vertical === null ? null : { vertical, businessId, locationId },
});

describe('/today: один адрес, экран только по подтверждённому направлению', () => {
  it('пускает все три направления: ни одно не уводится на другой адрес', () => {
    expect(TODAY_VERTICALS).toEqual(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE']);
  });

  it('гостиница: прежняя Главная', () => {
    expect(todayScreen(me('HOSPITALITY'))).toEqual({ screen: 'HOSPITALITY', key: 'b1:l1' });
  });

  it('салон и ресторан с подтверждёнными Business и филиалом: свой экран, ключ по ним', () => {
    expect(todayScreen(me('BEAUTY'))).toEqual({ screen: 'BEAUTY', key: 'b1:l1' });
    expect(todayScreen(me('FOOD_SERVICE', 'b2', 'l2'))).toEqual({
      screen: 'FOOD_SERVICE',
      key: 'b2:l2',
    });
  });

  it('направление не подтверждено: гостиница не угадывается (SCOPE-HARDENING)', () => {
    expect(todayScreen(me(null)).screen).toBe('UNRESOLVED');
    expect(
      todayScreen({
        user: { id: 'u' },
        context: { vertical: null, businessId: null, locationId: null },
      }).screen,
    ).toBe('UNRESOLVED');
    expect(todayScreen(me('SOMETHING_NEW')).screen).toBe('UNRESOLVED');
  });

  it('салон и ресторан без филиала или без Business: не свой экран, а выбор', () => {
    expect(todayScreen(me('BEAUTY', 'b1', null)).screen).toBe('UNRESOLVED');
    expect(todayScreen(me('FOOD_SERVICE', 'b1', null)).screen).toBe('UNRESOLVED');
    expect(todayScreen(me('BEAUTY', null, 'l1')).screen).toBe('UNRESOLVED');
  });

  it('аноним при включённом замке входа: не гостиница', () => {
    expect(
      todayScreen({ user: null, context: null }, { allowAnonymousHospitality: false }).screen,
    ).toBe('UNRESOLVED');
  });

  it('аноним на открытом стенде разработки (не production, замок выключен): гостиница стенда, как до MV8', () => {
    const allow = anonymousHospitalityAllowed({ authRequired: false, nodeEnv: 'development' });
    expect(allow).toBe(true);
    expect(anonymousHospitalityAllowed({ authRequired: false, nodeEnv: 'test' })).toBe(true);
    expect(
      todayScreen({ user: null, context: null }, { allowAnonymousHospitality: allow }).screen,
    ).toBe('HOSPITALITY');
  });

  it('production с выключенным замком (APP_AUTH_REQUIRED=0): аноним не получает гостиницу', () => {
    const allow = anonymousHospitalityAllowed({ authRequired: false, nodeEnv: 'production' });
    expect(allow).toBe(false);
    expect(
      todayScreen({ user: null, context: null }, { allowAnonymousHospitality: allow }).screen,
    ).toBe('UNRESOLVED');
    // и при включённом замке исключения нет ни в одном окружении
    expect(anonymousHospitalityAllowed({ authRequired: true, nodeEnv: 'development' })).toBe(false);
  });

  it('вошедший без подтверждённого направления: UNRESOLVED в любом окружении', () => {
    for (const allowAnonymousHospitality of [true, false]) {
      expect(todayScreen(me(null), { allowAnonymousHospitality }).screen).toBe('UNRESOLVED');
      expect(todayScreen(me('SOMETHING_NEW'), { allowAnonymousHospitality }).screen).toBe(
        'UNRESOLVED',
      );
    }
  });

  it('куда вести без выбора: без указателя тот же выбор, что после входа; с указателем к явному выбору', () => {
    expect(unresolvedTarget(false)).toBe('/scope/resolve?next=%2Ftoday');
    // указатель уже стоит, а направление не подтверждено: повторный автоматический выбор дал бы то же самое
    expect(unresolvedTarget(true)).toBe('/branches');
  });
});
