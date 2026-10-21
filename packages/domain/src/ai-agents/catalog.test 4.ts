import { describe, expect, it } from 'vitest';
import {
  AGENT_STATUS_WORDS,
  agentStatus,
  channelWord,
  type AgentStatus,
  type ChannelState,
} from './catalog';

/**
 * Каталог Business Agents (SA1, plans/business-ai-seller-v2-2026-09-29.md §8.1): статус карточки считается из того, что
 * уже есть, и нигде не хранится. Слова показывают только то, что видно в данных сегодня: `TESTING`, `PAUSED`, `ERROR`
 * появятся с хранимым состоянием агента (SA9).
 */

describe('статус карточки рабочего продавца', () => {
  it('расширение не подключено — карточки нет', () => {
    expect(
      agentStatus({ extension: 'off', connection: 'ready', profileApplied: true }),
    ).toBeNull();
  });

  it('срок расширения вышел — «Подписка не активна», что бы ни было с ботом и профилем', () => {
    for (const connection of ['ready', 'not-configured'] as const)
      for (const profileApplied of [true, false])
        expect(agentStatus({ extension: 'expired', connection, profileApplied })).toBe(
          'SUBSCRIPTION_INACTIVE',
        );
  });

  it('у платформы нет адреса и ключа бота — «Бот не подключён», даже если профиль применён', () => {
    expect(
      agentStatus({ extension: 'active', connection: 'not-configured', profileApplied: true }),
    ).toBe('BOT_OFFLINE');
  });

  it('профиль применён — «Работает»', () => {
    expect(
      agentStatus({ extension: 'active', connection: 'ready', profileApplied: true }),
    ).toBe('WORKING');
  });

  it('профиля нет или продавец его не принял — «Не настроен»', () => {
    expect(
      agentStatus({ extension: 'active', connection: 'ready', profileApplied: false }),
    ).toBe('NOT_CONFIGURED');
  });
});

describe('слова статуса и каналов', () => {
  it('на каждый статус — своё слово, без повторов', () => {
    const statuses: AgentStatus[] = [
      'WORKING',
      'NOT_CONFIGURED',
      'BOT_OFFLINE',
      'SUBSCRIPTION_INACTIVE',
      'DRAFT',
    ];
    const words = statuses.map((s) => AGENT_STATUS_WORDS[s]);
    expect(words).toEqual([
      'Работает',
      'Не настроен',
      'Бот не подключён',
      'Подписка не активна',
      'Черновик',
    ]);
    expect(new Set(words).size).toBe(statuses.length);
  });

  it('сайт и WhatsApp называются по тому, что видно в данных', () => {
    const cases: Array<[string, ChannelState, string]> = [
      ['site', 'ON', 'Домены заданы'],
      ['site', 'OFF', 'Не заданы'],
      ['site', 'UNKNOWN', 'Нет данных'],
      ['whatsapp', 'ON', 'Подключён'],
      ['whatsapp', 'OFF', 'Не подключён'],
      ['whatsapp', 'UNKNOWN', 'Нет данных'],
    ];
    for (const [channel, state, word] of cases)
      expect(channelWord(channel as 'site' | 'whatsapp', state)).toBe(word);
  });
});
