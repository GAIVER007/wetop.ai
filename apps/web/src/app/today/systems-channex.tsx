'use client';
import { useFreshness } from '../../components/data-freshness';
import type { BadgeTone } from '../../components/ui';
import { SystemRow } from './systems-row';

/** Очередь стоит дольше — это уже не «идёт отправка», а сбой; порог тот же, что у значка свежести */
const QUEUE_STALE_MIN = 10;

const minutesSince = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));

/**
 * Строка Channex в «Системах» (A2): данные — общий опрос свежести оболочки, тот же, что значок в шапке.
 * Своего запроса нет. Пока опрос не ответил или каналы не подключены (`channex = null`) — строки нет.
 */
export function ChannexSystemRow() {
  const { data } = useFreshness();
  const c = data?.channex;
  if (!c) return null;
  let word = 'работает';
  let tone: BadgeTone = 'ok';
  if (c.outboxFailed > 0) {
    word = 'ошибки отправки';
    tone = 'warn';
  } else if (c.oldestPendingAt && minutesSince(c.oldestPendingAt) > QUEUE_STALE_MIN) {
    word = 'очередь стоит';
    tone = 'warn';
  }
  return (
    <SystemRow
      name="Channex"
      testId="systems-channex"
      href="/channels/sync"
      word={word}
      tone={tone}
      details={[
        c.lastEventAt ? `обмен ${minutesSince(c.lastEventAt)} мин назад` : 'обмена ещё не было',
        `очередь ${c.outboxPending}`,
        `ошибок ${c.outboxFailed}`,
      ]}
    />
  );
}
