'use client';
import { useEffect, useState } from 'react';
import { cx } from './ui';

interface Freshness {
  checkedAt: string;
  exely: { lastSyncAt: string | null; mode: 'auto' | 'manual' | null };
  channex: {
    lastEventAt: string | null;
    outboxPending: number;
    outboxFailed: number;
    oldestPendingAt: string | null;
  };
}

/** Exely синхронизируется раз в 5 минут (launchd exely-sync, StartInterval 300): три пропущенных прогона — повод посмотреть */
const EXELY_STALE_MIN = 15;
/** Дельта ARI уходит за секунды; висит дольше 10 минут — канал не знает об изменении */
const QUEUE_STALE_MIN = 10;

const time = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Almaty',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
const minutesSince = (iso: string | null) =>
  iso ? (Date.now() - Date.parse(iso)) / 60_000 : Number.POSITIVE_INFINITY;

/**
 * Свежесть данных в боковой панели: три строки «источник — время», а не одна длинная фраза —
 * в узкой панели она переносилась посреди слова (DESIGN.md §14). Обновляется раз в минуту.
 */
export function DataFreshness() {
  const [data, setData] = useState<Freshness | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/freshness', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Freshness;
        if (alive) {
          setData(body);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    };
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!data)
    return failed ? (
      <span className="freshness freshness--warn" data-testid="data-freshness">
        Нет связи с API
      </span>
    ) : null;
  const exelyStale = minutesSince(data.exely.lastSyncAt) > EXELY_STALE_MIN;
  const queueStale =
    data.channex.outboxFailed > 0 ||
    (data.channex.oldestPendingAt !== null &&
      minutesSince(data.channex.oldestPendingAt) > QUEUE_STALE_MIN);
  return (
    <span
      className={cx('freshness', (exelyStale || queueStale || failed) && 'freshness--warn')}
      data-testid="data-freshness"
      title={
        'Когда данные PMS последний раз сверялись с источниками: синхронизация из Exely (раз в 5 минут), ' +
        'последнее событие из Channex и очередь изменений остатков и цен в Channex'
      }
    >
      <span className="freshness__row">
        <span className="freshness__label">Exely</span>
        <span>{data.exely.lastSyncAt ? time(data.exely.lastSyncAt) : 'не синхронизирован'}</span>
      </span>
      <span className="freshness__row">
        <span className="freshness__label">Channex</span>
        <span>{data.channex.lastEventAt ? time(data.channex.lastEventAt) : '—'}</span>
      </span>
      <span className="freshness__row">
        <span className="freshness__label">Очередь</span>
        <span>
          {data.channex.outboxPending}
          {data.channex.outboxFailed > 0 ? `, ошибок ${data.channex.outboxFailed}` : ''}
        </span>
      </span>
    </span>
  );
}
