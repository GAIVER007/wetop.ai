import Anthropic from '@anthropic-ai/sdk';
import type { Browser } from '@playwright/test';
import type { NightObservation } from '@pms/domain';
import type { CollectorApi, CollectorCompetitor, ExtractNight, ReadPage } from './collect';

/**
 * Внешние части ИИ-сборщика: служебный вход WETOP, браузер и модель. Логика порядка шагов в `collect.ts`.
 */

/** Служебный вход M2a (`docs/market/collector.md`): ключ `MARKET_COLLECT_KEY` в `x-wetop-service-key` */
export function collectorApi(baseUrl: string, key: string): CollectorApi {
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-wetop-service-key': key },
    });
    if (!res.ok) throw new Error(`WETOP ${path}: HTTP ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };
  return {
    competitors: async () =>
      (await call<{ competitors: CollectorCompetitor[] }>('/market/collector/competitors')).competitors,
    write: (id, entries) =>
      call(`/market/collector/competitors/${encodeURIComponent(id)}/occupancy`, {
        method: 'PUT',
        body: JSON.stringify({ entries }),
      }),
  };
}

/**
 * Страница площадки так, как её видит гость: обычный браузер без маскировки. Проверки площадки (капча, «подтвердите,
 * что вы человек») не обходятся: их увидит модель и сборщик остановится по соседу.
 */
export function pageReader(browser: Browser): ReadPage {
  return async (url) => {
    const page = await browser.newPage();
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      // цены и номера подгружаются после разметки; не дождались за 15 с — читаем, что есть
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
      return { status: res?.status() ?? 0, text: await page.innerText('body') };
    } finally {
      await page.close();
    }
  };
}

const SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['sold_out', 'available', 'blocked', 'unknown'] },
    roomsLeft: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    evidence: { type: 'string' },
  },
  required: ['status', 'roomsLeft', 'evidence'],
  additionalProperties: false,
} as const;

const SYSTEM = `You read the text of one hotel page on a booking platform (Booking.com or Trip.com), opened for a stay of exactly one night for two adults. Decide what a guest would see for that night and answer with JSON.

status:
- "sold_out": the page says there are no rooms or no availability for these dates at this property.
- "available": at least one room offer for these dates is listed.
- "blocked": the page is a robot check, captcha, "verify you are human", access denied, or a sign-in wall instead of the hotel offers.
- "unknown": anything else, including a page that has not loaded the offers.

roomsLeft (only when status is "available", otherwise null): the total number of rooms that can still be booked for this night, summed over all room types listed. Use explicit counts such as "only 2 rooms left" or the largest number offered in a room-quantity selector. If a room type is listed with no visible count, use null for the whole answer rather than guessing.

evidence: one short quote or paraphrase from the page that supports the answer.`;

/** Ответ модели: только то, что прошло проверку схемой; иначе «не разобрано» */
export function parseObservation(text: string): NightObservation {
  try {
    const raw = JSON.parse(text) as { status?: unknown; roomsLeft?: unknown };
    const status = ['sold_out', 'available', 'blocked', 'unknown'].includes(String(raw.status))
      ? (raw.status as NightObservation['status'])
      : 'unknown';
    const left = raw.roomsLeft;
    const roomsLeft = typeof left === 'number' && Number.isInteger(left) && left >= 0 ? left : null;
    return { status, roomsLeft: status === 'available' ? roomsLeft : null };
  } catch {
    return { status: 'unknown', roomsLeft: null };
  }
}

/**
 * ИИ читает текст страницы: распродано ли, сколько номеров ещё можно забронировать. Модель по умолчанию из справочника
 * API (`claude-opus-5-5`), заменяется `MARKET_COLLECT_MODEL`; отказ модели и непонятный ответ дают «не разобрано».
 */
export function claudeExtractor(client: Anthropic, model: string): ExtractNight {
  return async (text, { name, night }) => {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Hotel: ${name}\nNight: ${night}\n\nPage text:\n${text}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') return { status: 'unknown', roomsLeft: null };
    const block = response.content.find((b) => b.type === 'text');
    return block && block.type === 'text' ? parseObservation(block.text) : { status: 'unknown', roomsLeft: null };
  };
}
