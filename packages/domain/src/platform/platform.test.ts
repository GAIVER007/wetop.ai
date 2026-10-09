import { describe, expect, it } from 'vitest';
import {
  activityLabel,
  deltaPercent,
  lastMonths,
  platformMonthPeriod,
  occupancyPercent,
  parseOrganizationCreate,
  revenueByCurrency,
  sumMetric,
  timezoneLabel,
  visibleStatus,
  EMPTY_METRICS,
} from './index';

const ID = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const valid = {
  id: ID,
  name: ' Luxx   Group ',
  brand: 'Luxx',
  vertical: 'HOSPITALITY',
  ownerName: 'Вячеслав Пример',
  ownerEmail: 'Owner@Example.invalid',
  phoneCountry: 'KZ',
  ownerPhone: '+7 700 123 45 67',
  country: 'KZ',
  city: 'Алматы',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  bin: '1234567890',
  website: 'luxx.example.kz',
  createFirstBranch: true,
  branchName: '',
  branchAddress: 'Алматы, ул. Толе би, 286/8',
};

describe('parseOrganizationCreate', () => {
  it('приводит ввод к одному виду: пробелы, почта в нижнем регистре, телефон E.164, сайт со схемой', () => {
    const r = parseOrganizationCreate(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe('Luxx Group');
    expect(r.value.owner).toEqual({
      name: 'Вячеслав Пример',
      email: 'owner@example.invalid',
      phone: '+77001234567',
    });
    expect(r.value.website).toBe('https://luxx.example.kz');
    // название филиала по умолчанию — публичное название бизнеса
    expect(r.value.firstBranch).toEqual({ name: 'Luxx', address: 'Алматы, ул. Толе би, 286/8' });
  });

  it('без первого филиала филиал не создаётся', () => {
    const r = parseOrganizationCreate({ ...valid, createFirstBranch: false });
    expect(r.ok && r.value.firstBranch).toBe(null);
  });

  it('собирает все ошибки сразу, словами формы', () => {
    const r = parseOrganizationCreate({ id: 'x', vertical: 'OTHER', ownerEmail: 'не почта', country: 'ZZ' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual(
      expect.arrayContaining([
        'Запрос без идентификатора: обновите страницу и повторите',
        'Выберите направление бизнеса',
        'Выберите страну',
        'Выберите валюту',
      ]),
    );
  });

  it('город чужой страны, чужой пояс и чужая валюта не принимаются', () => {
    for (const bad of [{ city: 'Ташкент' }, { timezone: 'Mars/Base' }, { currency: 'XXX' }]) {
      expect(parseOrganizationCreate({ ...valid, ...bad }).ok).toBe(false);
    }
  });

  it('триала в запросе нет: поле не читается и в результат не попадает', () => {
    const r = parseOrganizationCreate({ ...valid, status: 'TRIAL', trialEndsAt: '2026-12-01' });
    expect(r.ok && JSON.stringify(r.value)).not.toMatch(/trial|TRIAL/);
  });
});

describe('арифметика обзора', () => {
  const m = (revenueMinor: number | null, occupiedNights: number | null, unitNights: number | null) => ({
    ...EMPTY_METRICS,
    revenueMinor,
    occupiedNights,
    unitNights,
  });

  it('загрузка общим числителем и знаменателем, а не средним процентов', () => {
    // 10 из 10 ночей (100%) и 0 из 90 (0%): среднее процентов 50, честная загрузка 10
    expect(occupancyPercent([{ metrics: m(null, 10, 10) }, { metrics: m(null, 0, 90) }])).toBe(10);
  });

  it('филиалы без загрузки (салон, ресторан) в знаменатель не входят; нет данных, это null', () => {
    expect(occupancyPercent([{ metrics: m(null, null, null) }])).toBeNull();
  });

  it('деньги разных валют не складываются; null не превращается в ноль', () => {
    expect(
      revenueByCurrency([
        { currency: 'KZT', metrics: m(100, null, null) },
        { currency: 'KZT', metrics: m(50, null, null) },
        { currency: 'USD', metrics: m(7, null, null) },
        { currency: 'KZT', metrics: m(null, null, null) },
      ]),
    ).toEqual({ KZT: 150, USD: 7 });
  });

  it('сумма показателя: null, если его нет ни у одного филиала', () => {
    expect(sumMetric([{ metrics: EMPTY_METRICS }], 'guests')).toBeNull();
    expect(sumMetric([{ metrics: { ...EMPTY_METRICS, guests: 3 } }, { metrics: EMPTY_METRICS }], 'guests')).toBe(3);
  });

  it('изменение к прошлому периоду: нет базы, нет процента', () => {
    expect(deltaPercent(112, 100)).toBe(12);
    expect(deltaPercent(5, 0)).toBeNull();
    expect(deltaPercent(null, 10)).toBeNull();
  });
});

describe('периоды', () => {
  it('текущий месяц считается по сегодня включительно, прошлый целиком', () => {
    expect(platformMonthPeriod('2026-10', '2026-10-09')).toMatchObject({ from: '2026-10-01', to: '2026-10-09' });
    expect(platformMonthPeriod('2026-09', '2026-10-09')).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
  });
  it('прошлый период той же длины встык к началу', () => {
    expect(platformMonthPeriod('2026-10', '2026-10-09')).toMatchObject({ previousFrom: '2026-09-22', previousTo: '2026-09-30' });
  });
  it('последние месяцы идут от старого к новому и переходят через год', () => {
    expect(lastMonths('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('состояние организации на экране платформы', () => {
  const now = new Date('2026-10-09T00:00:00Z');
  it('пробной слова «пробный» не достаётся: работает до срока, потом только чтение', () => {
    expect(visibleStatus('TRIAL', new Date('2026-10-20T00:00:00Z'), now)).toBe('ACTIVE');
    expect(visibleStatus('TRIAL', null, now)).toBe('ACTIVE');
    expect(visibleStatus('TRIAL', new Date('2026-10-01T00:00:00Z'), now)).toBe('READ_ONLY');
  });
  it('остальные состояния как есть', () => {
    for (const s of ['ACTIVE', 'READ_ONLY', 'SUSPENDED']) expect(visibleStatus(s, null, now)).toBe(s);
  });
});

describe('подписи', () => {
  it('смещение пояса: целое и с половиной', () => {
    const now = new Date('2026-10-09T00:00:00Z');
    expect(timezoneLabel('Asia/Almaty', 'Алматы', now)).toBe('(GMT+5) Алматы');
    expect(timezoneLabel('Europe/Moscow', 'Москва', now)).toBe('(GMT+3) Москва');
  });
  it('журнал: известное действие словами, неизвестное в ленту не идёт', () => {
    expect(activityLabel('organization.created', { name: 'Luxx Group' })).toEqual({
      label: 'Новая организация',
      detail: 'Luxx Group',
    });
    expect(activityLabel('user.login', {})).toBeNull();
  });
});
