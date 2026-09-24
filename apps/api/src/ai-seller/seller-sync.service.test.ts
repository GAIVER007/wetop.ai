import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SELLER_PROFILE, type SellerFactsSource } from '@pms/domain';
import { FakeAudit, FakeConnection, FakeFacts, FakeProfiles, rejected, unavailable } from './fakes';
import type { SellerConfig } from './seller.connection';
import { SellerService } from './seller.service';

/**
 * Сверка с продавцом раз в минуту (ТЗ ред. 1 П8): профиль новее доставленного — отправить; отпечаток фактов другой —
 * отправить (правка карточки, категорий, тарифа сайта — любым путём); отказ — запомнить и повторить в следующий раз.
 */

const ORG = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const config = (): SellerConfig => ({
  baseUrl: 'http://seller:8000/panel-x',
  serviceKey: 'seller-service-key-for-run-0123456789',
  organizationId: ORG,
  publicUrl: null,
  syncEnabled: true,
});
const source = (price = 1_500_000n): SellerFactsSource => ({
  property: {
    name: 'Тестовый хостел',
    address: null,
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    checkInTime: '14:00',
    checkOutTime: '12:00',
  },
  categories: [{ code: 'DBL', name: 'Двухместная', kind: 'PRIVATE_ROOM', capacityAdults: 2, units: 4 }],
  ratePlan: { code: 'BASE', name: 'Базовый тариф' },
  rates: [{ categoryCode: 'DBL', date: '2026-09-25', occupancy: 2, priceMinor: price }],
  window: { from: '2026-09-24', to: '2026-11-22' },
});

let connection: FakeConnection;
let profiles: FakeProfiles;
let facts: FakeFacts;
let service: SellerService;

beforeEach(() => {
  connection = new FakeConnection(config());
  profiles = new FakeProfiles();
  facts = new FakeFacts();
  facts.source = source();
  service = new SellerService(connection, profiles, facts, new FakeAudit());
});

const now = new Date('2026-09-24T09:00:00Z');

describe('SellerService.syncOnce', () => {
  it('продавец не подключён — ничего не делает', async () => {
    connection.settings = { ...config(), baseUrl: null };
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    expect(await service.syncOnce(now)).toEqual({ skipped: 'not-configured' });
    expect(connection.seller.ops()).toEqual([]);
  });

  it('профиля ещё нет — продавца никто не настраивал, ничего не шлёт', async () => {
    expect(await service.syncOnce(now)).toEqual({ skipped: 'no-profile' });
    expect(connection.seller.ops()).toEqual([]);
  });

  it('новый профиль и новые факты — отправляет оба; повтор без правок — ничего', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    expect(await service.syncOnce(now)).toEqual({ profile: true, facts: true });
    expect(connection.seller.ops()).toEqual(['putProfile', 'putFacts']);

    connection.seller.calls = [];
    expect(await service.syncOnce(new Date(now.getTime() + 60_000))).toEqual({
      profile: false,
      facts: false,
    });
    expect(connection.seller.ops()).toEqual([]);
  });

  it('цена в «Тарифах» поменялась — факты уходят сами, без действий в разделе', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    await service.syncOnce(now);
    connection.seller.calls = [];
    facts.source = source(1_600_000n);
    expect(await service.syncOnce(new Date(now.getTime() + 60_000))).toEqual({
      profile: false,
      facts: true,
    });
    const sent = connection.seller.calls[0]!.args[0] as { prices: Array<{ price_text: string }> };
    expect(sent.prices[0]!.price_text).toBe('16 000 ₸');
  });

  it('профиль поправили, пока он уходил продавцу, — отправится ещё раз', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    await service.syncOnce(now);
    await profiles.save(ORG, { ...DEFAULT_SELLER_PROFILE, useEmoji: true }, null, new Date(now.getTime() + 1));
    connection.seller.calls = [];
    expect(await service.syncOnce(new Date(now.getTime() + 60_000))).toMatchObject({ profile: true });
  });

  it('продавец недоступен — ошибка запомнена, исключения нет; следующая минута доставляет и снимает ошибку', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failWith = unavailable();
    expect(await service.syncOnce(now)).toEqual({
      failed: 'ИИ-продавец недоступен (HTTP 502)',
      retry: true,
    });
    expect(profiles.rows.get(ORG)!.lastError).toBe('ИИ-продавец недоступен (HTTP 502)');

    connection.seller.failWith = null;
    expect(await service.syncOnce(new Date(now.getTime() + 60_000))).toEqual({
      profile: true,
      facts: true,
    });
    expect(profiles.rows.get(ORG)!.lastError).toBeNull();
  });
});

