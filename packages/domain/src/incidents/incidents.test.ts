import { describe, expect, it } from 'vitest';
import {
  POLICY,
  decideAction,
  fingerprintOf,
  reconcileIncidents,
  type OpenIncident,
  type Observation,
} from './incidents';

/**
 * Сторож системы (ADR-028): что открыть, что закрыть и что делать с открытой неисправностью.
 * Главные опасности, которые здесь закреплены: закрыть неисправность потому, что упала сама проверка;
 * чинить бесконечно; молча ждать неисправность данных, которую чинит только человек.
 */
const NOW = new Date('2026-09-13T21:00:00Z'); // 03:00 Алматы
const min = (n: number) => n * 60_000;

function obs(over: Partial<Observation> = {}): Observation {
  return {
    kind: 'event.failed',
    title: 'Входящая бронь не обработалась',
    subjectType: 'external_event',
    subjectId: 'rev-1',
    ...over,
  };
}

function open(over: Partial<OpenIncident> = {}): OpenIncident {
  return {
    id: 'i-1',
    kind: 'event.failed',
    fingerprint: 'event.failed:rev-1',
    status: 'OPEN',
    firstSeenAt: new Date(NOW.getTime() - min(5)),
    lastSeenAt: NOW,
    fixAttempts: 0,
    lastFixAt: null,
    alertedAt: null,
    acknowledgedAt: null,
    ...over,
  };
}

describe('fingerprintOf', () => {
  it('вид плюс объект; без объекта — только вид', () => {
    expect(fingerprintOf(obs())).toBe('event.failed:rev-1');
    expect(fingerprintOf(obs({ kind: 'db.down', subjectId: null }))).toBe('db.down');
  });
});

describe('reconcileIncidents', () => {
  it('новая неисправность записывается, повтор той же — тоже (база увеличит счётчик, а не создаст строку)', () => {
    const r = reconcileIncidents({
      open: [open()],
      observed: [obs(), obs({ subjectId: 'rev-2' })],
      checked: ['event.failed'],
      now: NOW,
    });
    expect(r.record.map((o) => o.fingerprint)).toEqual([
      'event.failed:rev-1',
      'event.failed:rev-2',
    ]);
    expect(r.resolve).toEqual([]);
  });

  it('проверка отработала и неисправности больше не видит — закрыть', () => {
    const r = reconcileIncidents({
      open: [open()],
      observed: [],
      checked: ['event.failed'],
      now: NOW,
    });
    expect(r.resolve).toEqual(['i-1']);
  });

  it('проверка этого вида не отработала (Channex или база недоступны) — не закрывать', () => {
    const r = reconcileIncidents({
      open: [open()],
      observed: [],
      checked: ['outbox.failed'],
      now: NOW,
    });
    expect(r.resolve).toEqual([]);
  });

  it('ошибка API не перепроверяется — закрывается после суток тишины', () => {
    const quiet = open({
      id: 'e',
      kind: 'api.error',
      fingerprint: 'api.error:GET /x',
      lastSeenAt: new Date(NOW.getTime() - 25 * 3_600_000),
    });
    const fresh = open({
      id: 'f',
      kind: 'api.error',
      fingerprint: 'api.error:GET /y',
      lastSeenAt: new Date(NOW.getTime() - 3_600_000),
    });
    const r = reconcileIncidents({ open: [quiet, fresh], observed: [], checked: [], now: NOW });
    expect(r.resolve).toEqual(['e']);
  });

  it('упавшую сверку сторож не закрывает, пока не прочитал новый отчёт этого вида', () => {
    const rep = open({
      id: 'r',
      kind: 'reconciliation.fail',
      fingerprint: 'reconciliation.fail:double-entry',
      lastSeenAt: new Date(NOW.getTime() - 48 * 3_600_000),
    });
    const r = reconcileIncidents({ open: [rep], observed: [], checked: [], now: NOW });
    expect(r.resolve).toEqual([]);
  });
});

describe('decideAction', () => {
  it('техника (класс А) с починкой — чинить', () => {
    expect(decideAction(open({ kind: 'outbox.failed' }), NOW, true)).toBe('fix');
  });

  it('починка выключена (GUARD_AUTOFIX=off) — не чинить, а будить', () => {
    expect(decideAction(open({ kind: 'outbox.failed' }), NOW, false)).toBe('escalate');
  });

  it('между попытками выдерживается пауза', () => {
    const p = POLICY['outbox.failed'].fix!;
    const justTried = open({
      kind: 'outbox.failed',
      fixAttempts: 1,
      lastFixAt: new Date(NOW.getTime() - p.minIntervalMs + 1000),
    });
    expect(decideAction(justTried, NOW, true)).toBe('wait');
  });

  it('попытки кончились — будить, а не чинить дальше', () => {
    const p = POLICY['event.failed'].fix!;
    const tired = open({
      fixAttempts: p.maxAttempts,
      lastFixAt: new Date(NOW.getTime() - min(120)),
    });
    expect(decideAction(tired, NOW, true)).toBe('escalate');
  });

  it('данные (класс Б) — сразу будить, ничего не чинить', () => {
    expect(decideAction(open({ kind: 'stay.overbooked' }), NOW, true)).toBe('escalate');
  });

  it('код (класс В) — сразу передать дежурному агенту', () => {
    expect(decideAction(open({ kind: 'api.error' }), NOW, true)).toBe('escalate');
  });

  it('webhook под подозрением: починка уже идёт (частый опрос), будить только если не прошло за 15 минут', () => {
    expect(
      decideAction(
        open({ kind: 'webhook.suspect', firstSeenAt: new Date(NOW.getTime() - min(5)) }),
        NOW,
        true,
      ),
    ).toBe('wait');
    expect(
      decideAction(
        open({ kind: 'webhook.suspect', firstSeenAt: new Date(NOW.getTime() - min(16)) }),
        NOW,
        true,
      ),
    ).toBe('escalate');
  });

  it('уже разбудили или человек принял — повторно не эскалировать', () => {
    expect(decideAction(open({ kind: 'stay.overbooked', status: 'ESCALATED' }), NOW, true)).toBe(
      'none',
    );
    expect(decideAction(open({ kind: 'stay.overbooked', status: 'ACKNOWLEDGED' }), NOW, true)).toBe(
      'none',
    );
  });

  it('у каждого вида записаны класс и важность', () => {
    for (const [kind, p] of Object.entries(POLICY)) {
      expect(['A', 'B', 'C'], kind).toContain(p.class);
      if (p.fix) expect(p.class, `${kind}: чинить сам можно только технику`).toBe('A');
    }
  });
});
