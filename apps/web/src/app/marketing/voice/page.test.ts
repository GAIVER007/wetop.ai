import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  deskShell: vi.fn(),
  summary: vi.fn(),
  calls: vi.fn(),
  callbacks: vi.fn(),
}));
vi.mock('../../../lib/vertical-guard', () => ({ requireFeature: mocks.requireFeature }));
vi.mock('../../../lib/desk-shell', () => ({ deskShell: mocks.deskShell }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/api')>()),
  marketingVoiceApi: { summary: mocks.summary, calls: mocks.calls, callbacks: mocks.callbacks, closeCallback: vi.fn() },
}));
vi.mock('./close-button', async () => {
  const { createElement } = await import('react');
  return { CloseCallbackButton: ({ id }: { id: string }) => createElement('i', { 'data-close-button': id }) };
});

import { ApiError } from '../../../lib/api';
import MarketingVoicePage from './page';

const SUMMARY = {
  month: '2026-10',
  timezone: 'Asia/Almaty',
  hasData: true,
  totals: { calls: 4, answered: 3, ended: 2, rejected: 1, failed: 0, callbacks: 2, transfers: 1, avgDurationSeconds: 150 },
};
const EMPTY_SUMMARY = {
  ...SUMMARY,
  hasData: false,
  totals: { calls: 0, answered: 0, ended: 0, rejected: 0, failed: 0, callbacks: 0, transfers: 0, avgDurationSeconds: null },
};
const CALL = {
  id: 'c1',
  receivedAt: '2026-10-22T05:00:00.000Z',
  callerMasked: '***2233',
  state: 'ENDED',
  direction: 'INBOUND',
  durationSeconds: 125,
  transferRequested: false,
  callbackRequested: true,
  endReason: 'hangup',
};
const CB = {
  id: '7b61f3e1-0000-4000-8000-000000000001',
  callId: 'c1',
  phone: '+77001112233',
  name: 'Айдана',
  note: 'окрашивание',
  status: 'NEW' as const,
  createdAt: '2026-10-22T05:01:00.000Z',
  doneAt: null,
};