/**
 * Отказ по содержанию (400, 422: длины, слой 9) — продавец прочёл и не принял. Та же версия будет отклонена снова, а
 * повтор раз в минуту — проверка слоя 9 и, может быть, тревога у продавца каждую минуту. Контракт
 * (`docs/assistant/README.md` §4): такую версию платформа сама не повторяет — только после правки или «Применить».
 */
describe('SellerService: отказ по содержанию не повторяется сам', () => {
  const minute = (n: number) => new Date(now.getTime() + n * 60_000);
  const INJECTION = 'в поле найдены инструкции для модели';

  it('422 на профиль: та же версия больше не уходит, факты идут; правка профиля — уходит и снимает отказ', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failOn.putProfile = rejected(422, INJECTION);
    expect(await service.syncOnce(now)).toEqual({
      failed: `ИИ-продавец отклонил: ${INJECTION}`,
      retry: false,
    });

    connection.seller.calls = [];
    expect(await service.syncOnce(minute(1))).toEqual({ profile: false, facts: true });
    expect(connection.seller.ops()).toEqual(['putFacts']);
    // отказ остаётся на виду, пока версия та же, и раздел знает, что сам он не повторится
    expect(profiles.rows.get(ORG)!.lastError).toBe(`ИИ-продавец отклонил: ${INJECTION}`);
    expect(await service.status(minute(1))).toMatchObject({
      lastError: `ИИ-продавец отклонил: ${INJECTION}`,
      retrying: false,
    });

    connection.seller.calls = [];
    expect(await service.syncOnce(minute(2))).toEqual({ profile: false, facts: false });
    expect(connection.seller.ops()).toEqual([]);

    delete connection.seller.failOn.putProfile;
    await profiles.save(ORG, { ...DEFAULT_SELLER_PROFILE, useEmoji: true }, null, minute(3));
    expect(await service.syncOnce(minute(4))).toEqual({ profile: true, facts: false });
    expect(profiles.rows.get(ORG)!.lastError).toBeNull();
  });

  it('«Применить» отправляет и отклонённую версию: её шлёт человек, а не сверка', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failOn.putProfile = rejected(422, INJECTION);
    await service.syncOnce(now);

    delete connection.seller.failOn.putProfile;
    connection.seller.calls = [];
    expect(await service.apply(minute(1))).toEqual({ profileApplied: true, factsApplied: true });
    expect(connection.seller.ops()).toEqual(['putProfile', 'putFacts']);
    expect(profiles.rows.get(ORG)!.lastError).toBeNull();
  });

  it('422 на факты: тот же отпечаток не повторяется; поменялась цена — новые факты уходят', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failOn.putFacts = rejected(422, 'категория: слишком длинное название');
    expect(await service.syncOnce(now)).toEqual({
      failed: 'ИИ-продавец отклонил: категория: слишком длинное название',
      retry: false,
    });

    connection.seller.calls = [];
    expect(await service.syncOnce(minute(1))).toEqual({ profile: false, facts: false });
    expect(connection.seller.ops()).toEqual([]);
    expect((await service.status(minute(1))).retrying).toBe(false);

    delete connection.seller.failOn.putFacts;
    facts.source = source(1_600_000n);
    expect(await service.syncOnce(minute(2))).toEqual({ profile: false, facts: true });
    expect(profiles.rows.get(ORG)!.lastError).toBeNull();
  });

  it.each([401, 403, 404, 429])(
    '%i — не про содержание (ключ, адреса ещё нет, частота): следующая минута повторяет',
    async (status) => {
      await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
      connection.seller.failOn.putProfile = rejected(status, 'отказ');
      expect(await service.syncOnce(now)).toMatchObject({ retry: true });
      expect((await service.status(now)).retrying).toBe(true);

      delete connection.seller.failOn.putProfile;
      connection.seller.calls = [];
      expect(await service.syncOnce(minute(1))).toEqual({ profile: true, facts: true });
      expect(profiles.rows.get(ORG)!.lastError).toBeNull();
    },
  );

  it('отказ с именами полей (Б6) — в «Последнем отказе» названия полей экрана, а не коды бота', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failOn.putProfile = rejected(422, 'В полях найдены инструкции для модели', [
      'greeting',
      'house_rules',
      'новое_поле',
    ]);
    const failed = 'ИИ-продавец отклонил: В полях найдены инструкции для модели — «Приветствие», «Правила проживания», «новое_поле»';
    expect(await service.syncOnce(now)).toEqual({ failed, retry: false });
    expect(profiles.rows.get(ORG)!.lastError).toBe(failed);
  });

  it('продавец недоступен — раздел знает, что отправка повторится сама', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failWith = unavailable();
    await service.syncOnce(now);
    expect(await service.status(now)).toMatchObject({
      lastError: 'ИИ-продавец недоступен (HTTP 502)',
      retrying: true,
    });
  });
});
