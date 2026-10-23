import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('./actions', () => ({ channelAction: vi.fn(), retryEventAction: vi.fn() }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) =>
    createElement('a', { href, ...rest }, children as never),
}));
import { ChannelButtons } from './buttons';
import { connectionSummary, webhookWord } from './format';

describe('«Каналы продаж» словами для владельца (аудит 22.10.2026 P1-19)', () => {
  it('не подключены: понятная фраза вместо «Объект не сопоставлен»', () => {
    expect(connectionSummary('NO_MAPPING', 'Объект не сопоставлен')).toBe(
      'Гостиница ещё не подключена к Booking.com, Ostrovok и другим каналам.',
    );
    expect(connectionSummary('NO_KEY', 'Не задан ключ менеджера каналов')).toBe(
      'Менеджер каналов ещё не подключён.',
    );
    expect(connectionSummary('UNREACHABLE', 'Менеджер каналов не отвечает')).toBe(
      'Менеджер каналов не отвечает.',
    );
    expect(connectionSummary(undefined, undefined)).toBe(
      'Не удалось проверить соединение с менеджером каналов.',
    );
  });

  it('приём броней из каналов без «не зарегистрирован» и PUBLIC_API_URL', () => {
    expect(webhookWord(null)).toBe('состояние неизвестно');
    expect(webhookWord({ registered: true, active: true, expectedUrl: 'x' })).toBe('работает');
    expect(webhookWord({ registered: true, active: false, expectedUrl: 'x' })).toBe('выключен');
    expect(webhookWord({ registered: false, active: false, expectedUrl: 'x' })).toBe('не настроен');
    expect(webhookWord({ registered: false, active: false, expectedUrl: null })).toBe(
      'адрес сервера не задан',
    );
  });

  it('без подключения вместо двух выключенных кнопок одна ссылка «Подключить каналы»', () => {
    const html = renderToStaticMarkup(
      createElement(ChannelButtons, { group: 'exchange', connected: false, canMutate: true }),
    );
    expect(html).not.toContain('data-testid="channel-flush"');
    expect(html).not.toContain('disabled');
    expect(html).toContain('href="/connections/channex"');
    expect(html).toContain('Подключить каналы');
  });

  it('подключены: обе кнопки обмена на месте', () => {
    const html = renderToStaticMarkup(
      createElement(ChannelButtons, { group: 'exchange', connected: true, canMutate: true }),
    );
    expect(html).toContain('data-testid="channel-flush"');
    expect(html).toContain('data-testid="channel-pull"');
  });
});
