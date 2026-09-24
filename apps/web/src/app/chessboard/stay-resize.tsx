'use client';
import { useRef, useState } from 'react';
import { extensionNights } from './extend-plan';

/** Pointer capture supports both mouse and touch; keyboard has the same confirmation path. */
export function StayResize({
  guest,
  lastNight,
  disabled,
  onExtend,
}: {
  guest: string;
  lastNight: string;
  disabled: boolean;
  onExtend: (nights: number) => void;
}) {
  const [nights, setNights] = useState(0);
  const selected = useRef(0);
  const active = useRef(false);
  const choose = (value: number) => {
    selected.current = value;
    setNights(value);
  };
  const finish = () => {
    const value = selected.current;
    active.current = false;
    choose(0);
    if (value) onExtend(value);
  };
  return (
    <>
      <button
        type="button"
        className="board-stay-resize"
        disabled={disabled}
        aria-label={`Продлить проживание ${guest}: перетяните вправо или выберите ночи стрелками и нажмите Enter`}
        title="Потяните вправо для продления. Стрелки → / ← и Enter — с клавиатуры"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          active.current = true;
          choose(0);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!active.current) return;
          const row = event.currentTarget.closest('tr');
          const cell = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest<HTMLTableCellElement>('td[data-date]');
          choose(
            cell && cell.closest('tr') === row
              ? extensionNights(lastNight, cell.dataset.date ?? '')
              : 0,
          );
        }}
        onPointerUp={() => {
          if (active.current) finish();
        }}
        onPointerCancel={() => {
          active.current = false;
          choose(0);
        }}
        onLostPointerCapture={() => {
          active.current = false;
          choose(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            choose(
              Math.max(0, Math.min(30, selected.current + (event.key === 'ArrowRight' ? 1 : -1))),
            );
          } else if (event.key === 'Escape') {
            active.current = false;
            choose(0);
          }
        }}
        onClick={(event) => {
          if (event.detail === 0 && selected.current) finish();
        }}
        onBlur={() => {
          if (!active.current) choose(0);
        }}
      >
        <span aria-hidden="true">Ⅱ</span>
      </button>
      {nights > 0 && (
        <span
          aria-hidden="true"
          className="board-resize-range"
          style={{ width: `${nights * 100}%` }}
        />
      )}
      {nights > 0 && (
        <span className="board-resize-preview" role="status">
          +{nights} ноч., отпустите для подтверждения
        </span>
      )}
    </>
  );
}
