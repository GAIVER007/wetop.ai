import { describe, expect, it } from 'vitest';
import {
  parseBeautyServiceInput,
  parseEmployeeInput,
  parseLocationServiceInput,
} from './catalog';

const service = {
  name: 'Маникюр с покрытием',
  category: 'Ногти',
  durationMinutes: 90,
  priceMinor: '1200000',
  currency: 'KZT',
};

describe('parseBeautyServiceInput (DATA_MODEL §19.1, срез B3)', () => {
  it('принимает услугу каталога, цену целыми тиынами', () => {
    const parsed = parseBeautyServiceInput(service);
    expect(parsed).toEqual({
      ok: true,
      value: {
        name: 'Маникюр с покрытием',
        category: 'Ногти',
        durationMinutes: 90,
        priceMinor: 1200000n,
        currency: 'KZT',
        active: true,
      },
    });
  });

  it('название обязательно и обрезается по краям', () => {
    expect(parseBeautyServiceInput({ ...service, name: '  Стрижка  ' })).toMatchObject({
      ok: true,
      value: { name: 'Стрижка' },
    });
    expect(parseBeautyServiceInput({ ...service, name: '   ' })).toMatchObject({ ok: false });
    expect(parseBeautyServiceInput({ ...service, name: 'я'.repeat(201) })).toMatchObject({
      ok: false,
    });
  });

  it('длительность: целые минуты больше нуля', () => {
    for (const durationMinutes of [0, -30, 30.5, '30мин', null]) {
      expect(parseBeautyServiceInput({ ...service, durationMinutes }), String(durationMinutes)).toMatchObject({
        ok: false,
      });
    }
    expect(parseBeautyServiceInput({ ...service, durationMinutes: 1 })).toMatchObject({ ok: true });
  });

  it('цена: целые тиыны, ноль можно, дробь и минус нет', () => {
    expect(parseBeautyServiceInput({ ...service, priceMinor: '0' })).toMatchObject({
      ok: true,
      value: { priceMinor: 0n },
    });
    for (const priceMinor of ['-1', '12.5', 'дорого', null, '']) {
      expect(parseBeautyServiceInput({ ...service, priceMinor }), String(priceMinor)).toMatchObject({
        ok: false,
      });
    }
  });

  it('валюта: три буквы из списка ISO', () => {
    expect(parseBeautyServiceInput({ ...service, currency: 'kzt' })).toMatchObject({
      ok: true,
      value: { currency: 'KZT' },
    });
    for (const currency of ['KZ', 'ТЕНГЕ', '', null]) {
      expect(parseBeautyServiceInput({ ...service, currency }), String(currency)).toMatchObject({
        ok: false,
      });
    }
  });

  it('категория необязательна', () => {
    expect(parseBeautyServiceInput({ ...service, category: '' })).toMatchObject({
      ok: true,
      value: { category: null },
    });
    expect(parseBeautyServiceInput({ ...service, category: undefined })).toMatchObject({
      ok: true,
      value: { category: null },
    });
  });

  it('частичный разбор для правки: приходит только изменённое', () => {
    expect(parseBeautyServiceInput({ active: false }, { partial: true })).toEqual({
      ok: true,
      value: { active: false },
    });
    expect(parseBeautyServiceInput({}, { partial: true })).toMatchObject({ ok: false });
  });
});

describe('parseLocationServiceInput: что филиал меняет у услуги', () => {
  it('включение без переопределений', () => {
    expect(parseLocationServiceInput({ enabled: true })).toEqual({
      ok: true,
      value: { enabled: true, priceOverrideMinor: null, durationOverrideMinutes: null },
    });
  });

  it('своя цена и длительность филиала', () => {
    expect(
      parseLocationServiceInput({
        enabled: true,
        priceOverrideMinor: '1500000',
        durationOverrideMinutes: 120,
      }),
    ).toEqual({
      ok: true,
      value: { enabled: true, priceOverrideMinor: 1500000n, durationOverrideMinutes: 120 },
    });
  });

  it('пустые переопределения снимают свои значения', () => {
    expect(
      parseLocationServiceInput({ enabled: false, priceOverrideMinor: '', durationOverrideMinutes: '' }),
    ).toEqual({
      ok: true,
      value: { enabled: false, priceOverrideMinor: null, durationOverrideMinutes: null },
    });
  });

  it('отрицательная цена и нулевая длительность отклоняются', () => {
    expect(parseLocationServiceInput({ enabled: true, priceOverrideMinor: '-5' })).toMatchObject({
      ok: false,
    });
    expect(parseLocationServiceInput({ enabled: true, durationOverrideMinutes: 0 })).toMatchObject({
      ok: false,
    });
  });
});

describe('parseEmployeeInput: мастер сети', () => {
  it('принимает имя и необязательные контакты', () => {
    expect(parseEmployeeInput({ name: ' Дина ', phone: '+7 701 000 00 00', email: 'DINA@Example.KZ' })).toEqual(
      {
        ok: true,
        value: { name: 'Дина', phone: '+7 701 000 00 00', email: 'dina@example.kz', active: true },
      },
    );
  });

  it('без контактов тоже можно: мастер может их не давать', () => {
    expect(parseEmployeeInput({ name: 'Жанна' })).toEqual({
      ok: true,
      value: { name: 'Жанна', phone: null, email: null, active: true },
    });
  });

  it('имя обязательно, почта должна быть похожа на почту', () => {
    expect(parseEmployeeInput({ name: '  ' })).toMatchObject({ ok: false });
    expect(parseEmployeeInput({ name: 'Дина', email: 'не почта' })).toMatchObject({ ok: false });
  });

  it('частичный разбор: архив одним полем', () => {
    expect(parseEmployeeInput({ active: false }, { partial: true })).toEqual({
      ok: true,
      value: { active: false },
    });
  });
});