const render = async (query: Record<string, string> = {}) =>
  renderToStaticMarkup(await MarketingVoicePage({ searchParams: Promise.resolve(query) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireFeature.mockResolvedValue({ context: { vertical: 'BEAUTY' } });
  mocks.deskShell.mockResolvedValue({ access: { role: 'OWNER' }, readOnly: false });
  mocks.summary.mockResolvedValue(SUMMARY);
  mocks.calls.mockResolvedValue({ month: '2026-10', timezone: 'Asia/Almaty', total: 1, rows: [CALL] });
  mocks.callbacks.mockImplementation(async (status?: string) => (status === 'DONE' ? [] : [CB]));
});

describe('страница «Голосовой агент»', () => {
  it('охраняется реестром функций (только салон) и читает месяц из адреса', async () => {
    await render({ month: '2026-09' });
    expect(mocks.requireFeature).toHaveBeenCalledWith('/marketing/voice');
    expect(mocks.summary).toHaveBeenCalledWith('2026-09');
    await render({ month: 'мусор' });
    expect(mocks.summary).toHaveBeenLastCalledWith(undefined);
  });

  it('итоги, журнал и просьбы из API: номер журнала маской, номер просьбы целиком со ссылкой tel', async () => {
    const html = await render();
    expect(html).toContain('data-testid="marketing-voice-screen"');
    expect(html).toMatch(/data-testid="voice-summary-calls"[^>]*>4</);
    expect(html).toMatch(/data-testid="voice-summary-avg"[^>]*>2 мин 30 с</);
    expect(html).toContain('***2233');
    expect(html).toContain('22.10.2026, 10:00');
    expect(html).toContain('Завершён');
    expect(html).toContain('2 мин 5 с');
    expect(html).toContain('href="tel:+77001112233"');
    expect(html).toContain('+7 700 111 22 33');
    expect(html).toContain('Айдана');
    expect(html).toContain('окрашивание');
    expect(html).toContain('data-close-button="7b61f3e1-0000-4000-8000-000000000001"');
    expect(html).toContain('Просьбы перезвонить (1)');
    expect(html).toContain('Ждёт звонка');
    // время просьбы по часам филиала (Алматы UTC+5), как в журнале, а не UTC (ревью H2)
    expect(html).toContain('22.10.2026, 10:01');
    expect(html).not.toContain('2026-10-22 05:01');
  });

  it('ссылка tel: содержит только плюс и цифры', async () => {
    mocks.callbacks.mockImplementation(async (status?: string) =>
      status === 'DONE' ? [] : [{ ...CB, phone: '+7700111;ext=1,2#' }],
    );
    const html = await render();
    expect(html).toContain('href="tel:+770011112"');
    expect(html).not.toMatch(/href="tel:[^"]*[;,#]/);
  });

  it.each([
    ['BEAUTY', 'по услугам и ценам'],
    ['FOOD_SERVICE', 'часах работы'],
    ['HOSPITALITY', 'просьбы перезвонить'],
  ])('%s: подзаголовок говорит о том, что агент умеет в этом направлении', async (vertical, phrase) => {
    mocks.requireFeature.mockResolvedValue({ context: { vertical } });
    const html = await render();
    expect(html).toContain(phrase);
    if (vertical !== 'BEAUTY') expect(html).not.toContain('по услугам и ценам');
  });

  it('в журнале нет полного номера звонившего', async () => {
    const html = await render();
    const journal = html.slice(html.indexOf('data-testid="voice-calls"'));
    expect(journal).not.toContain('+7700');
  });

  it('без права marketing кнопки закрытия нет, просьбы видны', async () => {
    mocks.deskShell.mockResolvedValue({ access: { role: 'STAFF' }, readOnly: false });
    const html = await render();
    expect(html).toContain('href="tel:+77001112233"');
    expect(html).not.toContain('data-close-button');
  });

  it('организация только для чтения: кнопки закрытия нет', async () => {
    mocks.deskShell.mockResolvedValue({ access: { role: 'OWNER' }, readOnly: true });
    expect(await render()).not.toContain('data-close-button');
  });

  it('пустой журнал: «Нет данных» вместо нулей и памятка подключения', async () => {
    mocks.summary.mockResolvedValue(EMPTY_SUMMARY);
    mocks.calls.mockResolvedValue({ month: '2026-10', timezone: 'Asia/Almaty', total: 0, rows: [] });
    mocks.callbacks.mockResolvedValue([]);
    const html = await render();
    expect(html).toMatch(/data-testid="voice-summary-calls"[^>]*>Нет данных</);
    expect(html).toContain('data-testid="voice-calls-empty"');
    expect(html).toContain('data-testid="voice-callbacks-empty"');
    expect(html).toContain('data-testid="voice-setup"');
    expect(html).not.toMatch(/data-testid="voice-summary-calls"[^>]*>0</);
  });

  it('памятка не просит вводить ключи и не раскрывает значения', async () => {
    const html = await render();
    expect(html).not.toMatch(/<input|VOICE_INGEST_KEY=|секрет/i);
  });

  it('без выбранного филиала (409): «Выберите филиал»', async () => {
    mocks.summary.mockRejectedValue(new ApiError(409, 'Выберите филиал'));
    const html = await render();
    expect(html).toContain('Выберите филиал');
    expect(html).not.toContain('data-testid="voice-summary"');
  });

  it('сбой API: понятная плашка, страница не падает', async () => {
    mocks.summary.mockRejectedValue(new ApiError(500, 'boom'));
    const html = await render();
    expect(html).toContain('data-testid="voice-error"');
  });

  it('есть ещё звонки за месяц: подсказка про последние 50', async () => {
    mocks.calls.mockResolvedValue({ month: '2026-10', timezone: 'Asia/Almaty', total: 120, rows: [CALL] });
    expect(await render()).toContain('Показаны последние 1 из 120');
  });
});
