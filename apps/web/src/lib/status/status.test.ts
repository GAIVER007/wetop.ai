import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { beautyStatus } from './beauty';
import { foodStatus } from './food';
import { hospitalityStatus } from './hospitality';
import { housekeepingStatus } from './housekeeping';
import { paymentStatus } from './payment';
import { sourceStatus } from './source';
import { statusLabel, statusText, type StatusRegistry } from './types';

/*
 * Реестры статусов по доменам (MV8.5 DS1a, решения владельца №3 и 08.10). Каждое значение enum домена
 * из схемы базы имеет слово и тон; слова гостиницы, уборки и оплаты равны утверждённой таблице,
 * слова салона и ресторана равны принятым до DS1a (их не переименовываем).
 */
const schema = readFileSync(
  resolve(import.meta.dirname, '../../../../../packages/database/prisma/schema.prisma'),
  'utf8',
);
const enumValues = (name: string): string[] => {
  const body = new RegExp(`^enum ${name} \\{([^}]*)\\}`, 'm').exec(schema)?.[1];
  expect(body, `enum ${name} в schema.prisma`).toBeTruthy();
  return body!
    .split('\n')
    .map((l) => l.replace(/\/\/.*/, '').trim())
    .filter(Boolean);
};
const TONES = ['neutral', 'info', 'success', 'warning', 'danger'];

const covers = (registry: StatusRegistry<string>, values: string[]) => {
  expect(Object.keys(registry).sort()).toEqual([...values].sort());
  for (const [key, s] of Object.entries(registry)) {
    expect(s.label.trim(), key).not.toBe('');
    expect(TONES, key).toContain(s.tone);
  }
};

describe('гостиница', () => {
  it('каждое значение ReservationStatus имеет слово и тон', () =>
    covers(hospitalityStatus, enumValues('ReservationStatus')));
  it('слова, группы и тона утверждены владельцем', () => {
    const view = Object.fromEntries(
      Object.entries(hospitalityStatus).map(([k, s]) => [k, [s.label, s.groupLabel, s.tone]]),
    );
    expect(view).toEqual({
      TENTATIVE: ['Не подтверждена', 'Не подтверждённые', 'warning'],
      CONFIRMED: ['Подтверждена', 'Подтверждённые', 'info'],
      CHECKED_IN: ['Проживает', 'Проживают', 'success'],
      CHECKED_OUT: ['Выехал', 'Выехавшие', 'neutral'],
      CANCELLED: ['Отменена', 'Отменённые', 'danger'],
      NO_SHOW: ['Незаезд', 'Незаезды', 'danger'],
    });
  });
});

describe('уборка', () => {
  it('каждое значение HousekeepingStatus имеет слово и тон', () =>
    covers(housekeepingStatus, enumValues('HousekeepingStatus')));
  it('слова и тона утверждены, пояснений в реестре нет', () => {
    expect(
      Object.fromEntries(
        Object.entries(housekeepingStatus).map(([k, s]) => [k, [s.label, s.tone]]),
      ),
    ).toEqual({
      DIRTY: ['Требует уборки', 'warning'],
      CLEAN: ['Убрано', 'info'],
      INSPECTED: ['Проверено', 'success'],
    });
    for (const s of Object.values(housekeepingStatus)) expect(s.label).not.toMatch(/,/);
  });
});

describe('оплата', () => {
  it('шесть утверждённых состояний', () =>
    expect(Object.values(paymentStatus).map((s) => s.label)).toEqual([
      'Оплачено',
      'Оплачено частично',
      'Не оплачено',
      'Есть долг',
      'К возврату',
      'Возвращено',
    ]));
  it('у каждого тон из договора', () => covers(paymentStatus, Object.keys(paymentStatus)));
});

describe('салон и ресторан: слова без переименования, тоны по общей семантике', () => {
  it('AppointmentStatus', () => {
    covers(beautyStatus, enumValues('AppointmentStatus'));
    expect(
      Object.fromEntries(
        Object.entries(beautyStatus).map(([k, s]) => [k, [s.label, s.groupLabel, s.tone]]),
      ),
    ).toEqual({
      BOOKED: ['Записан', 'Запланировано', 'warning'],
      CONFIRMED: ['Подтверждена', 'Подтверждено', 'info'],
      DONE: ['Завершена', 'Завершено', 'neutral'],
      NO_SHOW: ['Не пришёл', 'Не пришли', 'danger'],
      CANCELLED: ['Отменена', 'Отменено', 'danger'],
    });
  });
  it('RestaurantReservationStatus', () => {
    covers(foodStatus, enumValues('RestaurantReservationStatus'));
    expect(
      Object.fromEntries(
        Object.entries(foodStatus).map(([k, s]) => [k, [s.label, s.groupLabel, s.tone]]),
      ),
    ).toEqual({
      BOOKED: ['Бронь', 'Запланировано', 'warning'],
      CONFIRMED: ['Подтверждено', 'Подтверждено', 'info'],
      SEATED: ['За столом', 'Посажены', 'success'],
      COMPLETED: ['Завершено', 'Завершено', 'neutral'],
      NO_SHOW: ['Не пришли', 'Не пришли', 'danger'],
      CANCELLED: ['Отменено', 'Отменено', 'danger'],
    });
  });
});

describe('источники брони', () => {
  it('каждое значение ReservationSource имеет подпись и короткое имя', () => {
    covers(sourceStatus, enumValues('ReservationSource'));
    for (const s of Object.values(sourceStatus)) expect(s.short?.trim()).toBeTruthy();
  });
  it('подписи утверждены, короткие имена разных источников различаются', () => {
    expect(sourceStatus.WALK_IN.label).toBe('Без предварительной брони');
    expect(sourceStatus.OTA.label).toBe('Канал продаж');
    expect([sourceStatus.DESK.short, sourceStatus.WALK_IN.short, sourceStatus.OTA.short]).toEqual([
      'Стойка',
      'Без брони',
      'OTA',
    ]);
    const shorts = Object.values(sourceStatus).map((s) => s.short);
    expect(new Set(shorts).size).toBe(shorts.length);
  });
  it('бренды не переименованы', () => {
    expect(sourceStatus.WHATSAPP.label).toBe('WhatsApp');
    expect(sourceStatus.INSTAGRAM.label).toBe('Instagram');
  });
});

describe('помощники', () => {
  it('неизвестное значение показывается как есть', () => {
    expect(statusLabel(hospitalityStatus, 'SOMETHING')).toBe('SOMETHING');
    expect(statusLabel(hospitalityStatus, 'CHECKED_IN')).toBe('Проживает');
  });
  it('внутри фразы слово со строчной буквы, бренд не трогается', () => {
    expect(statusText(hospitalityStatus, 'TENTATIVE')).toBe('не подтверждена');
    expect(statusText(sourceStatus, 'WHATSAPP')).toBe('WhatsApp');
  });
});
