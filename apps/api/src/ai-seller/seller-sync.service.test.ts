import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SELLER_PROFILE, type SellerFactsSource } from '@pms/domain';
import { withSignedInUser } from '../auth/request-context';
import {
  FakeAudit,
  FakeConnection,
  FakeFacts,
  FakeOrgs,
  FakeProfiles,
  FakeSellerExtensions,
  rejected,
  unavailable,
} from './fakes';
import type { SellerConfig } from './seller.connection';
import { SellerService, type SyncResult } from './seller.service';

/**
 * Сверка с продавцом раз в минуту (ТЗ ред. 1 П8; Э4 — ADR-083): профиль новее доставленного — отправить; отпечаток
 * фактов другой — отправить (правка карточки, категорий, тарифа сайта — любым путём); отказ — запомнить и повторить
 * в следующий раз. С Э4 каждый проход начинается с заведения гостиницы у продавца (`putOrganization`).
 */

const ORG = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const NAME = 'Гостиница-стенд';
const config = (): SellerConfig => ({
  baseUrl: 'http://seller:8000/panel-x',
  serviceKey: 'seller-service-key-for-run-0123456789',
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
  ratePlan: { code: 'BASE', name: 'Базовый тариф', currency: 'KZT' },
  rates: [{ categoryCode: 'DBL', date: '2026-09-25', occupancy: 2, priceMinor: price }],
  window: { from: '2026-09-24', to: '2026-11-22' },
});

let connection: FakeConnection;
let profiles: FakeProfiles;
let facts: FakeFacts;
let service: SellerService;
let extensions: FakeSellerExtensions;
let orgs: FakeOrgs;

beforeEach(() => {
  connection = new FakeConnection(config());
  profiles = new FakeProfiles();
  facts = new FakeFacts();
  facts.source = source();
  extensions = new FakeSellerExtensions();
  orgs = new FakeOrgs();
  orgs.rows = [{ organizationId: ORG, name: NAME }];
  service = new SellerService(connection, profiles, facts, new FakeAudit(), extensions as never, orgs);
});

const now = new Date('2026-09-24T09:00:00Z');

/** Экраны раздела всегда за вошедшим (Э4): статус и «Применить» — с организацией вошедшего */
const asOwner = <T>(fn: () => Promise<T>): Promise<T> =>
  withSignedInUser({ userId: 'u-1', organizationId: ORG, role: 'OWNER' }, fn);

/** Итог сверки одной гостиницы стенда: сколько дошло и какие отказы */
const one = (profile: number, facts: number, failed: string[] = []): SyncResult => ({
  organizations: 1,
  profile,
  facts,
  failed,
});

/** Вызовы без заведения гостиницы: оно идёт первым в каждом проходе, и отдельно его проверяет свой тест */
const opsAfterOrg = () => connection.seller.ops().filter((op) => op !== 'putOrganization');

