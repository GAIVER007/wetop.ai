'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../components/icon';

/**
 * Компактный поиск гостей (ТЗ «Гости v2» §6): автопоиск с задержкой вместо кнопки «Найти».
 * Обычная GET-форма: Enter и работа без JavaScript сохраняются, адрес — источник состояния (§31).
 * Меньше двух символов не ищем (как у API); стирание до пустого возвращает полный список.
 */
const DEBOUNCE_MS = 350;

export function GuestsSearch({ q, state }: { q: string; state: string }) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // переход по чипу или «Сбросить фильтры» обновляет адрес — поле догоняет его
  useEffect(() => {
    setValue(q);
  }, [q]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const navigate = (raw: string) => {
    const next = raw.trim();
    const params = new URLSearchParams({
      ...(state !== 'ALL' ? { state: state.toLowerCase() } : {}),
      ...(next ? { q: next } : {}),
    });
    const tail = params.toString();
    router.replace(`/guests${tail ? `?${tail}` : ''}`, { scroll: false });
  };
  return (
    <form method="get" role="search" className="guests-toolbar" action="/guests">
      {state !== 'ALL' && <input type="hidden" name="state" value={state.toLowerCase()} />}
      <label className="search-field">
        <Icon name="search" />
        <input
          className="inp"
          type="search"
          name="q"
          value={value}
          maxLength={120}
          aria-label="Поиск гостей"
          placeholder="Имя, телефон, email или номер брони"
          onChange={(e) => {
            const raw = e.currentTarget.value;
            setValue(raw);
            clearTimeout(timer.current);
            const ready = raw.trim().length >= 2 || raw.trim().length === 0;
            if (ready) timer.current = setTimeout(() => navigate(raw), DEBOUNCE_MS);
          }}
        />
      </label>
    </form>
  );
}
