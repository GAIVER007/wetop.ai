'use client';
import Link from 'next/link';
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import {
  messengerLinks,
  type Chessboard,
  type ChessboardCell,
  type ChessboardRow,
  type HousekeepingState,
} from '../../lib/api';
import { Alert, Badge, Input, Select, cx, type BadgeTone } from '../../components/ui';
import { AmountBadge } from '../../components/amount-badge';
import { ActionMenu } from '../../components/action-menu';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { ToastProvider, useToast } from '../../components/toast';
import { Icon } from '../../components/icon';
import { stayLabels } from './stay-labels';
import { STAY_STATUS, sourceBadge } from './stay-status';
import {
  assignUnitAction,
  cancelReservationAction,
  extendStayAction,
  cancelPreviewAction,
} from '../reservations/actions';
import { DRAG_MIME, decodeDrag, encodeDrag, planMove, type DragPayload } from './drag-plan';
import { displayDay, displayPeriod } from '../../lib/display-date';
import { penaltyText } from '../../lib/penalty-text';
import type { CancelPreview } from '../../lib/api';

/** Из этих статусов сервер разрешает назначение ячейки (assertCanAssign); остальные клетки не тянутся. */
const DRAGGABLE = new Set(['TENTATIVE', 'CONFIRMED', 'CHECKED_IN']);
const BLOCK_RU: Record<string, string> = {
  MAINTENANCE: 'ремонт',
  CLEANING: 'уборка',
  OTHER: 'блокировка',
};
/** Статус уборки ячейки словом (DESIGN.md §9) */
const HOUSEKEEPING: Record<HousekeepingState, { word: string; tone: BadgeTone }> = {
  DIRTY: { word: 'грязно', tone: 'warn' },
  CLEAN: { word: 'убрано', tone: 'ok' },
  INSPECTED: { word: 'проверено', tone: 'info' },
};
/** Бейдж канала на полосе — от трёх ночей (решение владельца 15.09.2026, развилка 7.1-1) */
const CHANNEL_BADGE_FROM_NIGHTS = 3;
/** Плашка «к оплате» на полосе — от двух ночей, на одной ночи она вытеснила бы имя */
const AMOUNT_BADGE_FROM_NIGHTS = 2;

interface StayRef {
  number: string;
  itemId: string;
  unitCode: string;
  categoryCode: string;
  guestLabel: string;
  status: string;
  /** первая и последняя видимая ночь на доске */
  firstDate: string;
  lastDate: string;
  isArrival: boolean;
  isLastNight: boolean;
}
type Pending =
  | { kind: 'drop'; payload: DragPayload; unitCode: string; fromDate: string }
  | { kind: 'move'; stay: StayRef; options: string[]; unitCode: string }
  | { kind: 'cancel'; stay: StayRef; penalty?: CancelPreview | null | undefined };

/**
 * Сетка шахматки — клиентская часть (срез 7.1 по макету, DESIGN.md §8, §9).
 *
 * Строки сгруппированы по категориям, у группы по каждой дате — сколько мест свободно (это число продают);
 * шапка дат и колонка ячеек прилипают при прокрутке; сегодняшняя колонка выделена, выходные нейтральны.
 * Полоса брони начинается с середины клетки заезда и кончается на середине клетки выезда, несёт значок и
 * слово статуса, бейдж канала (от трёх ночей) и плашку «к оплате» (от двух). Пустая клетка — ссылка «создать
 * бронь на эту дату». Занятую клетку можно перетащить на другую строку или выбрать «Переселить» в меню
 * действий; подтверждение — окном с последствием, не `window.confirm`.
 */
export function ChessboardGrid(props: { board: Chessboard; today: string; fitMonth?: boolean }) {
  return (
    <ToastProvider>
      <Grid {...props} />
    </ToastProvider>
  );
}

