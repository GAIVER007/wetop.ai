'use client';
import Link from 'next/link';
import {
  Fragment,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import { type Chessboard, type ChessboardCell, type ChessboardRow } from '../../lib/api';
import { Alert, Input, Select, cx } from '../../components/ui';
import { messengerLinks } from '../../lib/format';
import { stayLabels } from './stay-labels';
import {
  assignUnitAction,
  cancelPreviewAction,
  cancelReservationAction,
  extendStayAction,
  previewAction,
} from '../reservations/actions';
import { useRouter } from 'next/navigation';
import { ActionMenu } from '../../components/action-menu';
import { HousekeepingMenu } from './housekeeping-menu';
import { penaltyText } from '../../lib/penalty-text';
import { previewLine } from '../../lib/action-preview';
import { DRAG_MIME, decodeDrag, encodeDrag, planMove, type DragPayload } from './drag-plan';
import { Icon } from '../../components/icon';
import { AmountChip } from '../../components/amount-chip';
import { useConfirm } from '../../components/use-confirm';
import { useToast } from '../../components/toast';
import { blockTypeLabel } from '../../lib/block-types';
import { displayDate } from '../../lib/display-date';

/** Из этих статусов сервер разрешает назначение ячейки (assertCanAssign); остальные клетки не тянутся. */
const DRAGGABLE = new Set(['TENTATIVE', 'CONFIRMED', 'CHECKED_IN']);
const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'не подтверждена',
  CONFIRMED: 'подтверждена, ждём',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
};
/**
 * Уборка: на сетке называем только то, с чем надо что-то делать — «грязно». «Убрано» и «проверено»
 * на 88 строках были бы шумом, а фильтр «Уборка» показывает те же ячейки списком.
 */
const HK_DIRTY = 'DIRTY';

/** Что нужно меню плашки (C2): номер, проживание, ячейка, имя для заголовка окна и статус для доступности пунктов */
interface StayMenuPayload {
  number: string;
  itemId: string;
  unitCode: string;
  guest: string;
  status: string;
}
/** Пункты меню плашки: карточка, продление, переселение (форма карточки), отмена — те же пути, что у карточки */
function stayMenuItems(
  p: StayMenuPayload,
  onExtend: (p: StayMenuPayload) => void,
  onCancel: (p: StayMenuPayload) => void,
) {
  const card = `/reservations/${encodeURIComponent(p.number)}`;
  const live = DRAGGABLE.has(p.status);
  const expected = p.status === 'CONFIRMED' || p.status === 'TENTATIVE';
  return [
    { label: 'Открыть карточку', href: card },
    { label: 'Продлить на ночь', onSelect: () => onExtend(p), disabled: !live },
    { label: 'Переселить', href: `${card}#booking-actions`, disabled: !live },
    {
      label: 'Отменить бронь',
      onSelect: () => onCancel(p),
      tone: 'danger' as const,
      disabled: !expected,
    },
  ];
}

/**
 * Сетка шахматки — клиентская часть.
 *
 * Что делает экран удобным (правка 12.09.2026 по замечанию владельца «шахматка должна быть максимально
 * удобная»): строки сгруппированы по категориям, у группы по каждой дате — сколько мест свободно (это
 * число продают); шапка дат и колонка ячеек прилипают при прокрутке (88 строк не влезают в экран);
 * сегодняшняя колонка выделена, выходные подсвечены; пустая клетка — ссылка «создать бронь на эту дату»;
 * занятую клетку можно перетащить на другую строку — переселение через существующий server action.
 */
