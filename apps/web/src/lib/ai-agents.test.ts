import { describe, expect, it } from 'vitest';
import type { AgentCardView, AgentCatalogView } from './api';
import {
  SECOND_SELLER_REASON,
  catalogButton,
  channelLines,
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
  extension: { access, status: access === 'off' ? null : 'ACTIVE', activeUntil: null, daysLeft: null },
  canManage: true,
  canConfigure: access === 'active',
  agents: access === 'off' ? [] : [seller()],
  ...patch,
});

describe('кнопка каталога', () => {
  it('расширение не подключено — «Подключить» ведёт на страницу с объяснением', () => {
    expect(catalogButton(catalog('off'))).toEqual({ label: 'Подключить', href: '/ai-seller' });
  });

  it('срок вышел — «Возобновить»', () => {
    expect(catalogButton(catalog('expired'))).toEqual({ label: 'Возобновить', href: '/ai-seller' });
  });

  it('действует, продавец не настроен или бот не подключён — «Настроить»', () => {
    for (const status of ['NOT_CONFIGURED', 'BOT_OFFLINE'] as const)
      expect(catalogButton(catalog('active', { agents: [seller({ status })] }))).toEqual({
        label: 'Настроить',
        href: '/ai-seller',
      });
  });

  it('действует и продавец работает — второй завести нельзя, причина словами', () => {
    expect(catalogButton(catalog('active'))).toEqual({
      label: '+ Подключить AI-продавца',
      href: null,
      reason: SECOND_SELLER_REASON,
    });
    expect(SECOND_SELLER_REASON).toContain('один AI-продавец');
  });

  it('сотруднику смены кнопок нет ни в одном состоянии', () => {
    for (const access of ['off', 'expired', 'active'] as const)
      expect(catalogButton(catalog(access, { canManage: false }))).toBeNull();
  });
});

describe('слова карточки', () => {
  it('Business и Location — через «·», а если объекта нет — так и сказано', () => {
    expect(placementLine(seller())).toBe('Сеть А · Алматы');
    expect(placementLine(seller({ business: null, location: null }))).toBe('Объект ещё не создан');
    expect(
      placementLine({ ...seller({ kind: 'draft', status: 'DRAFT' }), business: null, location: null }),
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
