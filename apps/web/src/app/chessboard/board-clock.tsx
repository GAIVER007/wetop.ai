'use client';

import { useEffect, useState } from 'react';

/**
 * Часы объекта в заголовке сводки дня («Сегодня, 6 октября, 17:37:58», образец Lite PMS).
 * Сервер отдаёт первое значение, браузер дальше тикает сам по поясу объекта, а не браузера.
 */
export function BoardClock({ timeZone, initial }: { timeZone: string; initial: string }) {
  const [time, setTime] = useState(initial);
  useEffect(() => {
    const format = new Intl.DateTimeFormat('ru-RU', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const tick = () => setTime(format.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeZone]);
  return <span suppressHydrationWarning>{time}</span>;
}