export function ChessboardGrid({
  board,
  today,
  fitMonth = false,
}: {
  board: Chessboard;
  today: string;
  fitMonth?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState('');
  const [state, setState] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const activeFilters = Number(!!category) + Number(!!kind) + Number(state !== 'all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [overUnit, setOverUnit] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  const { toast } = useToast();
  const fitWeek = board.dates.length === 7;
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
  const onDrop = (row: ChessboardRow) => async (e: React.DragEvent) => {
    if (!isOurs(e)) return;
    e.preventDefault();
    setOverUnit(null);
    // dataTransfer живёт только до конца обработчика — читаем до любого await
    const payload = decodeDrag(e.dataTransfer.getData(DRAG_MIME)) ?? dragging.current;
    dragging.current = null;
    if (!payload) return;
    const plan = planMove(payload, { unitCode: row.unit.code });
    if (plan.kind === 'noop') return;
    // Переселение в другую категорию переоценивает всё проживание — сумму называем до подтверждения
    // (срез 7.3, Д5): число считает API теми же функциями, что и само переселение.
    const preview = await previewAction(payload.number, payload.itemId, {
      action: 'move',
      unitCode: plan.unitCode,
    });
    if (
      !(await ask({
        title: plan.title,
        body: `${plan.detail} ${previewLine(preview)}`,
        confirmLabel: 'Переселить',
      }))
    )
      return;
    const fd = new FormData();
    fd.set('unitCode', plan.unitCode);
    fd.set('fromDate', plan.fromDate);
    start(async () => {
      // server action сам делает revalidatePath('/chessboard') — сетка перерисуется с сервера
      const r = await assignUnitAction(payload.number, payload.itemId, { error: null }, fd);
      setError(r.error);
      if (!r.error)
        toast({ text: `Бронь ${payload.number} переселена в ${plan.unitCode}`, tone: 'success' });
    });
  };
  const onDragEnd = () => {
    dragging.current = null;
    setOverUnit(null);
  };

  // C2: те же действия, что перетаскивание и карточка, — пунктами меню на плашке (DESIGN.md §12).
  // Логика не своя: предпросмотр и команда — те же server actions, что зовёт карточка брони.
  const router = useRouter();
  const extendStay = async (p: StayMenuPayload) => {
    const summary = await previewAction(p.number, p.itemId, { action: 'extend', nights: '1' });
    if (
      !(await ask({
        title: `Продлить на ночь — ${p.guest}, ${p.unitCode}?`,
        body: previewLine(summary),
        confirmLabel: 'Продлить',
      }))
    )
      return;
    start(async () => {
      const r = await extendStayAction(p.number, p.itemId, 1);
      setError(r.error);
      if (!r.error) {
        toast({ text: `Бронь ${p.number} продлена на ночь, ${p.unitCode}`, tone: 'success' });
        router.refresh();
      }
    });
  };
  const cancelStay = async (p: StayMenuPayload) => {
    const preview = await cancelPreviewAction(p.number, 'cancel');
    if (
      !(await ask({
        title: `Отменить бронь ${p.number}?`,
        body: `Место ${p.unitCode} вернётся в продажу и уйдёт в каналы. ${penaltyText(preview, 'cancel')}`,
        confirmLabel: 'Отменить бронь',
        tone: 'danger',
      }))
    )
      return;
    start(async () => {
      const r = await cancelReservationAction(p.number);
      setError(r.error);
      if (!r.error) {
        toast({ text: `Бронь ${p.number} отменена`, tone: 'success' });
        router.refresh();
      }
    });
  };

  const allGroups = groupByCategory(board.rows);
  const dirtyCount = board.rows.filter((r) => r.unit.housekeepingStatus === HK_DIRTY).length;
  const needle = query.trim().toLocaleLowerCase('ru');
  const rows = board.rows.filter(
    (row) =>
      (!category || row.unit.accommodationTypeCode === category) &&
      (!kind || row.unit.kind === kind) &&
      (state === 'all' ||
        // «Уборка» — это статус ячейки, а не блокировка: типа блокировки CLEANING в модели нет,
        // и фильтр не срабатывал никогда (DESIGN.md §9, срез 7.1)
        (state === 'cleaning'
          ? row.unit.housekeepingStatus === 'DIRTY'
          : row.cells[0]?.state === state)) &&
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
        board.rows.map((r) => [
          r.unit.id,
          new Map(
            stayLabels(r.cells).map((l) => [
              l.index,
              { ...l, lastDate: r.cells[l.index + l.span - 1]!.date },
            ]),
          ),
        ]),
      ),
    [board.rows],
  );
  const dayWidth = board.dates.length > 14 ? 64 : 104;
  return (
    <>
      <div className="board-toolbar" data-filters-open={filtersOpen}>
        <label className="board-search field field--inline">
          <span className="board-search-label">Поиск</span>
          <Input
            aria-label="Поиск на шахматке"
            placeholder="Номер, койка, гость или бронь"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn--secondary board-filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <Icon name="filter" />
          Фильтры{activeFilters > 0 ? ` · ${activeFilters}` : ''}
        </button>
        <div className="board-filter-fields" id={filtersId}>
          <label className="board-category field field--inline">
            <span>Категория</span>
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
          </label>
          <div className="seg" role="group" aria-label="Тип размещения">
            {[
              ['', 'Все места'],
              ['ROOM', 'Номера'],
              ['BED', 'Койко-места'],
            ].map(([id, label]) => (
              <button
                key={id}
                className={cx('segment-button', kind === id && 'is-on')}
                aria-pressed={kind === id}
                onClick={() => setKind(id!)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="board-state-filters"
            role="group"
            aria-label="Статус на первую дату периода"
            title={`Статус считается на ${board.from}`}
          >
            <span className="board-filter-date">Статус на {displayDate(board.from)}</span>
            {[
              ['all', 'Все'],
              ['FREE', 'Свободные'],
              ['OCCUPIED', 'Занятые'],
              // счётчик только у уборки: сколько мест ждёт уборки, видно до нажатия (21.09)
              ['cleaning', `Уборка ${dirtyCount}`],
              ['BLOCKED', 'Недоступны'],
            ].map(([id, label]) => (
              <button
                key={id}
                className={cx('filter-chip', state === id && 'is-selected')}
                aria-pressed={state === id}
                onClick={() => setState(id!)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <span
          className="muted small board-result"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          Показано {rows.length} из {board.rows.length} мест
        </span>
        {(query || category || kind || state !== 'all') && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setQuery('');
              setCategory('');
              setKind('');
              setState('all');
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
      <div
        className="tbl-wrap board-wrap"
        role="region"
        aria-label="Шахматка по дням"
        tabIndex={0}
        style={{ opacity: pending ? 0.6 : 1 }}
      >
        <table
          data-testid="chessboard"
          className={cx('board', fitMonth && 'board--month', fitWeek && 'board--week')}
          style={
            fitMonth
              ? ({
                  '--month-min-width': `calc(var(--month-unit-width) + ${24 * board.dates.length}px)`,
                } as CSSProperties)
              : fitWeek
                ? undefined
                : { width: 190 + dayWidth * board.dates.length }
          }
        >
          <colgroup>
            <col
              style={{
                width: fitMonth
                  ? 'var(--month-unit-width)'
                  : fitWeek
                    ? 'var(--week-unit-width)'
                    : 190,
              }}
            />
            {board.dates.map((date) => (
              <col key={date} style={fitMonth || fitWeek ? undefined : { width: dayWidth }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="board__unit-head">
                Номера и койки<div className="board__wd">Свободно / занято</div>
              </th>
              {board.dates.map((d) => (
                <th
                  key={d}
                  data-testid="date-col"
                  data-date={d}
                  scope="col"
                  aria-label={`${d}, ${weekday(d)}, свободно ${board.summary[d]!.free}, занято ${board.summary[d]!.occupied} из ${board.rows.length}`}
                  className={cx(d === today && 'is-today', isWeekend(d) && 'is-we')}
                >
                  <div className="board-day-date">
                    <div className="board__d">{d.slice(8)}</div>
                    <div className="board__wd">{weekday(d)}</div>
                  </div>
                  <div className="board-day-metrics">
                    <div
                      className={cx('board__free-count', board.summary[d]!.free === 0 && 'is-full')}
                      title={`свободно ${board.summary[d]!.free} на ночь ${d}`}
                    >
                      {board.summary[d]!.free === 0 ? (
                        <>
                          <span className="board__free-word">мест </span>нет
                        </>
                      ) : (
                        <>
                          <span className="board__free-word">своб. </span>
                          {board.summary[d]!.free}
                        </>
                      )}
                    </div>
                    <div
                      className="board__occ"
                      title={`занято ${board.summary[d]!.occupied} из ${board.rows.length}`}
                    >
                      <span className="board__occ-word">занято </span>
                      {/* В testid только число занятых: по нему сверяют шахматку (tests/e2e/chessboard.spec.ts) */}
                      <span data-testid={`occupied-${d}`}>{board.summary[d]!.occupied}</span>
                      <span className="board-occ-total"> / {board.rows.length}</span>
                    </div>
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
                      <span className="board-group-name-text" title={g.name}>
                        {g.name}
                      </span>
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
                          className="unit board-unit-link"
                        >
                          <Icon name={row.unit.kind === 'BED' ? 'bed' : 'inventory'} />
                          {row.unit.code}
                        </Link>{' '}
                        <span className="muted-2">
                          {row.unit.kind === 'BED' ? 'койка' : 'номер'}
                        </span>
                        {row.unit.housekeepingStatus === HK_DIRTY && (
                          <HousekeepingMenu code={row.unit.code} status={HK_DIRTY} />
                        )}
                      </td>
                      {row.cells.map((c, index) => (
                        <Cell
                          key={c.date}
                          cell={c}
                          label={labels.get(row.unit.id)?.get(index)}
                          unitCode={row.unit.code}
                          today={today}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                          onExtend={extendStay}
                          onCancel={cancelStay}
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
      {dialog}
    </>
  );
}

function Cell({
  cell,
  label,
  unitCode,
  today,
  onDragStart,
  onDragEnd,
  onExtend,
  onCancel,
}: {
  cell: ChessboardCell;
  label: { span: number; continues: boolean; lastDate: string } | undefined;
  unitCode: string;
  today: string;
  onDragStart: (payload: DragPayload) => (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onExtend: (payload: StayMenuPayload) => void;
  onCancel: (payload: StayMenuPayload) => void;
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
        }${cell.channel ? ` · ${cell.channel}` : ''}${label ? ` · ${label.continues ? 'с ранее' : cell.date} → ${nextDay(label.lastDate)} · ${nights(label.span, label.continues)}` : ''}`
      : cell.state === 'BLOCKED'
        ? `${blockTypeLabel(cell.blockType)}${cell.blockReason ? `: ${cell.blockReason}` : ''}`
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
      data-status={cell.itemStatus}
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
              backgroundColor: bg,
              borderRadius: radius,
              paddingLeft: cell.isArrival ? 6 : 2,
              cursor: draggable ? 'grab' : undefined,
            }}
          >
            {label && (
              <span
                className="board-stay-caption"
                style={{ width: `calc(${label.span * 100}% - var(--board-caption-end, 40px))` }}
              >
                {label.continues ? '← ' : ''}
                <b className="board-stay-glyph" aria-hidden="true">
                  {STATUS_GLYPH[cell.itemStatus ?? ''] ?? ''}
                </b>
                <span className="board-stay-name">
                  {cell.guestLabel || cell.confirmationNumber}
                </span>
                {/* Канал — словом: цвет на плашке уже занят статусом брони (DESIGN.md §9) */}
                {cell.channel && (
                  <span className="board-stay-channel" data-testid="cell-channel">
                    {cell.channel}
                  </span>
                )}
                {cell.balanceMinor && BigInt(cell.balanceMinor) > 0n && (
                  <AmountChip
                    minor={cell.balanceMinor}
                    tone="due"
                    className="board-stay-due"
                    data-testid="cell-due"
                  />
                )}
                {label.span >= 2 && (
                  <span className="board-stay-nights">{nights(label.span, label.continues)}</span>
                )}
              </span>
            )}
          </Link>
          {/* C2: меню действий — брат ссылки, а не её потомок: клик по плашке и перетаскивание не задеты */}
          {label && cell.confirmationNumber && cell.itemId && (
            <ActionMenu
              className="board-stay-menu"
              size="sm"
              label={`Действия: ${cell.guestLabel || cell.confirmationNumber}`}
              items={stayMenuItems(
                {
                  number: cell.confirmationNumber,
                  itemId: cell.itemId,
                  unitCode,
                  guest: cell.guestLabel || cell.confirmationNumber,
                  status: cell.itemStatus ?? '',
                },
                onExtend,
                onCancel,
              )}
              style={{ left: `calc(${label.span * 100}% - 30px)` }}
            />
          )}
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
          style={{ backgroundColor: bg }}
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
/** Статус видно и без легенды: ✓ заселён, • ждём, ? предварительная, ✕ выселен */
const STATUS_GLYPH: Record<string, string> = {
  CONFIRMED: '•',
  CHECKED_IN: '✓',
  CHECKED_OUT: '✕',
  TENTATIVE: '?',
};
/** «3 ночи» по видимому отрезку; отрезок, начавшийся до окна, помечен «+» — ночей больше */
function nights(span: number, continues: boolean): string {
  const d = span % 10;
  const h = span % 100;
  const word =
    h >= 11 && h <= 14 ? 'ночей' : d === 1 ? 'ночь' : d >= 2 && d <= 4 ? 'ночи' : 'ночей';
  return `${span}${continues ? '+' : ''} ${word}`;
}
const STATUS_BG: Record<string, string> = {
  CONFIRMED: 'var(--st-confirmed)',
  CHECKED_IN: 'var(--st-checked-in)',
  CHECKED_OUT: 'var(--st-checked-out)',
  TENTATIVE: 'var(--st-tentative)',
};
