'use client';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import {
  messengerLinks,
  type Chessboard,
  type ChessboardCell,
  type ChessboardRow,
} from '../../lib/api';
import { Alert } from '../../components/ui';
import { assignUnitAction } from '../reservations/actions';
import { DRAG_MIME, decodeDrag, encodeDrag, planMove, type DragPayload } from './drag-plan';

/** Из этих статусов сервер разрешает назначение ячейки (assertCanAssign); остальные клетки не тянутся. */
const DRAGGABLE = new Set(['TENTATIVE', 'CONFIRMED', 'CHECKED_IN']);

/**
 * Сетка шахматки — клиентская часть: занятую клетку можно перетащить на другую строку-ячейку.
 * Бросок → вопрос администратору → существующий server action переселения (unitCode + fromDate).
 * Отказ сервера (ячейка занята, другая категория не на всё проживание и т.п.) показывается рядом
 * с сеткой его же словами. Форма переселения на карточке брони остаётся.
 */
export function ChessboardGrid({ board }: { board: Chessboard }) {
  const [error, setError] = useState<string | null>(null);
  const [overUnit, setOverUnit] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Во время dragover браузер не даёт читать данные — держим их и в ref, чтобы подсвечивать строку
  const dragging = useRef<DragPayload | null>(null);

  const onDragStart = (payload: DragPayload) => (e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_MIME, encodeDrag(payload));
    e.dataTransfer.effectAllowed = 'move';
    dragging.current = payload;
  };
  const isOurs = (e: React.DragEvent) =>
    dragging.current !== null || e.dataTransfer.types.includes(DRAG_MIME);
  const onDragOver = (row: ChessboardRow) => (e: React.DragEvent) => {
    if (!isOurs(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overUnit !== row.unit.code) setOverUnit(row.unit.code);
  };
  const onDrop = (row: ChessboardRow) => (e: React.DragEvent) => {
    if (!isOurs(e)) return;
    e.preventDefault();
    setOverUnit(null);
    const payload = decodeDrag(e.dataTransfer.getData(DRAG_MIME)) ?? dragging.current;
    dragging.current = null;
    if (!payload) return;
    const plan = planMove(payload, { unitCode: row.unit.code });
    if (plan.kind === 'noop') return;
    if (!window.confirm(plan.confirmText)) return;
    const fd = new FormData();
    fd.set('unitCode', plan.unitCode);
    fd.set('fromDate', plan.fromDate);
    start(async () => {
      // server action сам делает revalidatePath('/chessboard') — сетка перерисуется с сервера
      const r = await assignUnitAction(payload.number, payload.itemId, { error: null }, fd);
      setError(r.error);
    });
  };
  const onDragEnd = () => {
    dragging.current = null;
    setOverUnit(null);
  };

  return (
    <>
      <div className="tbl-wrap" style={{ opacity: pending ? 0.6 : 1 }}>
        <table data-testid="chessboard" className="board">
          <thead>
            <tr>
              <th className="board__unit-head">Ячейка</th>
              {board.dates.map((d) => (
                <th key={d} data-testid="date-col">
                  <div>
                    {d.slice(8)}.{d.slice(5, 7)}
                  </div>
                  <div className="board__wd">{weekday(d)}</div>
                  <div className="board__occ" data-testid={`occupied-${d}`}>
                    {board.summary[d]!.occupied}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.rows.map((row) => (
              <tr
                key={row.unit.id}
                data-testid="unit-row"
                data-unit-code={row.unit.code}
                onDragOver={onDragOver(row)}
                onDrop={onDrop(row)}
                className={overUnit === row.unit.code ? 'is-over' : undefined}
              >
                <td className="board__unit">
                  <Link
                    href={`/units/${encodeURIComponent(row.unit.code)}`}
                    data-testid="unit-link"
                    className="mono bold"
                  >
                    {row.unit.code}
                  </Link>{' '}
                  <span className="muted-2">
                    {row.unit.kind === 'BED' ? 'койка' : 'номер'} · {row.unit.accommodationTypeName}
                  </span>
                </td>
                {row.cells.map((c) => (
                  <Cell
                    key={c.date}
                    cell={c}
                    unitCode={row.unit.code}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pending && (
        <p className="hint" data-testid="drag-pending">
          Переселяем…
        </p>
      )}
      {error && <Alert data-testid="drag-error">{error}</Alert>}
    </>
  );
}

function Cell({
  cell,
  unitCode,
  onDragStart,
  onDragEnd,
}: {
  cell: ChessboardCell;
  unitCode: string;
  onDragStart: (payload: DragPayload) => (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  // цвет клетки зависит от данных — единственный инлайн-стиль сетки; значения из токенов globals.css
  const bg =
    cell.state === 'BLOCKED'
      ? 'var(--st-blocked)'
      : cell.state === 'FREE'
        ? 'var(--surface)'
        : (STATUS_BG[cell.itemStatus ?? ''] ?? 'var(--st-confirmed)');
  const title =
    cell.state === 'OCCUPIED'
      ? `${cell.confirmationNumber} · ${cell.guestLabel} · ${cell.itemStatus}`
      : cell.state === 'BLOCKED'
        ? `блок: ${cell.blockType}`
        : '';
  const radius = `${cell.isArrival ? 8 : 0}px ${cell.isLastNight ? 8 : 0}px ${cell.isLastNight ? 8 : 0}px ${cell.isArrival ? 8 : 0}px`;
  const draggable =
    cell.state === 'OCCUPIED' &&
    !!cell.confirmationNumber &&
    !!cell.itemId &&
    DRAGGABLE.has(cell.itemStatus ?? '');
  return (
    <td className="board__cell" data-state={cell.state} data-date={cell.date} title={title}>
      {cell.state === 'OCCUPIED' ? (
        <>
          <Link
            href={`/reservations/${encodeURIComponent(cell.confirmationNumber!)}`}
            data-testid="stay-cell"
            data-number={cell.confirmationNumber}
            data-item-id={cell.itemId}
            data-date={cell.date}
            data-unit-code={unitCode}
            draggable={draggable}
            onDragStart={
              draggable
                ? onDragStart({
                    number: cell.confirmationNumber!,
                    itemId: cell.itemId!,
                    date: cell.date,
                    unitCode,
                  })
                : undefined
            }
            onDragEnd={onDragEnd}
            className="board__stay"
            style={{
              background: bg,
              borderRadius: radius,
              paddingLeft: cell.isArrival ? 6 : 2,
              cursor: draggable ? 'grab' : undefined,
            }}
          >
            {cell.isArrival ? cell.guestLabel : ''}
          </Link>
          {cell.isArrival && messengerLinks(cell.guestPhone) && (
            <a
              href={messengerLinks(cell.guestPhone)!.whatsapp}
              target="_blank"
              rel="noreferrer"
              data-testid="cell-whatsapp"
              title="Написать гостю в WhatsApp"
              className="board__wa"
            >
              💬
            </a>
          )}
        </>
      ) : (
        <div className="board__free" style={{ background: bg }} />
      )}
    </td>
  );
}

const weekday = (d: string) =>
  ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(`${d}T00:00:00Z`).getUTCDay()];
const STATUS_BG: Record<string, string> = {
  CONFIRMED: 'var(--st-confirmed)',
  CHECKED_IN: 'var(--st-checked-in)',
  CHECKED_OUT: 'var(--st-checked-out)',
  TENTATIVE: 'var(--st-tentative)',
};
