import { describe, expect, it } from 'vitest';
import {
  AGENT_NAME_MAX,
  AGENT_SETUP_ITEMS,
  createAgentAvailability,
  parseAgentInput,
} from './create';

/**
 * Создание AI-продавца (SA2, plans/business-ai-seller-sa2-2026-09-30.md): разбор ввода, список настройки страницы агента и
 * состояние кнопки «+ Подключить AI-продавца». Сервер и страница берут слова отсюда, интерфейс сам ничего не считает.
 */

const BUSINESS = '11111111-1111-4111-8111-111111111111';
const LOCATION = '22222222-2222-4222-8222-222222222222';

describe('parseAgentInput', () => {
  it('принимает название и два идентификатора, название обрезается по краям', () => {
    const result = parseAgentInput({ name: '  AI-продавец Luxx  ', businessId: BUSINESS, locationId: LOCATION });
    expect(result).toEqual({
      ok: true,
      value: { name: 'AI-продавец Luxx', businessId: BUSINESS, locationId: LOCATION },
    });
  });

  it('организации в значении нет, даже если её прислали', () => {
    const result = parseAgentInput({
      name: 'Агент',
      businessId: BUSINESS,
      locationId: LOCATION,
      organizationId: '33333333-3333-4333-8333-333333333333',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result.value).sort()).toEqual(['businessId', 'locationId', 'name']);
  });

  it('пустое название и название из пробелов, ошибка у поля', () => {
    for (const name of ['', '   ', undefined, null, 7]) {
      const result = parseAgentInput({ name, businessId: BUSINESS, locationId: LOCATION });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.name).toBeTruthy();
    }
  });

  it(`название длиннее ${AGENT_NAME_MAX} знаков, ошибка, ровно ${AGENT_NAME_MAX}, можно`, () => {
    expect(parseAgentInput({ name: 'а'.repeat(AGENT_NAME_MAX), businessId: BUSINESS, locationId: LOCATION }).ok).toBe(true);
    const long = parseAgentInput({ name: 'а'.repeat(AGENT_NAME_MAX + 1), businessId: BUSINESS, locationId: LOCATION });
    expect(long.ok).toBe(false);
  });

  it('переводы строк, управляющие знаки и разметка в названии не проходят', () => {
    for (const name of ['Агент\nвторая строка', 'Агент\u0000', '<b>Агент</b>', 'Агент‮']) {
      const result = parseAgentInput({ name, businessId: BUSINESS, locationId: LOCATION });
      expect(result.ok, name).toBe(false);
    }
  });

  it('идентификаторы, только UUID; ошибка называет нужное поле', () => {
    const result = parseAgentInput({ name: 'Агент', businessId: 'не-uuid', locationId: 42 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.businessId).toBeTruthy();
      expect(result.errors.locationId).toBeTruthy();
      expect(result.errors.name).toBeUndefined();
    }
  });

  it('не объект, все поля с ошибкой, без исключения', () => {
    for (const raw of [null, undefined, 'x', 5, []]) {
      const result = parseAgentInput(raw);
      expect(result.ok).toBe(false);
    }
  });
});

describe('список настройки страницы агента', () => {
  it('«Основное» готово, остальные шесть, ещё нет и недоступны; шагов мастера нет', () => {
    expect(AGENT_SETUP_ITEMS.map((i) => [i.code, i.done])).toEqual([
      ['basics', true],
      ['behavior', false],
      ['knowledge', false],
      ['data', false],
      ['whatsapp', false],
      ['testing', false],
      ['launch', false],
    ]);
    expect(AGENT_SETUP_ITEMS.map((i) => i.label)).toEqual([
      'Основное',
      'Поведение',
      'Знания',
      'Данные WETOP',
      'WhatsApp',
      'Тестирование',
      'Запуск',
    ]);
  });
});

describe('состояние кнопки «+ Подключить AI-продавца»', () => {
  const base = { extension: 'active' as const, canManage: true, locations: { total: 2, free: 1 } };

  it('расширение, право и свободный филиал есть, кнопка активна', () => {
    expect(createAgentAvailability(base)).toEqual({ enabled: true, reason: null });
  });

  it('расширение не подключено или истекло, причина словами', () => {
    expect(createAgentAvailability({ ...base, extension: 'off' })).toEqual({
      enabled: false,
      reason: 'Расширение «ИИ-продавец» не подключено.',
    });
    expect(createAgentAvailability({ ...base, extension: 'expired' })).toEqual({
      enabled: false,
      reason: 'Срок расширения «ИИ-продавец» вышел.',
    });
  });

  it('нет права seller, причина про владельца и управляющего', () => {
    expect(createAgentAvailability({ ...base, canManage: false }).reason).toBe(
      'Создавать агентов могут владелец и управляющий.',
    );
  });

  it('единственный филиал занят, «Нет свободного филиала» с объяснением', () => {
    expect(createAgentAvailability({ ...base, locations: { total: 1, free: 0 } })).toEqual({
      enabled: false,
      reason: 'Нет свободного филиала. Для этого филиала AI-продавец уже создан.',
    });
  });

  it('несколько филиалов, все заняты, «Во всех филиалах…»', () => {
    expect(createAgentAvailability({ ...base, locations: { total: 3, free: 0 } }).reason).toBe(
      'Нет свободного филиала. Во всех филиалах AI-продавец уже создан.',
    );
  });

  it('филиалов нет совсем, причина про создание филиала', () => {
    expect(createAgentAvailability({ ...base, locations: { total: 0, free: 0 } }).reason).toBe(
      'Нет ни одного филиала. Сначала настройте объект.',
    );
  });

  it('порядок причин: расширение важнее права, право важнее филиала', () => {
    expect(
      createAgentAvailability({ extension: 'off', canManage: false, locations: { total: 1, free: 0 } }).reason,
    ).toBe('Расширение «ИИ-продавец» не подключено.');
    expect(
      createAgentAvailability({ extension: 'active', canManage: false, locations: { total: 1, free: 0 } }).reason,
    ).toBe('Создавать агентов могут владелец и управляющий.');
  });
});
