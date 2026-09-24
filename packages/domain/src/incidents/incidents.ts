/**
 * Неисправности системы (DATA_MODEL §12, ADR-028): виды, классы, политика починки и правила открытия и закрытия.
 * Чистая логика: сторож в API собирает наблюдения, этот модуль решает, что с ними делать.
 */

export type IncidentClass = 'A' | 'B' | 'C';
export type IncidentSeverity = 'CRITICAL' | 'WARNING';
export type IncidentStatus = 'OPEN' | 'FIXING' | 'ESCALATED' | 'ACKNOWLEDGED' | 'RESOLVED';

export type IncidentKind =
  | 'webhook.suspect'
  | 'webhook.unreachable'
  | 'webhook.misrouted'
  | 'feed.stale'
  | 'outbox.failed'
  | 'outbox.stuck'
  | 'ari.delta.lost'
  | 'event.failed'
  | 'event.rejected'
  | 'sync.missing'
  | 'db.down'
  | 'stay.overbooked'
  | 'stay.unassigned'
  | 'api.error'
  | 'reconciliation.fail'
  | 'tests.failing'
  | 'web.down'
  | 'ari.oversell'
  | 'backup.stale';

export interface FixPolicy {
  /** Сколько раз сторож пробует сам, дальше — будит */
  maxAttempts: number;
  /** Пауза между попытками: не долбить Channex и не чинить быстрее, чем починка успевает подействовать */
  minIntervalMs: number;
  /** Выдержка до первой попытки: не чинить на первом медленном ответе (стойку не перезапускать из-за одной сборки) */
  afterMs?: number;
}

export interface KindPolicy {
  class: IncidentClass;
  /** Важность по умолчанию; проверка может поднять или опустить для конкретного случая */
  severity: IncidentSeverity;
  /** Есть — сторож чинит сам (только класс А) */
  fix?: FixPolicy;
  /** Класс А без починки или с починкой, которая уже идёт в другом месте: будить, если не прошло за это время */
  escalateAfterMs?: number;
  /**
   * Как закрывается: `recheck` — проверка перестала видеть; `quiet` — не повторялась столько-то (ошибка API);
   * `manual` — только человек или смена файла-источника (сверка, тесты).
   */
  close: { by: 'recheck' } | { by: 'quiet'; afterMs: number } | { by: 'manual' };
}

const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * Политика по видам — то, что в плане записано таблицей §5. Меняется здесь и только вместе с планом:
 * это заранее записанные действия, которые сторож делает ночью без человека.
 */
