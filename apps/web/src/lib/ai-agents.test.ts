import { describe, expect, it } from 'vitest';
import { READ_ONLY_MESSAGE } from '@pms/domain';
import type { AgentCardView, AgentCatalogView } from './api';
import {
  CREATE_LABEL,
  agentReadiness,
  agentHref,
  channelLines,
  createButton,
  placementLine,
  statusTone,
} from './ai-agents';

/**
 * Слова и кнопки каталога «ИИ-агентов» (SA1, plans/business-ai-seller-v2-2026-09-29.md §8.2). Кнопка зависит от
 * расширения, роли и того, есть ли настроенный продавец; список видит и сотрудник смены, кнопок у него нет.
 */

const seller = (patch: Partial<AgentCardView> = {}): AgentCardView => ({
  id: 'seller',
  kind: 'seller',
  name: 'AI-продавец',
  status: 'WORKING',
  business: { id: 'b', name: 'Сеть А' },
  location: { id: 'l', name: 'Алматы' },
  channels: { site: 'ON', whatsapp: 'OFF' },
  ...patch,
});

const catalog = (
  access: 'active' | 'expired' | 'off',
  patch: Partial<AgentCatalogView> = {},
): AgentCatalogView => ({
  extension: {
    access,
    status: access === 'off' ? null : 'ACTIVE',
    activeUntil: null,
    daysLeft: null,
  },
  canManage: true,
  canConfigure: access === 'active',
  create: {
    enabled: access === 'active',
    reason: access === 'active' ? null : 'Причина от сервера.',
  },
  agents: access === 'off' ? [] : [seller()],
  ...patch,
});

describe('кнопка каталога', () => {
  it('сервер разрешил — кнопка активна и ведёт в форму создания', () => {
    expect(createButton(catalog('active'))).toEqual({
      label: CREATE_LABEL,
      href: '/ai-agents/new',
      reason: null,
      connectHref: null,
    });
  });

  it('сервер не разрешил — кнопка видна, неактивна, причина его словами; страница её не пересчитывает', () => {
    const noFree = catalog('active', {
      create: { enabled: false, reason: 'Нет свободного филиала.' },
    });
    expect(createButton(noFree)).toEqual({
      label: CREATE_LABEL,
      href: null,
      reason: 'Нет свободного филиала.',
      connectHref: null,
    });
  });

  it('расширения нет или оно истекло — неактивна, рядом ссылка «как подключить»', () => {
    for (const access of ['off', 'expired'] as const)
      expect(createButton(catalog(access))).toMatchObject({
        href: null,
        reason: 'Причина от сервера.',
        connectHref: '/ai-seller',
      });
  });

  it('сотруднику смены кнопка тоже видна: неактивна, причина про роль приходит с сервера', () => {
    const staff = catalog('active', {
      canManage: false,
      create: { enabled: false, reason: 'Создавать агентов могут владелец и управляющий.' },
    });
    expect(createButton(staff)).toMatchObject({
      href: null,
      reason: 'Создавать агентов могут владелец и управляющий.',
    });
  });
});

describe('кнопка в режиме «только чтение»', () => {
  it('организация в «только чтении» — кнопка неактивна общей фразой режима, даже если сервер разрешает', () => {
    expect(createButton(catalog('active'), true)).toEqual({
      label: CREATE_LABEL,
      href: null,
      reason: READ_ONLY_MESSAGE,
      connectHref: null,
    });
  });
});

describe('куда ведёт «Открыть»', () => {
  it('рабочий продавец — в раздел, агент с филиалом — на страницу состояния, черновик мастера — в его редактор', () => {
    expect(agentHref(seller())).toBe('/ai-seller');
    expect(agentHref(seller({ id: 'a1', kind: 'agent', status: 'DRAFT' }))).toBe('/ai-agents/a1');
    expect(agentHref(seller({ id: 'd1', kind: 'draft', status: 'DRAFT' }))).toBe(
      '/ai-seller/agents/d1',
    );
  });
});

describe('слова карточки', () => {
  it('Business и Location — через «·», а если объекта нет — так и сказано', () => {
    expect(placementLine(seller())).toBe('Сеть А · Алматы');
    expect(placementLine(seller({ business: null, location: null }))).toBe('Объект ещё не создан');
    expect(
      placementLine({
        ...seller({ kind: 'draft', status: 'DRAFT' }),
        business: null,
        location: null,
      }),
    ).toBe('Business и Location не выбраны');
  });

  it('каналы — только сайт и WhatsApp, словами данных; у черновика их нет', () => {
    expect(channelLines(seller())).toEqual([
      { label: 'Сайт', word: 'Домены заданы', state: 'ON' },
      { label: 'WhatsApp', word: 'Не подключён', state: 'OFF' },
    ]);
    expect(channelLines(seller({ channels: null }))).toEqual([]);
  });

  it('тон значка статуса: работает — ok, требует действия — warn, бот не подключён — danger', () => {
    expect(statusTone('WORKING')).toBe('ok');
    expect(statusTone('NOT_CONFIGURED')).toBe('warn');
    expect(statusTone('SUBSCRIPTION_INACTIVE')).toBe('warn');
    expect(statusTone('BOT_OFFLINE')).toBe('danger');
    expect(statusTone('DRAFT')).toBe('neutral');
  });
});

describe('каталог: правдивая готовность и название объекта', () => {
  it('совпадающие названия сети и объекта не дублируются', () => {
    expect(
      placementLine(
        seller({ business: { id: 'b', name: 'Отель' }, location: { id: 'l', name: 'Отель' } }),
      ),
    ).toBe('Отель');
  });
});

it('профиль принят без каналов — требуется подключение, а не «работает»', () => {
  expect(agentReadiness(seller({ channels: { site: 'OFF', whatsapp: 'OFF' } }))).toMatchObject({
    label: 'Настройте каналы',
    tone: 'warn',
  });
});
it('нет ответа канала — проверка, не успешная работа', () => {
  expect(agentReadiness(seller({ channels: { site: 'OFF', whatsapp: 'UNKNOWN' } }))).toMatchObject({
    label: 'Проверьте подключение',
  });
});
it('даже заданный канал не доказывает ответ модели', () => {
  expect(agentReadiness(seller())).toMatchObject({ label: 'Профиль сохранён' });
});
