import Link from 'next/link';
import type { ReactNode } from 'react';
import { getJsonPublic, guardApi, sellerApi, type GuardStatus, type SellerStatus } from '../../lib/api';
import { Badge, Panel, type BadgeTone } from '../../components/ui';

/** Что стойка знает об обмене с Channex — те же поля, что читает значок свежести в шапке */
interface Freshness {
  channex: {
    lastEventAt: string | null;
    outboxPending: number;
    outboxFailed: number;
    oldestPendingAt: string | null;
  } | null;
}

/** Очередь стоит дольше — это уже не «идёт отправка», а сбой; порог тот же, что у значка свежести */
const QUEUE_STALE_MIN = 10;

const minutesSince = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));

/** Строка, которая не ответила или закрыта для роли, просто не рисуется: остальные на месте */
const quiet = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

/**
 * Системы (A2, план `plans/today-a2-2026-09-28.md` §3.5): по строке на систему, состояние словом.
 * Подробности — в разделах по ссылкам. Строки «Сайт» нет: данных о здоровье сайта у стойки нет (пробел плана).
 */
export async function SystemsToday() {
  const [freshness, seller, guard] = await Promise.all([
    quiet(getJsonPublic<Freshness>('/system/freshness')),
    quiet(sellerApi.status()),
    quiet(guardApi.status()),
  ]);
  const channex = freshness?.channex ?? null;
  return (
    <Panel title="Системы" aria-label="Системы" className="fund-panel">
      <ul className="systems-list">
        {channex && (
          <SystemRow
            name="Channex"
            testId="systems-channex"
            href="/channels/sync"
            {...channexState(channex)}
            details={[
              channex.lastEventAt
                ? `обмен ${minutesSince(channex.lastEventAt)} мин назад`
                : 'обмена ещё не было',
              `очередь ${channex.outboxPending}`,
              `ошибок ${channex.outboxFailed}`,
            ]}
          />
        )}
        {seller && (
          <SystemRow name="ИИ-продавец" testId="systems-seller" href="/ai-seller" {...sellerState(seller)} />
        )}
        {guard && (
          <SystemRow
            name="Копии базы и сторож"
            testId="systems-guard"
            {...guardState(guard)}
            details={[
              guard.lastTick?.checked.includes('backup.stale')
                ? 'копии под наблюдением сторожа'
                : 'проверка копий не настроена',
              <Link key="incidents" href="/incidents">
                открытых инцидентов: {guard.open.total}
              </Link>,
            ]}
          />
        )}
      </ul>
      {!channex && !seller && !guard && (
        <p className="fund-note" data-testid="systems-empty">
          Состояние систем сейчас не получено.
        </p>
      )}
    </Panel>
  );
}

function channexState(c: NonNullable<Freshness['channex']>): { word: string; tone: BadgeTone } {
  if (c.outboxFailed > 0) return { word: 'ошибки отправки', tone: 'warn' };
  if (c.oldestPendingAt && minutesSince(c.oldestPendingAt) > QUEUE_STALE_MIN)
    return { word: 'очередь стоит', tone: 'warn' };
  return { word: 'работает', tone: 'ok' };
}

function sellerState(s: SellerStatus): { word: string; tone: BadgeTone } {
  if (s.state === 'extension-off') return { word: 'расширение не подключено', tone: 'neutral' };
  if (s.state === 'extension-expired') return { word: 'срок расширения вышел', tone: 'warn' };
  if (s.state === 'not-configured') return { word: 'не подключён', tone: 'neutral' };
  if (s.lastError) return { word: 'ошибка', tone: 'warn' };
  return { word: 'работает', tone: 'ok' };
}

function guardState(g: GuardStatus): { word: string; tone: BadgeTone } {
  if (!g.running) return { word: 'сторож не запущен', tone: 'warn' };
  if (g.open.critical > 0) return { word: 'есть критичные', tone: 'warn' };
  return { word: 'работает', tone: 'ok' };
}

function SystemRow({
  name,
  word,
  tone,
  details = [],
  testId,
  href,
}: {
  name: string;
  word: string;
  tone: BadgeTone;
  details?: ReactNode[];
  testId: string;
  href?: string;
}) {
  return (
    <li className="systems-row" data-testid={testId}>
      <span className="systems-row__head">
        {href ? (
          <Link className="systems-row__name" href={href}>
            {name}
          </Link>
        ) : (
          <span className="systems-row__name">{name}</span>
        )}
        <Badge tone={tone}>{word}</Badge>
      </span>
      {details.length > 0 && (
        <span className="systems-row__details">
          {details.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </span>
      )}
    </li>
  );
}
