'use client';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import {
  messengerLinks,
  type Chessboard,
  type ChessboardCell,
  type ChessboardRow,
} from '../../lib/api';
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
      <div
        style={{
          overflowX: 'auto',
          background: '#fff',
          border: '1px solid #e3e5e8',
          borderRadius: 8,
          opacity: pending ? 0.6 : 1,
        }}
      >
        <table
          data-testid="chessboard"
          style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, minWidth: 700 }}
        >
          <thead>
            <tr>
              <th
                style={{
                  ...th,
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  background: '#f9fafb',
                  minWidth: 190,
                  textAlign: 'left',
                }}
              >
                Ячейка
              </th>
              {board.dates.map((d) => (
                <th key={d} style={th} data-testid="date-col">
                  <div>
                    {d.slice(8)}.{d.slice(5, 7)}
                  </div>
                  <div style={{ fontWeight: 400, color: '#888' }}>{weekday(d)}</div>
                  <div data-testid={`occupied-${d}`} style={{ fontWeight: 600, color: '#111' }}>
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
                style={overUnit === row.unit.code ? { background: '#dbeafe' } : undefined}
              >
                <td
                  style={{
                    ...td,
                    position: 'sticky',
                    left: 0,
                    background: overUnit === row.unit.code ? '#dbeafe' : '#fff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Link
                    href={`/units/${encodeURIComponent(row.unit.code)}`}
                    data-testid="unit-link"
                    style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}
                  >
                    {row.unit.code}
                  </Link>
                  <span style={{ color: '#777', marginLeft: 8 }}>
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
        <p style={{ color: '#555', fontSize: 12, marginTop: 8 }} data-testid="drag-pending">
          Переселяем…
        </p>
      )}
      {error && (
        <div
          role="alert"
          data-testid="drag-error"
          style={{ color: '#b91c1c', fontSize: 13, marginTop: 8 }}
        >
          {error}
        </div>
      )}
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
  const bg =
    cell.state === 'BLOCKED'
      ? '#fecaca'
      : cell.state === 'FREE'
        ? '#fff'
        : (STATUS_BG[cell.itemStatus ?? ''] ?? '#dbeafe');
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
    <td
      style={{ ...td, padding: 2, minWidth: 44, position: 'relative' }}
      data-state={cell.state}
      data-date={cell.date}
      title={title}
    >
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
            style={{
              display: 'block',
              background: bg,
              borderRadius: radius,
              height: 22,
              lineHeight: '22px',
              paddingLeft: cell.isArrival ? 6 : 2,
              color: '#111',
              textDecoration: 'none',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              fontSize: 11,
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
              style={{ position: 'absolute', right: 2, top: 3, fontSize: 10, lineHeight: '10px' }}
            >
              💬
            </a>
          )}
        </>
      ) : (
        <div style={{ background: bg, height: 22, borderRadius: 4 }} />
      )}
    </td>
  );
}

const weekday = (d: string) =>
  ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(`${d}T00:00:00Z`).getUTCDay()];
const STATUS_BG: Record<string, string> = {
  CONFIRMED: '#dbeafe',
  CHECKED_IN: '#bbf7d0',
  CHECKED_OUT: '#e5e7eb',
  TENTATIVE: '#fde68a',
};
const th: React.CSSProperties = {
  padding: '6px 4px',
  borderBottom: '1px solid #e3e5e8',
  fontSize: 11,
  color: '#555',
  textAlign: 'center',
  background: '#f9fafb',
};
const td: React.CSSProperties = { padding: '3px 6px', borderBottom: '1px solid #f0f1f3' };
