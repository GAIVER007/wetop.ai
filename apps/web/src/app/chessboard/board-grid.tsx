'use client';
import Link from 'next/link';
import { Fragment, useMemo, useRef, useState, useTransition } from 'react';
import {
  messengerLinks,
  type Chessboard,
  type ChessboardCell,
  type ChessboardRow,
} from '../../lib/api';
import { Alert, Input, Select, cx } from '../../components/ui';
import { stayLabels } from './stay-labels';
import { assignUnitAction } from '../reservations/actions';
import { DRAG_MIME, decodeDrag, encodeDrag, planMove, type DragPayload } from './drag-plan';

/** Из этих статусов сервер разрешает назначение ячейки (assertCanAssign); остальные клетки не тянутся. */
const DRAGGABLE = new Set(['TENTATIVE', 'CONFIRMED', 'CHECKED_IN']);
const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'подтверждена, ждём',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
};
const BLOCK_RU: Record<string, string> = {
  MAINTENANCE: 'ремонт',
  CLEANING: 'уборка',
  OTHER: 'блокировка',
};

/**
 * Сетка шахматки — клиентская часть.
 *
 * Что делает экран удобным (правка 12.09.2026 по замечанию владельца «шахматка должна быть максимально
 * удобная»): строки сгруппированы по категориям, у группы по каждой дате — сколько мест свободно (это
 * число продают); шапка дат и колонка ячеек прилипают при прокрутке (88 строк не влезают в экран);
 * сегодняшняя колонка выделена, выходные подсвечены; пустая клетка — ссылка «создать бронь на эту дату»;
 * занятую клетку можно перетащить на другую строку — переселение через существующий server action.
 */
