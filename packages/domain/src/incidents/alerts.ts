/**
 * Будильник (план среза 11, §6). Решает, кого и когда будить, и собирает текст сообщения.
 * В сообщении только то, что уже есть в неисправности: заголовок без ФИО, что сторож пробовал, что делать стойке.
 */
import type { IncidentKind, IncidentSeverity, IncidentStatus } from './incidents';

export interface AlertCandidate {
  id: string;
  kind: IncidentKind;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  alertedAt: Date | null;
  acknowledgedAt: Date | null;
  fixAttempts: number;
  lastFixResult: string | null;
  /** Когда замечена впервые. Нужна для правила «висит больше суток — срочно» (см. effectiveSeverity) */
  firstSeenAt?: Date | null;
}

/** Повтор CRITICAL, пока человек не нажал «Принято» — как у дежурного пейджера */
export const REALERT_MS = 30 * 60_000;
/** Дневное окно для WARNING по часам объекта: ночью не будить тем, что терпит до утра */
export const DAY_FROM_HOUR = 9;
export const DAY_TO_HOUR = 22;
/**
 * Неисправность, открытая дольше суток, считается срочной независимо от политики вида.
 * 16–19.09.2026 туннель лежал трое суток: «адрес webhook не отвечает» будило один раз и затихало,
 * потому что каждый раз закрывалось и открывалось заново как WARNING. Залежавшееся должно будить ночью
 * и повторяться каждые 30 минут, пока человек не нажал «Принято».
 */
export const STALE_AFTER_MS = 24 * 60 * 60_000;

export function effectiveSeverity(c: AlertCandidate, now: Date): IncidentSeverity {
  if (c.severity === 'CRITICAL') return 'CRITICAL';
  if (c.firstSeenAt && now.getTime() - c.firstSeenAt.getTime() >= STALE_AFTER_MS) return 'CRITICAL';
  return c.severity;
}

function ageLabel(c: AlertCandidate, now: Date): string | null {
  if (!c.firstSeenAt) return null;
  const ms = now.getTime() - c.firstSeenAt.getTime();
  if (ms < STALE_AFTER_MS) return null;
  const days = Math.floor(ms / STALE_AFTER_MS);
  return `висит ${days} дн.`;
}

/** Telegram принимает до 4096 символов; оставляем запас на разметку клиента */
export const MAX_MESSAGE = 4000;

export function almatyHour(d: Date): number {
  return (d.getUTCHours() + 5) % 24;
}

export function alertDue(c: AlertCandidate, now: Date): boolean {
  if (c.status !== 'ESCALATED' || c.acknowledgedAt) return false;
  if (effectiveSeverity(c, now) === 'CRITICAL')
    return !c.alertedAt || now.getTime() - c.alertedAt.getTime() >= REALERT_MS;
  if (c.alertedAt) return false;
  const h = almatyHour(now);
  return h >= DAY_FROM_HOUR && h < DAY_TO_HOUR;
}

/** Что делать смене, пока чинят. Для вида без подсказки — общая строка. */
const DESK_HINT: Partial<Record<IncidentKind, string>> = {
  'stay.overbooked':
    'стойке: найти гостю место (переселить, другая категория) до заезда, при необходимости связаться с каналом',
  'stay.unassigned': 'стойке: назначить ячейку на шахматке в блоке «Без ячейки»',
  'webhook.unreachable':
    'стойке: брони с каналов доходят опросом раз в минуту с задержкой; перед заселением проверить шахматку',
  'webhook.misrouted':
    'стойке: брони с каналов доходят опросом раз в минуту с задержкой; перед заселением проверить шахматку',
  'webhook.suspect': 'стойке: брони с каналов доходят с задержкой до минуты',
  'feed.stale':
    'стойке: новые брони с каналов могут не доходить — перед заселением сверить с экстранетом канала',
  'outbox.failed':
    'стойке: канал может продавать места, которых нет; не подтверждать поздние брони без проверки шахматки',
  'outbox.stuck':
    'стойке: канал может продавать места, которых нет; не подтверждать поздние брони без проверки шахматки',
  'ari.delta.lost':
    'стойке: канал может продавать места, которых нет; не подтверждать поздние брони без проверки шахматки',
  'event.failed':
    'стойке: одна бронь канала не попала на шахматку — проверить её в экстранете канала',
  'event.rejected':
    'стойке: бронь канала отклонена правилом и не попала на шахматку — разобрать на «Каналах», проверить в экстранете',
  'db.down':
    'стойке: принимать гостей на бумажный лист заезда, внести в PMS, когда система поднимется',
  'web.down':
    'стойке: экраны PMS не открываются — заезды на бумажный лист, сторож перезапускает стойку',
  'ari.oversell':
    'стойке: канал может продать место, которого нет; не подтверждать новые брони без проверки шахматки',
};

function line(c: AlertCandidate, now: Date): string {
  const mark = effectiveSeverity(c, now) === 'CRITICAL' ? '🔴' : '🟡';
  const age = ageLabel(c, now);
  const tried =
    c.fixAttempts > 0
      ? `\n   сторож пробовал ${c.fixAttempts} раза: ${c.lastFixResult ?? 'без итога'}`
      : '';
  const hint = DESK_HINT[c.kind] ? `\n   ${DESK_HINT[c.kind]}` : '';
  return `${mark} ${c.title}${age ? ` — ${age}` : ''}${tried}${hint}`;
}

export function formatAlert(list: AlertCandidate[], now: Date): string {
  const critical = list.filter((c) => effectiveSeverity(c, now) === 'CRITICAL').length;
  const hh = String(almatyHour(now)).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const head = `PMS Luxx Aparts — сторож, ${hh}:${mm} Алматы. Неисправностей: ${list.length}${critical ? `, срочных: ${critical}` : ''}`;
  const foot = 'Экран «Неисправности» в PMS: нажмите «Принято», чтобы сторож перестал будить.';
  const body: string[] = [];
  let used = head.length + foot.length + 4;
  for (let i = 0; i < list.length; i++) {
    const l = line(list[i]!, now);
    const rest = list.length - i;
    const tail = `… и ещё ${rest}`;
    if (used + l.length + 2 > MAX_MESSAGE - tail.length - 2) {
      body.push(tail);
      break;
    }
    body.push(l);
    used += l.length + 2;
  }
  return [head, ...body, foot].join('\n\n');
}
