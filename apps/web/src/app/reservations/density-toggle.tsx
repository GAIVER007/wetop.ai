'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Segmented, type SegmentOption } from '../../components/segmented';

const KEY = 'wetop.reservations.density';
type Density = 'normal' | 'compact';
const DENSITIES: ReadonlyArray<SegmentOption<Density>> = [
  { value: 'normal', label: 'Обычно' },
  { value: 'compact', label: 'Компактно' },
];

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
          <Segmented
            label="Плотность строк"
            size="sm"
            className="reservations-density"
            value={density}
            options={DENSITIES}
            onChange={pick}
          />
        )}
      </div>
      {children}
    </div>
  );
}