export const POLICY: Record<IncidentKind, KindPolicy> = {
  // Починка уже идёт в сторожe webhook (опрос ленты раз в минуту) — сторож системы только будит, если затянулось
  'webhook.suspect': {
    class: 'A',
    severity: 'WARNING',
    escalateAfterMs: 15 * MIN,
    close: { by: 'recheck' },
  },
  // Молчит сам постоянный адрес PMS: это сеть или туннель, перерегистрация запишет то же самое — к человеку
  'webhook.unreachable': {
    class: 'A',
    severity: 'CRITICAL',
    escalateAfterMs: 15 * MIN,
    close: { by: 'recheck' },
  },
  /*
   * В Channex записан НЕ постоянный адрес PMS: одноразовый туннель или чужая настройка, и события уходят мимо
   * (15.09.2026 адрес трижды за час уезжал на туннели Cloudflare, каждый умирал через минуты). Чинится тем же
   * вызовом, что кнопка «Зарегистрировать webhook». Три попытки: если адрес уводят снова и снова, дело не
   * в технике, и будить человека правильнее.
   */
  'webhook.misrouted': {
    class: 'A',
    severity: 'CRITICAL',
    escalateAfterMs: 15 * MIN,
    fix: { maxAttempts: 3, minIntervalMs: 5 * MIN },
    close: { by: 'recheck' },
  },
  'feed.stale': {
    class: 'A',
    severity: 'CRITICAL',
    fix: { maxAttempts: 3, minIntervalMs: 5 * MIN },
    close: { by: 'recheck' },
  },
  // Починка — полная выгрузка, а не повтор старой дельты (ADR-028): лимиты Channex, раз в час
  'outbox.failed': {
    class: 'A',
    severity: 'CRITICAL',
    fix: { maxAttempts: 2, minIntervalMs: HOUR },
    close: { by: 'recheck' },
  },
  'outbox.stuck': {
    class: 'A',
    severity: 'CRITICAL',
    fix: { maxAttempts: 3, minIntervalMs: 2 * MIN },
    close: { by: 'recheck' },
  },
  /*
   * Дельта остатков не встала в очередь после записанной команды (Б6): в очереди её нет, поэтому
   * `outbox.failed` и `outbox.stuck` этого не видят, а канал продаёт по старому остатку. Повторять нечем —
   * содержимое дельты нигде не сохранено, — поэтому чинится полной выгрузкой, как и упавшая отправка.
   */
  'ari.delta.lost': {
    class: 'A',
    severity: 'CRITICAL',
    fix: { maxAttempts: 2, minIntervalMs: 2 * MIN },
    close: { by: 'recheck' },
  },
  // Временная ошибка (сеть, 5xx) — повторить; отказ по правилу (ADR-024, валидация) — `event.rejected`, к человеку
  'event.failed': {
    class: 'A',
    severity: 'CRITICAL',
    fix: { maxAttempts: 3, minIntervalMs: 10 * MIN },
    close: { by: 'recheck' },
  },
  'event.rejected': { class: 'B', severity: 'CRITICAL', close: { by: 'recheck' } },
  'sync.missing': {
    class: 'A',
    severity: 'WARNING',
    fix: { maxAttempts: 2, minIntervalMs: 6 * HOUR },
    close: { by: 'recheck' },
  },
  'db.down': {
    class: 'A',
    severity: 'CRITICAL',
    escalateAfterMs: 3 * MIN,
    close: { by: 'recheck' },
  },
  'stay.overbooked': { class: 'B', severity: 'CRITICAL', close: { by: 'recheck' } },
  'stay.unassigned': { class: 'B', severity: 'WARNING', close: { by: 'recheck' } },
  'api.error': { class: 'C', severity: 'WARNING', close: { by: 'quiet', afterMs: 24 * HOUR } },
  // Закрываются, когда последний отчёт вида или последний полный прогон набора перестал быть красным
  'reconciliation.fail': { class: 'B', severity: 'WARNING', close: { by: 'recheck' } },
  'tests.failing': { class: 'C', severity: 'WARNING', close: { by: 'recheck' } },
  // Стойка не отвечает: launchd поднимает упавший процесс, но не зависший — перезапуск после 5 минут тишины
  // (сборка страниц после крупного слияния шла 5,5 минуты — 13.09.2026)
  'web.down': {
    class: 'A',
    severity: 'CRITICAL',
    fix: { maxAttempts: 2, minIntervalMs: 5 * MIN, afterMs: 5 * MIN },
    close: { by: 'recheck' },
  },
  // Канал видит мест больше, чем есть в PMS: полная выгрузка, потом пересверка; не помогло — к человеку
  'ari.oversell': {
    class: 'A',
    severity: 'CRITICAL',
    fix: { maxAttempts: 1, minIntervalMs: HOUR },
    close: { by: 'recheck' },
  },
  /*
   * Ночной копии базы нет дольше 26 часов, статуса нет или он не читается (ADR-077). Копию снимает cron на сервере;
   * прав на сервер у сторожа нет, и чинить ему нечем. Порог уже с запасом, поэтому к человеку сразу, но WARNING:
   * будит днём, а висит сутки — и ночью (STALE_AFTER_MS). Закрывается сама, когда появится свежая копия.
   */
  'backup.stale': {
    class: 'A',
    severity: 'WARNING',
    escalateAfterMs: 0,
    close: { by: 'recheck' },
  },
};

