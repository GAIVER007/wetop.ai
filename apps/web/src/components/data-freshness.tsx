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

/** Exely синхронизируется раз в 15 минут (ADR-032): три пропущенных прогона — уже повод посмотреть */
const EXELY_STALE_MIN = 45;
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

/** Строка «Exely 22:45 · Channex 22:41 · очередь 0» — обновляется раз в минуту, без перезагрузки страницы */
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
        'Когда данные PMS последний раз сверялись с источниками: синхронизация из Exely (раз в 15 минут), ' +
        'последнее событие из Channex и очередь изменений остатков и цен в Channex'
      }
    >
      Exely {data.exely.lastSyncAt ? time(data.exely.lastSyncAt) : 'не синхронизирован'} · Channex{' '}
      {data.channex.lastEventAt ? time(data.channex.lastEventAt) : '—'} · очередь{' '}
      {data.channex.outboxPending}
      {data.channex.outboxFailed > 0 ? `, ошибок ${data.channex.outboxFailed}` : ''}
    </span>
  );
}