function Grid({
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [overUnit, setOverUnit] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const toast = useToast();
  const fitWeek = board.dates.length === 7;
  // На узком экране (телефон, планшет вертикально) клетка уже 80 px: хвост полосы с меню и WhatsApp
  // не помещается рядом с целью нажатия ≥ 24 px (DESIGN.md §11) — действия остаются в карточке брони.
  const narrow = useNarrowScreen();
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
    setPendingAction({ kind: 'drop', payload, unitCode: plan.unitCode, fromDate: plan.fromDate });
  };
  const onDragEnd = () => {
    dragging.current = null;
    setOverUnit(null);
  };

  /** Переселение — тот же server action, что и у перетаскивания; сетка перерисуется с сервера */
  const move = (number: string, itemId: string, unitCode: string, fromDate: string) => {
    const fd = new FormData();
    fd.set('unitCode', unitCode);
    fd.set('fromDate', fromDate);
    setBusy('Переселяю…');
    start(async () => {
      const r = await assignUnitAction(number, itemId, { error: null }, fd);
      setBusy(null);
      if (r.error) {
        setError(r.error);
        return;
      }
      setError(null);
      setPendingAction(null);
      toast.push({
        tone: 'ok',
        text: `Бронь ${number} переселена в ${unitCode}`,
        action: { label: 'Открыть бронь', href: `/reservations/${number}` },
      });
    });
  };
  const extend = (stay: StayRef) => {
    setBusy('Продлеваю…');
    start(async () => {
      const r = await extendStayAction(stay.number, stay.itemId, 1);
      setBusy(null);
      if (r.error) {
        // Б8: у брони из Exely тарифа нет, и API просит его явно — выбрать тариф можно только на карточке
        const needsPlan = r.error.includes('ratePlanCode');
        toast.push({
          tone: 'danger',
          text: needsPlan
            ? `Бронь ${stay.number} перенесена из Exely без тарифа: выберите тариф на карточке и продлите там`
            : `Не удалось продлить: ${r.error}`,
          action: { label: 'Открыть бронь', href: `/reservations/${stay.number}` },
        });
        return;
      }
      const until = stay.isLastNight
        ? ` до ${displayDay(nextDay(nextDay(stay.lastDate)))}`
        : ' на ночь';
      toast.push({
        tone: 'ok',
        text: `Проживание продлено${until}`,
        action: { label: 'Открыть бронь', href: `/reservations/${stay.number}` },
      });
    });
  };
  const cancel = (stay: StayRef) => {
    setBusy('Отменяю…');
    start(async () => {
      const r = await cancelReservationAction(stay.number);
      setBusy(null);
      if (r.error) {
        setError(r.error);
        return;
      }
      setError(null);
      setPendingAction(null);
      toast.push({ tone: 'ok', text: `Бронь ${stay.number} отменена, место вернулось в продажу` });
    });
  };
  /**
   * Сколько проживаний этой брони видно на доске: команда отмены отменяет бронь целиком,
   * а у групповой брони на одном номере до 36 проживаний — окно обязано сказать об этом.
   */
  const staysOfReservation = (number: string) =>
    new Set(
      board.rows.flatMap((r) =>
        r.cells.filter((c) => c.confirmationNumber === number && c.itemId).map((c) => c.itemId!),
      ),
    ).size;
  /** Свободные ячейки той же категории на все видимые ночи проживания — варианты для «Переселить» */
  const freeUnitsFor = (stay: StayRef) => {
    const from = board.dates.indexOf(stay.firstDate);
    const to = board.dates.indexOf(stay.lastDate);
    return board.rows
      .filter(
        (r) =>
          r.unit.accommodationTypeCode === stay.categoryCode &&
          r.unit.code !== stay.unitCode &&
          r.cells.slice(from, to + 1).every((c) => c.state === 'FREE'),
      )
      .map((r) => r.unit.code);
  };
  const openMove = (stay: StayRef) => {
    const options = freeUnitsFor(stay);
    setError(null);
    setPendingAction({ kind: 'move', stay, options, unitCode: options[0] ?? '' });
  };

  const allGroups = groupByCategory(board.rows);
  const needle = query.trim().toLocaleLowerCase('ru');
  const rows = board.rows.filter(
    (row) =>
      (!category || row.unit.accommodationTypeCode === category) &&
      (!kind || row.unit.kind === kind) &&
      (state === 'all' ||
        (state === 'cleaning'
          ? row.unit.housekeeping === 'DIRTY'
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
        board.rows.map((r) => [r.unit.id, new Map(stayLabels(r.cells).map((l) => [l.index, l]))]),
      ),
    [board.rows],
  );
  /** Ширина хвоста полосы (меню «⋯», WhatsApp) — на последней видимой клетке отрезок кончается перед ним */
  const tailOf = (row: ChessboardRow, first: ChessboardCell) => {
    if (fitMonth || narrow) return 0;
    const menu = DRAGGABLE.has(first.itemStatus ?? '') ? 32 : 0;
    const wa = first.isArrival && messengerLinks(first.guestPhone) ? 24 : 0;
    return menu + wa;
  };
  const tails = useMemo(() => {
    const out = new Map<string, Map<number, number>>();
    for (const r of board.rows) {
      const m = new Map<number, number>();
      for (const l of stayLabels(r.cells))
        m.set(l.index + l.span - 1, tailOf(r, r.cells[l.index]!));
      out.set(r.unit.id, m);
    }
    return out;
  }, [board.rows, fitMonth, narrow]);
  const dayWidth = board.dates.length > 14 ? 64 : 104;
  const stayRef = (row: ChessboardRow, index: number, span: number): StayRef => {
    const first = row.cells[index]!;
    const last = row.cells[index + span - 1]!;
    return {
      number: first.confirmationNumber!,
      itemId: first.itemId!,
      unitCode: row.unit.code,
      categoryCode: row.unit.accommodationTypeCode,
      guestLabel: first.guestLabel || first.confirmationNumber!,
      status: first.itemStatus ?? '',
      firstDate: first.date,
      lastDate: last.date,
      isArrival: !!first.isArrival,
      isLastNight: !!last.isLastNight,
    };
  };
  return (
    <>
      <div className="board-filters-row">
        <div className="seg" aria-label="Тип размещения">
          {[
            ['', 'Все единицы'],
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
        <div className="board-state-filters" aria-label="Статус на первую дату периода">
          {[
            ['all', 'Все'],
            ['FREE', 'Свободные'],
            ['OCCUPIED', 'Занятые'],
            ['cleaning', 'Уборка'],
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
        className={cx('tbl-wrap board-wrap', isPending && 'is-busy')}
        role="region"
        aria-label="Шахматка по дням"
        aria-busy={isPending || undefined}
        tabIndex={0}
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
                Номер / койка<div className="board__wd">свободно по дням</div>
              </th>
              {board.dates.map((d) => {
                const free = board.summary[d]!.free;
                return (
                  <th
                    key={d}
                    data-testid="date-col"
                    data-date={d}
                    scope="col"
                    aria-label={`${displayDay(d)}, ${weekday(d)}${d === today ? ', сегодня' : ''}, свободно ${free} из ${board.rows.length}`}
                    className={cx(d === today && 'is-today')}
                  >
                    <div className="board__d">{d.slice(8)}</div>
                    <div className="board__wd">{weekday(d)}</div>
                    {d === today && <div className="board__today-word">сегодня</div>}
                    <div className="board__occ">
                      {/* В testid — число свободных: по нему сверяют шахматку (tests/e2e/chessboard.spec.ts) */}
                      <span data-testid={`free-${d}`}>{free}</span>
                      <span className="board-occ-total"> / {board.rows.length}</span>
                    </div>
                  </th>
                );
              })}
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
                      <Icon
                        name={collapsed.has(g.code) ? 'chevron' : 'down'}
                        width={16}
                        height={16}
                      />
                      <span className="board-group-name-text">{g.name}</span>
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
                          free === 0 && 'is-full',
                        )}
                        aria-label={free === 0 ? 'мест нет' : `свободно ${free ?? '—'}`}
                      >
                        {free === 0 ? (
                          <>
                            0 <span className="board__full-word">нет</span>
                          </>
                        ) : (
                          (free ?? '—')
                        )}
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
                          <Icon
                            name={row.unit.kind === 'BED' ? 'bed' : 'inventory'}
                            width={16}
                            height={16}
                          />
                          {row.unit.code}
                        </Link>{' '}
                        <span className="muted-2">
                          {row.unit.kind === 'BED' ? 'койка' : 'номер'}
                        </span>
                        {row.unit.housekeeping && (
                          <Badge
                            tone={HOUSEKEEPING[row.unit.housekeeping].tone}
                            className="board__hk"
                            data-testid="housekeeping-badge"
                            data-status={row.unit.housekeeping}
                          >
                            {HOUSEKEEPING[row.unit.housekeeping].word}
                          </Badge>
                        )}
                      </td>
                      {row.cells.map((c, index) => {
                        const label = labels.get(row.unit.id)?.get(index);
                        return (
                          <Cell
                            key={c.date}
                            cell={c}
                            label={label}
                            tail={label ? tailOf(row, c) : 0}
                            tailAtEnd={tails.get(row.unit.id)?.get(index) ?? 0}
                            row={row}
                            index={index}
                            today={today}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            actions={
                              label && !fitMonth && !narrow && DRAGGABLE.has(c.itemStatus ?? '')
                                ? {
                                    move: () => openMove(stayRef(row, index, label.span)),
                                    extend: () => extend(stayRef(row, index, label.span)),
                                    cancel: () => {
                                      setError(null);
                                      const stay = stayRef(row, index, label.span);
                                      setPendingAction({
                                        kind: 'cancel',
                                        stay,
                                        penalty: undefined,
                                      });
                                      // Д5: штраф считает сервер тем же кодом, что и начисление
                                      void cancelPreviewAction(stay.number, 'cancel').then((r) =>
                                        setPendingAction((p) =>
                                          p?.kind === 'cancel' && p.stay.number === stay.number
                                            ? { ...p, penalty: r.preview }
                                            : p,
                                        ),
                                      );
                                    },
                                  }
                                : undefined
                            }
                          />
                        );
                      })}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {isPending && (
        <p className="hint" data-testid="drag-pending" role="status">
          {busy ?? 'Обновляем шахматку…'}
        </p>
      )}
      {error && !pendingAction && <Alert data-testid="drag-error">{error}</Alert>}

      {/* Переселение перетаскиванием: вопрос с номером брони и ячейкой (окно вместо window.confirm) */}
      <ConfirmDialog
        open={pendingAction?.kind === 'drop'}
        title={
          pendingAction?.kind === 'drop'
            ? `Переселить бронь ${pendingAction.payload.number} в ${pendingAction.unitCode}?`
            : ''
        }
        consequence={
          pendingAction?.kind === 'drop'
            ? `С ${displayDay(pendingAction.fromDate)} проживание займёт ячейку ${pendingAction.unitCode}; ячейка ${pendingAction.payload.unitCode} освободится.`
            : undefined
        }
        confirmLabel="Переселить"
        pending={busy ?? undefined}
        error={error}
        onConfirm={() =>
          pendingAction?.kind === 'drop' &&
          move(
            pendingAction.payload.number,
            pendingAction.payload.itemId,
            pendingAction.unitCode,
            pendingAction.fromDate,
          )
        }
        onCancel={() => {
          setPendingAction(null);
          setError(null);
        }}
      >
        {pendingAction?.kind === 'drop' && (
          <p>
            Другая категория — только на всё проживание, с пересчётом по её тарифу. Внутри категории
            цена не меняется.
          </p>
        )}
      </ConfirmDialog>

      {/* «Переселить» из меню: выбор свободной ячейки той же категории на видимые ночи */}
      <ConfirmDialog
        open={pendingAction?.kind === 'move'}
        title={
          pendingAction?.kind === 'move' ? `Переселить бронь ${pendingAction.stay.number}?` : ''
        }
        consequence={
          pendingAction?.kind === 'move' && pendingAction.options.length
            ? `С ${displayDay(pendingAction.stay.firstDate)} проживание займёт выбранную ячейку; ${pendingAction.stay.unitCode} освободится. Цена не меняется — та же категория.`
            : undefined
        }
        confirmLabel="Переселить"
        pending={busy ?? undefined}
        error={error}
        onConfirm={() =>
          pendingAction?.kind === 'move' &&
          pendingAction.unitCode &&
          move(
            pendingAction.stay.number,
            pendingAction.stay.itemId,
            pendingAction.unitCode,
            pendingAction.stay.firstDate,
          )
        }
        onCancel={() => {
          setPendingAction(null);
          setError(null);
        }}
      >
        {pendingAction?.kind === 'move' &&
          (pendingAction.options.length ? (
            <label className="field">
              Куда — свободно на{' '}
              {displayPeriod(pendingAction.stay.firstDate, nextDay(pendingAction.stay.lastDate))}
              <Select
                data-testid="move-target"
                value={pendingAction.unitCode}
                onChange={(e) => setPendingAction({ ...pendingAction, unitCode: e.target.value })}
              >
                {pendingAction.options.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <p>
              В этой категории нет ячейки, свободной на все ночи{' '}
              {displayPeriod(pendingAction.stay.firstDate, nextDay(pendingAction.stay.lastDate))}.
              Переселение в другую категорию — с карточки брони.
            </p>
          ))}
      </ConfirmDialog>

      {/* Отмена: вопрос с объектом, последствие отдельной строкой, штраф из предпросмотра (Д5) */}
      <ConfirmDialog
        open={pendingAction?.kind === 'cancel'}
        title={
          pendingAction?.kind === 'cancel' ? `Отменить бронь ${pendingAction.stay.number}?` : ''
        }
        consequence="Отменяется бронь целиком со всеми её проживаниями. Места вернутся в продажу и уйдут в каналы. Отмена необратима."
        amount={
          pendingAction?.kind === 'cancel' ? (
            <span data-testid="cancel-penalty">{penaltyText(pendingAction.penalty, 'cancel')}</span>
          ) : undefined
        }
        confirmLabel="Отменить бронь"
        cancelLabel="Оставить"
        tone="danger"
        pending={busy ?? undefined}
        error={error}
        onConfirm={() => pendingAction?.kind === 'cancel' && cancel(pendingAction.stay)}
        onCancel={() => {
          setPendingAction(null);
          setError(null);
        }}
      >
        {pendingAction?.kind === 'cancel' &&
          (() => {
            const stays = staysOfReservation(pendingAction.stay.number);
            return (
              <p data-testid="cancel-subject">
                Гость {pendingAction.stay.guestLabel}, ячейка {pendingAction.stay.unitCode},{' '}
                {displayPeriod(pendingAction.stay.firstDate, nextDay(pendingAction.stay.lastDate))}.
                {stays > 1 ? ` В брони ещё ${stays - 1} проживаний — они тоже отменятся.` : ''}
              </p>
            );
          })()}
      </ConfirmDialog>
    </>
  );
}

function Cell({
  cell,
  label,
  tail,
  tailAtEnd,
  row,
  index,
  today,
  onDragStart,
  onDragEnd,
  actions,
}: {
  cell: ChessboardCell;
  label: { span: number; continues: boolean } | undefined;
  /** ширина хвоста (меню, WhatsApp) у полосы, которая начинается в этой клетке */
  tail: number;
  /** хвост полосы, которая кончается в этой клетке: отрезок-ссылка заканчивается перед ним */
  tailAtEnd: number;
  row: ChessboardRow;
  index: number;
  today: string;
  onDragStart: (payload: DragPayload) => (e: React.DragEvent) => void;
  onDragEnd: () => void;
  actions?: { move: () => void; extend: () => void; cancel: () => void } | undefined;
}) {
  const unitCode = row.unit.code;
  // цвет клетки зависит от данных — единственный инлайн-стиль сетки; значения из токенов globals.css
  const bg =
    cell.state === 'BLOCKED'
      ? 'var(--st-blocked)'
      : cell.state === 'FREE'
        ? 'var(--surface)'
        : (STATUS_BG[cell.itemStatus ?? ''] ?? 'var(--st-confirmed)');
  const status = STAY_STATUS[cell.itemStatus ?? ''];
  const name =
    cell.state === 'OCCUPIED'
      ? `${cell.guestLabel || 'без имени'}, ${cell.confirmationNumber}, ${status?.word ?? cell.itemStatus}`
      : cell.state === 'BLOCKED'
        ? `${BLOCK_RU[cell.blockType ?? ''] ?? cell.blockType}${cell.blockReason ? `: ${cell.blockReason}` : ''}`
        : 'Свободно — создать бронь на эту дату';
  const draggable =
    cell.state === 'OCCUPIED' &&
    !!cell.confirmationNumber &&
    !!cell.itemId &&
    DRAGGABLE.has(cell.itemStatus ?? '');
  // полоса: с середины клетки заезда до середины клетки выезда (DESIGN.md §9); за край доски не выходит
  const startsMid = !!cell.isArrival;
  const endsMid = !!cell.isLastNight && index < row.cells.length - 1;
  const last = label ? row.cells[index + label.span - 1] : undefined;
  const captionEndsMid = !!last?.isLastNight && index + (label?.span ?? 1) < row.cells.length;
  const captionLen = label ? label.span + (captionEndsMid ? 0.5 : 0) - (startsMid ? 0.5 : 0) : 0;
  const balance =
    cell.balanceMinor && /^[1-9]\d*$/.test(cell.balanceMinor) ? cell.balanceMinor : null;
  const source = sourceBadge(cell);
  const wa = cell.isArrival ? messengerLinks(cell.guestPhone) : null;
  const tailRounded = !!last?.isLastNight;
  return (
    <td
      className={cx('board__cell', cell.date === today && 'is-today')}
      data-state={cell.state}
      data-status={cell.itemStatus}
      data-date={cell.date}
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
            className={cx(
              'board__stay',
              startsMid && 'board__stay--start',
              cell.isLastNight && 'board__stay--end',
              endsMid && 'board__stay--into-next',
              draggable && 'board__stay--draggable',
            )}
            aria-label={name}
            style={{
              background: bg,
              ...(tailAtEnd
                ? { right: endsMid ? `calc(-50% + ${tailAtEnd}px)` : `${tailAtEnd}px` }
                : {}),
            }}
          />
          {label && (
            <div
              className="board-stay-caption"
              data-testid="stay-caption"
              style={{
                left: startsMid ? 'calc(50% + 8px)' : '8px',
                width: `calc(${captionLen * 100}% - ${tail + 12}px)`,
              }}
            >
              {status && (
                <Icon
                  name={status.icon}
                  width={16}
                  height={16}
                  className="board-stay-caption__icon"
                />
              )}
              <span className="board-stay-caption__name">
                {cell.guestLabel || cell.confirmationNumber}
              </span>
              {status && (
                <span className="board-stay-caption__status" data-testid="stay-status">
                  {status.word}
                </span>
              )}
              {source && label.span >= CHANNEL_BADGE_FROM_NIGHTS && (
                <Badge className="board-stay-caption__badge" data-testid="stay-channel">
                  <Icon name={source === 'сайт' ? 'external' : 'channels'} width={16} height={16} />
                  {source}
                </Badge>
              )}
              {balance && label.span >= AMOUNT_BADGE_FROM_NIGHTS && (
                <AmountBadge
                  amountMinor={balance}
                  kind="due"
                  className="board-stay-caption__badge"
                  data-testid="stay-due"
                />
              )}
            </div>
          )}
          {label && tail > 0 && (
            <div
              className={cx('board-stay-menu', tailRounded && 'board-stay-menu--end')}
              style={{
                left: `calc(${(captionLen + (startsMid ? 0.5 : 0)) * 100}% - ${tail}px)`,
                width: tail,
                background: bg,
              }}
            >
              {wa && (
                <a
                  href={wa.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="cell-whatsapp"
                  aria-label="Написать гостю в WhatsApp"
                  className="board__wa"
                >
                  <Icon name="messages" width={16} height={16} />
                </a>
              )}
              {actions && (
                <ActionMenu
                  compact
                  label={`Действия с бронью ${cell.confirmationNumber}`}
                  items={[
                    {
                      id: 'move',
                      label: 'Переселить',
                      icon: 'bed',
                      hint: 'та же категория — без пересчёта',
                      onSelect: actions.move,
                    },
                    {
                      id: 'extend',
                      label: 'Продлить на ночь',
                      icon: 'plus',
                      onSelect: actions.extend,
                    },
                    {
                      id: 'cancel',
                      label: 'Отменить бронь',
                      icon: 'close',
                      tone: 'danger',
                      onSelect: actions.cancel,
                    },
                  ]}
                />
              )}
            </div>
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
          aria-label={`${name}, ${unitCode}`}
        >
          {index === 0 || row.cells[index - 1]?.state !== 'BLOCKED' ? (
            <span className="board-block__word">
              <Icon name="incidents" width={16} height={16} />
              {BLOCK_RU[cell.blockType ?? ''] ?? cell.blockType}
              {cell.blockReason ? `: ${cell.blockReason}` : ''}
            </span>
          ) : null}
        </Link>
      )}
    </td>
  );
}

/** Экран уже 900 px — телефон или планшет вертикально; слушает смену размера */
function useNarrowScreen() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
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