describe('SellerService.syncOnce', () => {
  it('продавец не подключён — ничего не делает', async () => {
    connection.settings = { ...config(), baseUrl: null };
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    expect(await service.syncOnce(now)).toEqual({ skipped: 'not-configured' });
    expect(connection.seller.ops()).toEqual([]);
  });

  it('расширение организации не действует — гостиница уходит с active=false, профиль и факты нет (ADR-083, Q-183)', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    for (const access of ['off', 'expired'] as const) {
      extensions.access = access;
      connection.seller.calls = [];
      expect(await service.syncOnce(now)).toEqual(one(0, 0));
      expect(connection.seller.ops()).toEqual(['putOrganization']);
      expect(connection.seller.calls[0]!.args[1]).toMatchObject({ active: false });
    }
    expect(extensions.asked).toContain(ORG);
  });

  it('профиля ещё нет — продавца никто не настраивал: уходит только гостиница', async () => {
    expect(await service.syncOnce(now)).toEqual(one(0, 0));
    expect(connection.seller.ops()).toEqual(['putOrganization']);
  });

  it('новый профиль и новые факты — отправляет оба; повтор без правок — только гостиницу', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    expect(await service.syncOnce(now)).toEqual(one(1, 1));
    expect(connection.seller.ops()).toEqual(['putOrganization', 'putProfile', 'putFacts']);
    // каждая отправка — с организацией гостиницы: панель продавца кладёт строки в неё
    expect(connection.requestedOrgs).toEqual([ORG]);

    connection.seller.calls = [];
    expect(await service.syncOnce(new Date(now.getTime() + 60_000))).toEqual(one(0, 0));
    expect(connection.seller.ops()).toEqual(['putOrganization']);
  });

  it('цена в «Тарифах» поменялась — факты уходят сами, без действий в разделе', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    await service.syncOnce(now);
    connection.seller.calls = [];
    facts.source = source(1_600_000n);
    expect(await service.syncOnce(new Date(now.getTime() + 60_000))).toEqual(one(0, 1));
    // бот деньги не форматирует за платформу и не считает: ему уходят целые тиыны (ADR-008)
    const sent = connection.seller.calls.find((c) => c.op === 'putFacts')!.args[0] as {
      categories: Array<{ price_minor: number | null }>;
    };
    expect(sent.categories[0]!.price_minor).toBe(1_600_000);
  });

  it('профиль поправили, пока он уходил продавцу, — отправится ещё раз', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    await service.syncOnce(now);
    await profiles.save(ORG, { ...DEFAULT_SELLER_PROFILE, emoji: 'MODERATE' }, null, new Date(now.getTime() + 1));
    connection.seller.calls = [];
    expect(await service.syncOnce(new Date(now.getTime() + 60_000))).toMatchObject({ profile: 1 });
  });

  it('название объекта в карточке поменялось — профиль уходит заново: бот представляется именем из карточки', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    await service.syncOnce(now);
    connection.seller.calls = [];
    const renamed = source();
    renamed.property.name = 'Хостел на Абая';
    facts.source = renamed;
    expect(await service.syncOnce(new Date(now.getTime() + 60_000))).toEqual(one(1, 1));
    const [profileCall, factsCall] = connection.seller.calls.filter((c) => c.op !== 'putOrganization');
    expect(profileCall!.args[0]).toMatchObject({ object_name: 'Хостел на Абая' });
    expect(factsCall!.args[0]).toMatchObject({ object_name: 'Хостел на Абая' });
  });

  it('у организации нет объекта — профиль не уходит, причина словами; гостиница уходит всё равно', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    facts.source = null;
    expect(await service.syncOnce(now)).toEqual(
      one(0, 0, [`${NAME}: У организации нет объекта: факты для продавца собрать не из чего`]),
    );
    expect(connection.seller.ops()).toEqual(['putOrganization']);
  });

  it('продавец недоступен — ошибка запомнена, исключения нет; следующая минута доставляет и снимает ошибку', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failWith = unavailable();
    expect(await service.syncOnce(now)).toEqual(
      one(0, 0, [`${NAME}: ИИ-продавец недоступен (HTTP 502)`]),
    );
    // упало уже заведение гостиницы: отказ по ней не пишется в профиль — до профиля не дошло
    connection.seller.failWith = null;
    expect(await service.syncOnce(new Date(now.getTime() + 60_000))).toEqual(one(1, 1));
    expect(profiles.rows.get(ORG)!.lastError).toBeNull();
  });

  it('отказ путей профиля запоминается в last_error и виден статусу раздела', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failOn.putProfile = unavailable();
    expect(await service.syncOnce(now)).toEqual(
      one(0, 0, [`${NAME}: ИИ-продавец недоступен (HTTP 502)`]),
    );
    expect(profiles.rows.get(ORG)!.lastError).toBe('ИИ-продавец недоступен (HTTP 502)');
    expect(await asOwner(() => service.status(now))).toMatchObject({
      lastError: 'ИИ-продавец недоступен (HTTP 502)',
      retrying: true,
    });
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
    expect(await service.syncOnce(now)).toEqual(
      one(0, 0, [`${NAME}: ИИ-продавец отклонил: ${INJECTION}`]),
    );

    connection.seller.calls = [];
    expect(await service.syncOnce(minute(1))).toEqual(one(0, 1));
    expect(opsAfterOrg()).toEqual(['putFacts']);
    // отказ остаётся на виду, пока версия та же, и раздел знает, что сам он не повторится
    expect(profiles.rows.get(ORG)!.lastError).toBe(`ИИ-продавец отклонил: ${INJECTION}`);
    expect(await asOwner(() => service.status(minute(1)))).toMatchObject({
      lastError: `ИИ-продавец отклонил: ${INJECTION}`,
      retrying: false,
    });

    connection.seller.calls = [];
    expect(await service.syncOnce(minute(2))).toEqual(one(0, 0));
    expect(opsAfterOrg()).toEqual([]);

    delete connection.seller.failOn.putProfile;
    await profiles.save(ORG, { ...DEFAULT_SELLER_PROFILE, emoji: 'MODERATE' }, null, minute(3));
    expect(await service.syncOnce(minute(4))).toEqual(one(1, 0));
    expect(profiles.rows.get(ORG)!.lastError).toBeNull();
  });

  it('«Применить» отправляет и отклонённую версию: её шлёт человек, а не сверка', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failOn.putProfile = rejected(422, INJECTION);
    await service.syncOnce(now);

    delete connection.seller.failOn.putProfile;
    connection.seller.calls = [];
    expect(await asOwner(() => service.apply(minute(1)))).toEqual({
      profileApplied: true,
      factsApplied: true,
    });
    expect(connection.seller.ops()).toEqual(['putProfile', 'putFacts']);
    expect(profiles.rows.get(ORG)!.lastError).toBeNull();
  });

  it('422 на факты: тот же отпечаток не повторяется; поменялась цена — новые факты уходят', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failOn.putFacts = rejected(422, 'категория: слишком длинное название');
    expect(await service.syncOnce(now)).toEqual(
      one(0, 0, [`${NAME}: ИИ-продавец отклонил: категория: слишком длинное название`]),
    );

    connection.seller.calls = [];
    expect(await service.syncOnce(minute(1))).toEqual(one(0, 0));
    expect(opsAfterOrg()).toEqual([]);
    expect((await asOwner(() => service.status(minute(1)))).retrying).toBe(false);

    delete connection.seller.failOn.putFacts;
    facts.source = source(1_600_000n);
    expect(await service.syncOnce(minute(2))).toEqual(one(0, 1));
    expect(profiles.rows.get(ORG)!.lastError).toBeNull();
  });

  it.each([401, 403, 404, 429])(
    '%i — не про содержание (ключ, адреса ещё нет, частота): следующая минута повторяет',
    async (status) => {
      await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
      connection.seller.failOn.putProfile = rejected(status, 'отказ');
      expect((await service.syncOnce(now)) as { failed: string[] }).toMatchObject({
        failed: [expect.stringContaining('ИИ-продавец отклонил')],
      });
      expect((await asOwner(() => service.status(now))).retrying).toBe(true);

      delete connection.seller.failOn.putProfile;
      connection.seller.calls = [];
      expect(await service.syncOnce(minute(1))).toEqual(one(1, 1));
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
    expect(await service.syncOnce(now)).toEqual(one(0, 0, [`${NAME}: ${failed}`]));
    expect(profiles.rows.get(ORG)!.lastError).toBe(failed);
  });

  it('продавец недоступен — раздел знает, что отправка повторится сама', async () => {
    await profiles.save(ORG, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failOn.putProfile = unavailable();
    await service.syncOnce(now);
    expect(await asOwner(() => service.status(now))).toMatchObject({
      lastError: 'ИИ-продавец недоступен (HTTP 502)',
      retrying: true,
    });
  });
});
