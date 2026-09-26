'use client';
import { createContext, createElement, use, useContext, type ReactNode } from 'react';
import { FALLBACK_TIMEZONE, propertyClock, type PropertyClock } from '../lib/property-time';

/**
 * Пояс объекта для клиентских компонентов (С-13, ТЗ аудита 25.09.2026). Макет не ждёт настроек объекта —
 * он кладёт в контекст обещание пояса (тот же запрос `/hotel/settings`, что и заголовок объекта), а
 * компонент дожидается его сам через `use`: сервер и браузер рисуют одно и то же время, гидрация не
 * расходится. Так же меню получает `deskShell()` (ADR-083).
 */
const PropertyTimezone = createContext<Promise<string> | null>(null);

export function PropertyTimeProvider({
  timezone,
  children,
}: {
  /** Никогда не отклоняется: макет сам подставляет пояс платформы, если API не ответил */
  timezone: Promise<string>;
  children: ReactNode;
}) {
  // Без JSX: модуль читают и модульные тесты, у которых нет JSX-преобразования стойки
  return createElement(PropertyTimezone.Provider, { value: timezone }, children);
}

/** Часы объекта в клиентском компоненте; вне макета (нет настроек объекта) — пояс платформы */
export function usePropertyClock(): PropertyClock {
  const timezone = useContext(PropertyTimezone);
  return propertyClock(timezone ? use(timezone) : FALLBACK_TIMEZONE);
}
