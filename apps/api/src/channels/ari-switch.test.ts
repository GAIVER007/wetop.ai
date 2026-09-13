import { afterEach, describe, expect, it } from 'vitest';
import type { ChannexGateway } from './channels.repository';
import { AriStoppedError, guardAriGateway, isAriStopped } from './ari-switch';

/**
 * Единый выключатель исходящего ARI (Q-126, ADR-038): CHANNEX_ARI=off. Проверка стоит в шлюзе перед отправкой
 * остатков и ограничений, поэтому её не обходит ни очередь, ни кнопки, ни сторож. Остальные вызовы Channex
 * (лента броней, webhook) выключатель не трогает — при откате брони должны продолжать приходить.
 */
afterEach(() => {
  delete process.env.CHANNEX_ARI;
});

describe('isAriStopped', () => {
  it('выключен только явным off (без учёта регистра и пробелов); пусто и любое другое значение — ARI идёт', () => {
    expect(isAriStopped({})).toBe(false);
    expect(isAriStopped({ CHANNEX_ARI: 'on' })).toBe(false);
    expect(isAriStopped({ CHANNEX_ARI: '' })).toBe(false);
    expect(isAriStopped({ CHANNEX_ARI: 'off' })).toBe(true);
    expect(isAriStopped({ CHANNEX_ARI: ' OFF ' })).toBe(true);
  });
});

describe('guardAriGateway', () => {
  function fake() {
    const calls: string[] = [];
    const gw = {
      token: 'k',
      async updateAvailability() {
        calls.push(`availability:${this.token}`);
        return { data: [{ id: 't-a', type: 'task' }] };
      },
      async updateRestrictions() {
        calls.push('restrictions');
        return { data: [{ id: 't-r', type: 'task' }] };
      },
      async bookingRevisionsFeed() {
        calls.push('feed');
        return [];
      },
    };
    return { gw: gw as unknown as ChannexGateway, calls };
  }

  it('ARI остановлен: остатки и ограничения не уходят, ошибка говорит, что делать', async () => {
    process.env.CHANNEX_ARI = 'off';
    const { gw, calls } = fake();
    const guarded = guardAriGateway(gw);
    await expect(guarded.updateAvailability([] as never)).rejects.toBeInstanceOf(AriStoppedError);
    await expect(guarded.updateRestrictions([] as never)).rejects.toThrow(/CHANNEX_ARI/);
    expect(calls).toEqual([]);
  });

  it('при остановленном ARI лента броней работает — брони во время отката продолжают приходить', async () => {
    process.env.CHANNEX_ARI = 'off';
    const { gw, calls } = fake();
    await guardAriGateway(gw).bookingRevisionsFeed();
    expect(calls).toEqual(['feed']);
  });

  it('ARI включён: вызовы проходят в исходный шлюз с его контекстом; выключатель читается на каждом вызове', async () => {
    const { gw, calls } = fake();
    const guarded = guardAriGateway(gw);
    await guarded.updateAvailability([] as never);
    process.env.CHANNEX_ARI = 'off';
    await expect(guarded.updateAvailability([] as never)).rejects.toBeInstanceOf(AriStoppedError);
    delete process.env.CHANNEX_ARI;
    await guarded.updateAvailability([] as never);
    expect(calls).toEqual(['availability:k', 'availability:k']);
  });
});
