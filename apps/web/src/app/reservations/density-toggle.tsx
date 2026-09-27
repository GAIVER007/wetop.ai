'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { cx } from '../../components/ui';

const KEY = 'wetop.reservations.density';
type Density = 'normal' | 'compact';

/**
 * Плотность строк списка (ТЗ «Брони v2» §35): «Обычно» и «Компактно», выбор хранится в браузере.
 * Хранилище может быть закрыто (приватное окно) — тогда каждый раз «Обычно», список работает.
 * Таблица приходит с сервера детьми; компонент только ставит data-density и рисует переключатель.
 */
export function DensityScope({
  meta,
  showControl,
  children,
}: {
  meta: ReactNode;
  showControl: boolean;
  children: ReactNode;
}) {
  const [density, setDensity] = useState<Density>('normal');
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === 'compact') setDensity('compact');
    } catch {
      // хранилище закрыто — остаётся «Обычно»
    }
  }, []);
  const pick = (value: Density) => {
    setDensity(value);
    try {
      localStorage.setItem(KEY, value);
    } catch {
      // не сохранилось — выбор живёт до перезагрузки
    }
  };
  return (
    <div className="reservations-list" data-density={density}>
      <div className="reservations-meta-row">
        {meta}
        {showControl && (
          <div className="seg reservations-density" role="group" aria-label="Плотность строк">
            {(
              [
                ['normal', 'Обычно'],
                ['compact', 'Компактно'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cx(density === value && 'is-on')}
                aria-pressed={density === value}
                onClick={() => pick(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