/** Что заметила проверка. Без ФИО, телефонов и секретов — только номера и коды. */
export interface Observation {
  kind: IncidentKind;
  title: string;
  subjectType?: string | null;
  subjectId?: string | null;
  /** Поднять или опустить важность конкретного случая (овербукинг сегодня — CRITICAL, завтра — WARNING) */
  severity?: IncidentSeverity;
  details?: Record<string, unknown>;
}

export interface OpenIncident {
  id: string;
  kind: IncidentKind;
  fingerprint: string;
  status: IncidentStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
  fixAttempts: number;
  lastFixAt: Date | null;
  alertedAt: Date | null;
  acknowledgedAt: Date | null;
}

export function fingerprintOf(o: Pick<Observation, 'kind' | 'subjectId'>): string {
  return o.subjectId ? `${o.kind}:${o.subjectId}` : o.kind;
}

export interface Reconciled {
  /** Записать: новые строки и повторы открытых (база по отпечатку увеличит счётчик) */
  record: Array<Observation & { fingerprint: string }>;
  /** Закрыть: id открытых неисправностей, которых больше нет */
  resolve: string[];
}

/**
 * Сверка наблюдений с открытыми неисправностями.
 * `checked` — виды, проверки которых в этом проходе ОТРАБОТАЛИ. Если проверка упала (Channex недоступен, база
 * не ответила), её неисправности не закрываются: «не увидел, потому что не смог посмотреть» ≠ «починилось».
 */
export function reconcileIncidents(input: {
  open: OpenIncident[];
  observed: Observation[];
  checked: IncidentKind[];
  now: Date;
}): Reconciled {
  const record = input.observed.map((o) => ({ ...o, fingerprint: fingerprintOf(o) }));
  const seen = new Set(record.map((o) => o.fingerprint));
  const checked = new Set(input.checked);
  const resolve: string[] = [];
  for (const inc of input.open) {
    if (seen.has(inc.fingerprint)) continue;
    const close = POLICY[inc.kind].close;
    if (close.by === 'recheck' && checked.has(inc.kind)) resolve.push(inc.id);
    if (close.by === 'quiet' && input.now.getTime() - inc.lastSeenAt.getTime() >= close.afterMs)
      resolve.push(inc.id);
  }
  return { record, resolve };
}

export type GuardAction = 'fix' | 'wait' | 'escalate' | 'none';

/**
 * Что делать с открытой неисправностью в этом проходе.
 * - уже эскалирована или принята человеком — ничего (будильник решает `alertDue`);
 * - класс Б и В — эскалировать сразу: данные чинит человек, код — дежурный агент в ветке;
 * - класс А с починкой — чинить, пока есть попытки и выдержана пауза; попытки кончились или починка
 *   выключена — эскалировать;
 * - класс А без починки — ждать `escalateAfterMs` с первого появления, потом эскалировать.
 */
export function decideAction(inc: OpenIncident, now: Date, autofix: boolean): GuardAction {
  if (inc.status === 'ESCALATED' || inc.status === 'ACKNOWLEDGED' || inc.status === 'RESOLVED')
    return 'none';
  const p = POLICY[inc.kind];
  if (p.class !== 'A') return 'escalate';
  if (p.fix) {
    if (!autofix || inc.fixAttempts >= p.fix.maxAttempts) return 'escalate';
    if (inc.fixAttempts === 0 && now.getTime() - inc.firstSeenAt.getTime() < (p.fix.afterMs ?? 0))
      return 'wait';
    if (inc.lastFixAt && now.getTime() - inc.lastFixAt.getTime() < p.fix.minIntervalMs)
      return 'wait';
    return 'fix';
  }
  const waited = now.getTime() - inc.firstSeenAt.getTime();
  return waited >= (p.escalateAfterMs ?? 0) ? 'escalate' : 'wait';
}