export function ChessboardGrid({ board, today }: { board: Chessboard; today: string }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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

  const allGroups = groupByCategory(board.rows);
  const needle = query.trim().toLocaleLowerCase('ru');
  const rows = board.rows.filter(
    (row) =>
      (!category || row.unit.accommodationTypeCode === category) &&
      (!needle ||
        [
          row.unit.code,
          row.unit.accommodationTypeName,
          ...row.cells.flatMap((c) => [c.guestLabel, c.confirmationNumber]),
        ].some((v) => v?.toLocaleLowerCase('ru').includes(needle))),
  );
  const groups = groupByCategory(rows);
  const labels = useMemo(
    () =>
      new Map(
        board.rows.map((r) => [r.unit.id, new Map(stayLabels(r.cells).map((l) => [l.index, l]))]),
      ),
    [board.rows],
  );
  const dayWidth = board.dates.length > 14 ? 60 : 92;
  return (
    <>
      <div className="board-toolbar">
        <Input
          aria-label="Поиск на шахматке"
          placeholder="Номер, койка, гость или бронь"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          aria-label="Категория на шахматке"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Все категории</option>
          {allGroups.map((g) => (
            <option key={g.code} value={g.code}>
              {g.name}
            </option>
          ))}
        </Select>
        <span className="muted small">
          Показано {rows.length} из {board.rows.length} единиц
        </span>
        {(query || category) && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setQuery('');
              setCategory('');
            }}
          >
            Сбросить
          </button>
        )}
      </div>
      {rows.length === 0 && (
        <div className="empty-state">
          <p>По вашему запросу ничего не найдено. Измените поиск или сбросьте фильтры.</p>
        </div>
      )}
      <div className="tbl-wrap board-wrap" style={{ opacity: pending ? 0.6 : 1 }}>
        <table
          data-testid="chessboard"
          className="board"
          style={{ width: 190 + dayWidth * board.dates.length }}
        >
          <colgroup>
            <col style={{ width: 190 }} />
            {board.dates.map((date) => (
              <col key={date} style={{ width: dayWidth }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="board__unit-head">Ячейка</th>
              {board.dates.map((d) => (
                <th
                  key={d}
                  data-testid="date-col"
                  className={cx(d === today && 'is-today', isWeekend(d) && 'is-we')}
                >
                  <div className="board__d">
                    {d.slice(8)}.{d.slice(5, 7)}
                  </div>
                  <div className="board__wd">{weekday(d)}</div>
                  <div
                    className="board__occ"
                    data-testid={`occupied-${d}`}
                    title={`занято ${board.summary[d]!.occupied} из ${board.rows.length}`}
                  >
                    {board.summary[d]!.occupied}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.code}>
                {/* Строка категории: главное число смены — сколько мест ещё можно продать на эту ночь */}
                <tr data-testid="category-row" data-category={g.code} className="board__group">
                  <td className="board__unit board__group-name">
                    <button
                      type="button"
                      className="board-group-toggle"
                      aria-expanded={!collapsed.has(g.code)}
                      onClick={() =>
                        setCollapsed((old) => {
                          const next = new Set(old);
                          if (next.has(g.code)) next.delete(g.code);
                          else next.add(g.code);
                          return next;
                        })
                      }
                    >
                      <span aria-hidden="true">{collapsed.has(g.code) ? '›' : '⌄'}</span>
                      {g.name}
                      <span className="muted">{g.rows.length}</span>
                    </button>
                  </td>
                  {board.dates.map((d) => {
                    const free = board.byCategory[d]?.[g.code]?.free;
                    return (
                      <td
                        key={d}
                        className={cx(
                          'board__group-free',
                          d === today && 'is-today',
                          isWeekend(d) && 'is-we',
                          free === 0 && 'is-full',
                        )}
                        title={free === 0 ? 'мест нет' : `свободно ${free ?? '—'}`}
                      >
                        {free ?? '—'}
                      </td>
                    );
                  })}
                </tr>
                {!collapsed.has(g.code) &&
                  g.rows.map((row) => (
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
                          className="unit"
                        >
                          {row.unit.code}
                        </Link>{' '}
                        <span className="muted-2">
                          {row.unit.kind === 'BED' ? 'койка' : 'номер'}
                        </span>
                      </td>
                      {row.cells.map((c, index) => (
                        <Cell
                          key={c.date}
                          cell={c}
                          label={labels.get(row.unit.id)?.get(index)}
                          dayWidth={dayWidth}
                          unitCode={row.unit.code}
                          today={today}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                        />
                      ))}
                    </tr>
                  ))}
              </Fragment>
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
  label,
  dayWidth,
  unitCode,
  today,
  onDragStart,
  onDragEnd,
}: {
  cell: ChessboardCell;
  label: { span: number; continues: boolean } | undefined;
  dayWidth: number;
  unitCode: string;
  today: string;
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
      ? `${cell.guestLabel ?? 'без имени'} · ${cell.confirmationNumber} · ${
          STATUS_RU[cell.itemStatus ?? ''] ?? cell.itemStatus
        }`
      : cell.state === 'BLOCKED'
        ? `${BLOCK_RU[cell.blockType ?? ''] ?? cell.blockType}${
            cell.blockReason ? `: ${cell.blockReason}` : ''
          }`
        : 'Свободно — создать бронь на эту дату';
  const radius = `${cell.isArrival ? 8 : 0}px ${cell.isLastNight ? 8 : 0}px ${cell.isLastNight ? 8 : 0}px ${cell.isArrival ? 8 : 0}px`;
  const draggable =
    cell.state === 'OCCUPIED' &&
    !!cell.confirmationNumber &&
    !!cell.itemId &&
    DRAGGABLE.has(cell.itemStatus ?? '');
  return (
    <td
      className={cx(
        'board__cell',
        cell.date === today && 'is-today',
        isWeekend(cell.date) && 'is-we',
      )}
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
            className="board__stay"
            aria-label={title}
            style={{
              background: bg,
              borderRadius: radius,
              paddingLeft: cell.isArrival ? 6 : 2,
              cursor: draggable ? 'grab' : undefined,
            }}
          >
            {label && (
              <span className="board-stay-caption" style={{ width: label.span * dayWidth - 12 }}>
                {label.continues ? '← ' : ''}
                {cell.guestLabel || cell.confirmationNumber}
              </span>
            )}
          </Link>
          {cell.isArrival && messengerLinks(cell.guestPhone) && (
            <a
              href={messengerLinks(cell.guestPhone)!.whatsapp}
              target="_blank"
              rel="noreferrer"
              data-testid="cell-whatsapp"
              aria-label="Написать гостю в WhatsApp"
              title="Написать гостю в WhatsApp"
              className="board__wa"
            >
              WA
            </a>
          )}
        </>
      ) : cell.state === 'FREE' ? (
        /*
         * Пустая клетка — короткий путь «щёлкнул по дате и койке → форма брони с этими датами».
         * Из обхода по Tab исключена намеренно: таких клеток на доске больше тысячи, и они забили бы
         * клавиатурную навигацию; то же действие есть кнопкой «+ Новая бронь» в верхней навигации.
         */
        <Link
          href={`/reservations/new?arrival=${cell.date}&departure=${nextDay(cell.date)}&unit=${encodeURIComponent(unitCode)}`}
          className="board__free board__free--link"
          data-testid="free-cell"
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : (
        <Link
          href={`/units/${encodeURIComponent(unitCode)}`}
          className="board__free board-block"
          style={{ background: bg }}
          aria-label={`${title} · ${unitCode}`}
        />
      )}
    </td>
  );
}

/** Строки в порядке категорий: в Exely нумерация не сплошная, и подряд идут разные категории. */
function groupByCategory(rows: ChessboardRow[]) {
  const order: string[] = [];
  const byCode = new Map<string, { code: string; name: string; rows: ChessboardRow[] }>();
  for (const row of rows) {
    const code = row.unit.accommodationTypeCode;
    let g = byCode.get(code);
    if (!g) {
      g = { code, name: row.unit.accommodationTypeName, rows: [] };
      byCode.set(code, g);
      order.push(code);
    }
    g.rows.push(row);
  }
  return order.map((c) => byCode.get(c)!);
}

const weekday = (d: string) =>
  ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(`${d}T00:00:00Z`).getUTCDay()];
const isWeekend = (d: string) => {
  const n = new Date(`${d}T00:00:00Z`).getUTCDay();
  return n === 0 || n === 6;
};
const nextDay = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};
const STATUS_BG: Record<string, string> = {
  CONFIRMED: 'var(--st-confirmed)',
  CHECKED_IN: 'var(--st-checked-in)',
  CHECKED_OUT: 'var(--st-checked-out)',
  TENTATIVE: 'var(--st-tentative)',
};
