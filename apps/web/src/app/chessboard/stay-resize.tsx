'use client';
import { useEffect, useRef, useState } from 'react';
import type { ExtendPreview } from '../../lib/api';
import { extendPreviewAction } from '../reservations/actions';
import { extendLabel, extensionConflict, extensionNights } from './extend-plan';

/** Клетки строки брони: по ним конфликт виден до отпускания (ТЗ v2 §29) */
type RowCells = Parameters<typeof extensionConflict>[0];

/**
 * Pointer capture supports both mouse and touch; keyboard has the same confirmation path.
 *
 * ТЗ v2 §29: во время продления подпись говорит, до какой даты, сколько ночей и сколько денег
 * («До 27 сент., +3 ночи, +75 000 ₸»); сумма — предпросмотр продления API на выбранное число ночей,
 * по одному запросу на число (кэш), а не на каждое движение мыши. Поверх чужой брони или блокировки
 * продлить нельзя: конфликт виден до отпускания, после отпускания команда не уходит, а стойка видит
 * причину словами (§54).
 */
export function StayResize({
  number,
  itemId,
  unitCode,
  guest,
  lastNight,
  cells,
  disabled,
  onExtend,
  onRefuse,
}: {
  number: string;
  itemId: string;
  unitCode: string;
  guest: string;
  lastNight: string;
  cells: RowCells;
  disabled: boolean;
  onExtend: (nights: number) => void;
  onRefuse: (message: string) => void;
}) {
  const [nights, setNights] = useState(0);
  const selected = useRef(0);
  const active = useRef(false);
  // Ответы предпросмотра по числу ночей: повторное наведение на ту же дату запроса не шлёт
  const prices = useRef(new Map<number, ExtendPreview | null>());
  const [, setLoaded] = useState(0);
  const choose = (value: number) => {
    selected.current = value;
    setNights(value);
  };
  /** Своя клетка сетки или ответ сервера (ночи за краем окна, гонка с другим администратором) */
  const conflictFor = (value: number): string | null => {
    const local = extensionConflict(cells, lastNight, value, itemId);
    if (local) return local;
    const server = prices.current.get(value);
    return server && !server.nextNightsFree ? 'Занято на новые ночи' : null;
  };
  const finish = () => {
    const value = selected.current;
    active.current = false;
    choose(0);
    if (!value) return;
    const conflict = conflictFor(value);
    if (conflict) {
      const why = conflict.charAt(0).toLowerCase() + conflict.slice(1);
      onRefuse(
        `Не удалось продлить проживание: место ${unitCode} ${why}. Выберите меньше ночей или переселите гостя.`,
      );
      return;
    }
    onExtend(value);
  };

  useEffect(() => {
    if (
      !nights ||
      prices.current.has(nights) ||
      extensionConflict(cells, lastNight, nights, itemId)
    )
      return;
    const asked = nights;
    const timer = setTimeout(() => {
      void extendPreviewAction(number, itemId, undefined, asked).then((p) => {
        prices.current.set(asked, p);
        setLoaded((n) => n + 1);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [nights, number, itemId, cells, lastNight]);

  const conflict = nights > 0 ? conflictFor(nights) : null;
  const price = prices.current.get(nights);
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
          data-conflict={conflict ? 'true' : undefined}
          style={{ width: `${nights * 100}%` }}
        />
      )}
      {nights > 0 && (
        <span
          className="board-resize-preview"
          data-conflict={conflict ? 'true' : undefined}
          role="status"
        >
          {conflict
            ? `${conflict} — продлить нельзя`
            : extendLabel(
                lastNight,
                nights,
                price?.addedMinor ? { addedMinor: price.addedMinor, currency: 'KZT' } : undefined,
              )}
        </span>
      )}
    </>
  );
}
