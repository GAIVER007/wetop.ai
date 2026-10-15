'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePropertyClock } from './property-time';
import { cx } from './ui';

interface Freshness {
  checkedAt: string;
  channex: {
    lastEventAt: string | null;
    outboxPending: number;
    outboxFailed: number;
    oldestPendingAt: string | null;
  } | null;
}

/** Дельта ARI уходит за секунды; висит дольше 10 минут — канал не знает об изменении */
const QUEUE_STALE_MIN = 10;

const minutesSince = (iso: string | null) =>
  iso ? (Date.now() - Date.parse(iso)) / 60_000 : Number.POSITIVE_INFINITY;

const FreshnessContext = createContext<{ data: Freshness | null; failed: boolean }>({
  data: null,
  failed: false,
});

/** Один опрос на оболочку, включая открытое мобильное меню. Не переживает выход из приложения. */
export function DataFreshnessProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [data, setData] = useState<Freshness | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const res = await fetch('/api/freshness', { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Freshness;
        if (alive) {
          setData(body);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      } finally {
        // Медленный ответ не должен создавать очередь одинаковых запросов.
        if (alive) timer = setTimeout(load, 60_000);
      }
    };
    void load();
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled]);

  return (
    <FreshnessContext.Provider value={{ data: enabled ? data : null, failed: enabled && failed }}>
      {children}
    </FreshnessContext.Provider>
  );
}

/**
 * Тот же результат для блоков страницы (строка Channex в «Системах» Главной, A2): свой запрос к
 * `/system/freshness` стоил бы рейс сверх бюджета экрана (`tests/ui/requests.spec.ts`).
 */
export function useFreshness() {
  return useContext(FreshnessContext);
}

/** Строка состояния читает общий результат, не заводя собственный таймер. */
export function DataFreshness() {
  const { data, failed } = useContext(FreshnessContext);
  // Время последнего события — по часам объекта (С-13), а не по зашитому поясу
  const clock = usePropertyClock();

  if (!data)
    return failed ? (
      <span className="freshness freshness--warn" data-testid="data-freshness">
        Нет связи с API
      </span>
    ) : null;
  // каналы у гостиницы не подключены — строки о Channex нет (план tenant-isolation-2026-09-26 п. 5)
  if (!data.channex) return null;
  const queueStale =
    data.channex.outboxFailed > 0 ||
    (data.channex.oldestPendingAt !== null &&
      minutesSince(data.channex.oldestPendingAt) > QUEUE_STALE_MIN);
  return (
    <span
      className={cx('freshness', (queueStale || failed) && 'freshness--warn')}
      data-testid="data-freshness"
      title={'Последнее событие из менеджера каналов и очередь изменений остатков и цен'}
    >
      Каналы {data.channex.lastEventAt ? clock.clock(data.channex.lastEventAt) : '—'} · очередь{' '}
      {data.channex.outboxPending}
      {data.channex.outboxFailed > 0 ? `, ошибок ${data.channex.outboxFailed}` : ''}
    </span>
  );
}
