import { describe, expect, it } from 'vitest';
import { guardWords, heldForWords, incidentOrder, repeatWords } from './incident-view';

const view = (over: Partial<Parameters<typeof incidentOrder>[0]> = {}) => ({
  kind: 'stay.unassigned',
  class: 'B' as const,
  severity: 'WARNING' as const,
  status: 'OPEN' as const,
  occurrences: 1,
  firstSeenAt: '2026-09-21T06:00:00Z',
  lastSeenAt: '2026-09-21T06:00:00Z',
  fixAttempts: 0,
  lastFixResult: null,
  ...over,
});

describe('heldForWords — сколько держится, словами (21.09)', () => {
  it('минуты до часа остаются минутами', () => {
    expect(heldForWords(47 * 60_000)).toBe('47 мин');
  });
  it('1226 минут читаются часами, а не минутами', () => {
    expect(heldForWords(1226 * 60_000)).toBe('20 ч 26 мин');
  });
  it('ровный час — без минут', () => {
    expect(heldForWords(3 * 3_600_000)).toBe('3 ч');
  });
  it('больше суток — днями со склонением', () => {
    expect(heldForWords(50 * 3_600_000)).toBe('2 дня 2 ч');
    expect(heldForWords(24 * 3_600_000)).toBe('1 день');
  });
  it('меньше минуты названо словами, а не нулём', () => {
    expect(heldForWords(5_000)).toBe('меньше минуты');
  });
});

describe('incidentOrder — срочное сверху, взятое в работу вниз', () => {
  it('срочная поднимается над несрочной, что пришла раньше', () => {
    const rows = [
      view({ firstSeenAt: '2026-09-20T00:00:00Z' }),
      view({ severity: 'CRITICAL', firstSeenAt: '2026-09-21T00:00:00Z' }),
    ];
    expect([...rows].sort(incidentOrder).map((r) => r.severity)).toEqual(['CRITICAL', 'WARNING']);
  });
  it('при равной срочности первым идёт то, что ждёт человека, принятое — последним', () => {
    const rows = [
      view({ status: 'ACKNOWLEDGED' }),
      view({ status: 'OPEN' }),
      view({ status: 'ESCALATED' }),
    ];
    expect([...rows].sort(incidentOrder).map((r) => r.status)).toEqual([
      'ESCALATED',
      'OPEN',
      'ACKNOWLEDGED',
    ]);
  });
  it('при равном статусе первой идёт та, что висит дольше', () => {
    const rows = [
      view({ firstSeenAt: '2026-09-21T10:00:00Z' }),
      view({ firstSeenAt: '2026-09-19T10:00:00Z' }),
    ];
    expect([...rows].sort(incidentOrder)[0]!.firstSeenAt).toBe('2026-09-19T10:00:00Z');
  });
});

describe('guardWords — кто отвечает и что сторож сделал', () => {
  it('техника с попытками: число попыток и результат последней', () => {
    expect(guardWords({ class: 'A', fixAttempts: 2, lastFixResult: 'нет launchd' })).toBe(
      'Чинит сторож: 2 попытки, последняя попытка — нет launchd.',
    );
  });
  it('техника без попыток названа словами, а не пустым местом', () => {
    expect(guardWords({ class: 'A', fixAttempts: 0, lastFixResult: null })).toBe(
      'Чинит сторож — попыток ещё не было.',
    );
  });
  it('данные и код: сказано, кто решает, без «не его класс» в каждой строке', () => {
    expect(guardWords({ class: 'B', fixAttempts: 0, lastFixResult: null })).toBe(
      'Решает человек: сторож такие неисправности не чинит.',
    );
    expect(guardWords({ class: 'C', fixAttempts: 0, lastFixResult: null })).toContain(
      'дежурный агент',
    );
  });
});

describe('repeatWords — повторы у ошибок API, время у остальных', () => {
  it('ошибка API считает повторы', () => {
    expect(repeatWords(view({ kind: 'api.error', occurrences: 47 }))).toBe('Повторилась 47 раз.');
  });
  it('бронь без ячейки считает время, а не повторы', () => {
    expect(repeatWords(view({ occurrences: 998, lastSeenAt: '2026-09-21T09:00:00Z' }))).toBe(
      'Держится 3 ч.',
    );
  });
  it('свежая неисправность ничего лишнего не говорит', () => {
    expect(repeatWords(view())).toBe('');
  });
});
