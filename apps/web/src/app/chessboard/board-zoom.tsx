'use client';
import { useEffect, useState } from 'react';
import { Icon } from '../../components/icon';

/**
 * Масштаб сетки «− 100% +» (образец владельца 09.10.2026). Выбор помнится в браузере; сетка читает
 * переменную `--board-zoom` с корня страницы (`zoom` на таблице в `board.css`), поэтому компонент
 * ничего не знает о самой сетке. Хранилище может быть закрыто: тогда масштаб живёт до перезагрузки.
 */
const KEY = 'wetop.chessboard.zoom';
const STEPS = [70, 80, 90, 100, 110, 120, 130] as const;

export function BoardZoom() {
  const [percent, setPercent] = useState<number>(100);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (STEPS.includes(saved as (typeof STEPS)[number])) setPercent(saved);
    } catch {
      // хранилище закрыто, остаётся 100 %
    }
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--board-zoom', String(percent / 100));
    return () => {
      root.style.removeProperty('--board-zoom');
    };
  }, [percent]);
  const move = (dir: -1 | 1) => {
    const i = STEPS.indexOf(percent as (typeof STEPS)[number]);
    const next = STEPS[Math.min(Math.max(i + dir, 0), STEPS.length - 1)]!;
    setPercent(next);
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      // не сохранилось, выбор живёт до перезагрузки
    }
  };
  return (
    <div className="board-zoom" role="group" aria-label="Масштаб календаря">
      <button
        type="button"
        className="board-zoom__btn"
        aria-label="Уменьшить масштаб"
        disabled={percent <= STEPS[0]}
        onClick={() => move(-1)}
      >
        <span aria-hidden="true" className="board-zoom__minus">
          −
        </span>
      </button>
      <output className="board-zoom__value" aria-live="polite">
        {percent}%
      </output>
      <button
        type="button"
        className="board-zoom__btn"
        aria-label="Увеличить масштаб"
        disabled={percent >= STEPS[STEPS.length - 1]!}
        onClick={() => move(1)}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
