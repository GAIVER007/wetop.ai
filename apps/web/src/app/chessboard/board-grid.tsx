'use client';
import Link from 'next/link';
import {
  Fragment,
  useCallback,
  useEffect,
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
import { guestNames, sourceBadge, stayLabels } from './stay-labels';
import { StayPreview, type PreviewCommand, type PreviewTarget } from './stay-preview';
import { StayResize } from './stay-resize';
import {
  assignUnitAction,
  cancelPreviewAction,
  cancelReservationAction,
  extendStayAction,
  previewAction,
  stayAction,
} from '../reservations/actions';
import { useRouter, useSearchParams } from 'next/navigation';
import { ActionMenu } from '../../components/action-menu';
import { HousekeepingMenu } from './housekeeping-menu';
import { HOUSEKEEPING_RU } from '@pms/domain';
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
 * Уборка: значок стоит в строке, пока с ячейкой надо что-то делать — «требует уборки» (щётка) или
 * «убрано, ждёт проверки»; после «Проверено» ячейка доступна, и значка нет (цикл — @pms/domain, 22.09).
 * «Проверено» на 88 строках было бы шумом. Фильтр «Уборка N» считает те же строки.
 */
const needsHousekeeping = (status?: string): status is 'DIRTY' | 'CLEAN' =>
  status === 'DIRTY' || status === 'CLEAN';

/** Свёрнутые категории помнятся на пользователя браузера (ТЗ v2 §15); ключ localStorage */
const COLLAPSED_KEY = 'chessboard.collapsed-categories';

/** Подсказка колонки места (ТЗ v2 §16): вид, код и состояние уборки словами */
function unitTitle(unit: ChessboardRow['unit']): string {
  const bed = unit.kind === 'BED';
  const state =
    unit.housekeepingStatus === 'DIRTY'
      ? 'требует уборки'
      : unit.housekeepingStatus === 'CLEAN'
        ? 'убрано, ждёт проверки'
        : bed
          ? 'готова к заселению'
          : 'готов к заселению';
  return `${bed ? 'Койка' : 'Номер'} ${unit.code} — ${state}`;
}

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
  readOnly = false,
}: {
  board: Chessboard;
  today: string;
  fitMonth?: boolean;
  /** «Только чтение» (ADR-102): предпросмотр показывает брони, но не предлагает изменений (ТЗ §47) */
  readOnly?: boolean;
}) {
  const [query, setQuery] = useState('');
  const searchParams = useSearchParams();
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  // тип места из адреса — так «Аналитика → Загрузка» открывает шахматку уже на номерах или койках
  const [kind, setKind] = useState(() => {
    const k = searchParams.get('kind');
    return k === 'ROOM' || k === 'BED' ? k : '';
  });
  const [state, setState] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const activeFilters = Number(!!category) + Number(!!kind) + Number(state !== 'all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Память свёрнутости читается после гидрации: чтение в useState разошлось бы с SSR-разметкой
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
      if (Array.isArray(saved) && saved.length)
        setCollapsed(new Set(saved.filter((x): x is string => typeof x === 'string')));
    } catch {
      // повреждённое значение равно отсутствию памяти
    }
  }, []);
  const toggleGroup = (code: string) =>
    setCollapsed((old) => {
      const next = new Set(old);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        // приватное окно без localStorage — сворачивание работает, память нет
      }
      return next;
    });
  const [error, setError] = useState<string | null>(null);
  const [overUnit, setOverUnit] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  const { toast } = useToast();
  const fitWeek = board.dates.length === 7;
  // Во время dragover браузер не даёт читать данные — держим их и в ref, чтобы подсвечивать строку
  const dragging = useRef<DragPayload | null>(null);
  /**
   * Липкой строке категории нужен отступ, равный фактической высоте шапки дат: токен
   * --board-head-h — минимум, на узких экранах шапка выше (перенос метрик). Замер пишется
   * в --board-head-real на обёртке; CSS берёт var(--board-head-real, var(--board-head-h)).
   * Так же меряется колонка мест (--board-unit-real): к её правому краю прилипает имя длинного
   * проживания при прокрутке вбок (ТЗ v2 §58).
   */
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    const head = wrap?.querySelector('thead');
    const unitHead = wrap?.querySelector('th.board__unit-head');
    if (!wrap || !head || !unitHead) return;
    const apply = () => {
      wrap.style.setProperty('--board-head-real', `${head.getBoundingClientRect().height}px`);
      wrap.style.setProperty('--board-unit-real', `${unitHead.getBoundingClientRect().width}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(head);
    observer.observe(unitHead);
    return () => observer.disconnect();
  }, []);

  // Быстрый предпросмотр (ТЗ §23–25): одинарный клик — окно, двойной — полная карточка
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const openCard = (href: string) => {
    setPreview(null);
    router.push(href);
  };
  const closePreview = useCallback((restoreFocus: boolean) => {
    setPreview((current) => {
      if (restoreFocus) current?.anchor.focus({ preventScroll: true });
      return null;
    });
  }, []);

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
  const extending = useRef(false);
  const extendStay = async (p: StayMenuPayload, addedNights = 1) => {
    if (pending || extending.current) return;
    extending.current = true;
    setError(null);
    const summary = await previewAction(p.number, p.itemId, {
      action: 'extend',
      nights: String(addedNights),
    });
    if (!summary) {
      extending.current = false;
      setError('Не удалось рассчитать продление. Проверьте тариф в карточке брони и повторите.');
      return;
    }
    if (
      !(await ask({
        title: `Продлить на ${addedNights === 1 ? 'ночь' : `${addedNights} ноч.`} — ${p.guest}, ${p.unitCode}?`,
        body: previewLine(summary),
        confirmLabel: 'Продлить',
      }))
    ) {
      extending.current = false;
      return;
    }
    start(async () => {
      const r = await extendStayAction(p.number, p.itemId, addedNights);
      extending.current = false;
      setError(r.error);
      if (!r.error) {
        toast({
          text: `Бронь ${p.number} продлена на ${addedNights === 1 ? 'ночь' : `${addedNights} ноч.`}, ${p.unitCode}`,
          tone: 'success',
        });
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

  /**
   * Команды из предпросмотра — те же, что у карточки брони (reservations/[number]/actions-panel.tsx):
   * заселение в непроверенную ячейку только после подтверждения (Q-156, ADR-068); выселение с долгом
   * — второй попыткой после ответа сервера и подтверждения (T3). Своих правил здесь нет.
   */
  const busy = useRef(false);
  const runCommand = async (command: PreviewCommand, t: PreviewTarget) => {
    setPreview(null);
    const stay: StayMenuPayload = {
      number: t.number,
      itemId: t.itemId,
      unitCode: t.unitCode,
      guest: t.guest,
      status: t.status,
    };
    if (command === 'extend') return extendStay(stay);
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      if (command === 'check-in') {
        const hk = t.housekeeping as keyof typeof HOUSEKEEPING_RU | undefined;
        if (hk && hk !== 'INSPECTED') {
          const ok = await ask({
            title: `Ячейка ${t.unitCode} ещё не проверена. Заселить?`,
            body: `Сейчас ${HOUSEKEEPING_RU[hk]}. Гость заезжает в проверенную ячейку; заселение не запрещено, но нужно ваше подтверждение.`,
            confirmLabel: 'Заселить всё равно',
            tone: 'primary',
          });
          if (!ok) return;
        }
        const r = await stayAction(t.number, t.itemId, 'check-in');
        setError(r.error);
        if (!r.error) toast({ text: `Гость заселён, ${t.unitCode}`, tone: 'success' });
        return;
      }
      const r = await stayAction(t.number, t.itemId, 'check-out');
      if (r.error && r.error.includes('долг')) {
        const ok = await ask({
          title: 'Выселить с долгом?',
          body: `Долг останется на счёте. ${r.error}`,
          confirmLabel: 'Выселить с долгом',
        });
        if (!ok) return;
        const again = await stayAction(t.number, t.itemId, 'check-out', true);
        setError(again.error);
        if (!again.error) toast({ text: `Гость выселен, ${t.unitCode}`, tone: 'success' });
        return;
      }
      setError(r.error);
      if (!r.error) toast({ text: `Гость выселен, ${t.unitCode}`, tone: 'success' });
    } finally {
      busy.current = false;
    }
  };

  const allGroups = groupByCategory(board.rows);
  const housekeepingCount = board.rows.filter((r) =>
    needsHousekeeping(r.unit.housekeepingStatus),
  ).length;
  const needle = query.trim().toLocaleLowerCase('ru');
  const rows = board.rows.filter(
    (row) =>
      (!category || row.unit.accommodationTypeCode === category) &&
      (!kind || row.unit.kind === kind) &&
      (state === 'all' ||
        // «Уборка» — это статус ячейки, а не блокировка: типа блокировки CLEANING в модели нет,
        // и фильтр не срабатывал никогда (DESIGN.md §9, срез 7.1)
        (state === 'cleaning'
          ? needsHousekeeping(row.unit.housekeepingStatus)
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
              {
                ...l,
                lastDate: r.cells[l.index + l.span - 1]!.date,
                ends: !!r.cells[l.index + l.span - 1]!.isLastNight,
              },
            ]),
          ),
        ]),
      ),
    [board.rows],
  );
  // 30 дней: день не уже 72 px — читаемость ценой горизонтальной прокрутки внутри сетки
  // (условие владельца к PR 2; ТЗ §44). Календарный месяц вписывается в окно отдельным режимом.
  const dayWidth = board.dates.length > 14 ? 72 : 104;
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
              // счётчик только у уборки: сколько мест ещё не проверено, видно до нажатия (21.09)
              ['cleaning', `Уборка ${housekeepingCount}`],
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
        ref={wrapRef}
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
                      onClick={() => toggleGroup(g.code)}
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
                          title={unitTitle(row.unit)}
                        >
                          <Icon name={row.unit.kind === 'BED' ? 'bed' : 'inventory'} />
                          {row.unit.code}
                        </Link>{' '}
                        <span className="muted-2">
                          {row.unit.kind === 'BED' ? 'койка' : 'номер'}
                        </span>
                        {needsHousekeeping(row.unit.housekeepingStatus) && (
                          <HousekeepingMenu
                            code={row.unit.code}
                            status={row.unit.housekeepingStatus}
                          />
                        )}
                      </td>
                      {row.cells.map((c, index) => (
                        <Cell
                          key={c.date}
                          cell={c}
                          label={labels.get(row.unit.id)?.get(index)}
                          unit={row.unit}
                          unitCode={row.unit.code}
                          today={today}
                          month={fitMonth}
                          onPreview={setPreview}
                          onOpen={openCard}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                          onExtend={extendStay}
                          pending={pending}
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
          Сохраняем изменения…
        </p>
      )}
      {error && <Alert data-testid="drag-error">{error}</Alert>}
      {preview && (
        <StayPreview
          key={`${preview.number}:${preview.itemId}`}
          target={preview}
          readOnly={readOnly}
          onClose={closePreview}
          onCommand={(command, t) => void runCommand(command, t)}
        />
      )}
      {dialog}
    </>
  );
}

function Cell({
  cell,
  label,
  unit,
  unitCode,
  today,
  month,
  onPreview,
  onOpen,
  onDragStart,
  onDragEnd,
  onExtend,
  onCancel,
  pending,
}: {
  cell: ChessboardCell;
  label: { span: number; continues: boolean; lastDate: string; ends: boolean } | undefined;
  unit: ChessboardRow['unit'];
  unitCode: string;
  today: string;
  month: boolean;
  onPreview: (target: PreviewTarget) => void;
  onOpen: (href: string) => void;
  onDragStart: (payload: DragPayload) => (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onExtend: (payload: StayMenuPayload, nights?: number) => void;
  pending: boolean;
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
  const names = guestNames(cell.guestLabel ?? '');
  const badge = sourceBadge(cell.source, cell.channel);
  const hasDebt = !!cell.balanceMinor && BigInt(cell.balanceMinor) > 0n;
  const arrivalToday = !!label && !label.continues && cell.date === today;
  const departureToday = !!label && label.ends && nextDay(label.lastDate) === today;
  // Однодневная плашка: «⋯» уступает место имени — те же действия в предпросмотре по щелчку (ТЗ §58).
  // Ручка продления остаётся (это перетаскивание, PR 4): ей нужно место, если последняя ночь в окне.
  const withMenu = !!label && label.span > 1;
  const withResize = !!label && label.ends && DRAGGABLE.has(cell.itemStatus ?? '') && !month;
  const captionEnd = withMenu
    ? 'var(--board-caption-end, 40px)'
    : withResize
      ? 'calc(var(--space-6) + var(--space-2))'
      : 'var(--space-2)';
  const card = `/reservations/${encodeURIComponent(cell.confirmationNumber ?? '')}`;
  const openPreview = (anchor: HTMLElement) =>
    onPreview({
      number: cell.confirmationNumber!,
      itemId: cell.itemId!,
      guest: names.full || cell.confirmationNumber!,
      status: cell.itemStatus ?? '',
      unitCode,
      unitKind: unit.kind,
      categoryName: unit.accommodationTypeName,
      housekeeping: unit.housekeepingStatus,
      sourceName: badge?.name ?? null,
      arrivalToday,
      departureToday,
      anchor,
    });
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
            href={card}
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
            onClick={(event) => {
              // новая вкладка и прочие жесты с клавишей — как у обычной ссылки
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              openPreview(event.currentTarget);
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              onOpen(card);
            }}
            aria-haspopup="dialog"
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
              /*
               * Подпись по ширине плашки (ТЗ v2 §18–22, §58): container queries в board.css выбирают
               * уровень — полное имя и вторая строка (источник, заезд/выезд сегодня, ночи, долг
               * суммой) → «Имя Ф.» и точка долга → инициалы. Полное всегда в подсказке плашки.
               */
              <span
                className="board-stay-caption"
                data-span={label.span}
                style={{
                  width: `calc(${label.span * 100}% - ${captionEnd})`,
                }}
              >
                <span className="board-stay-line">
                  <b className="board-stay-glyph" aria-hidden="true">
                    {label.continues ? '←' : (STATUS_GLYPH[cell.itemStatus ?? ''] ?? '')}
                  </b>
                  <span className="board-stay-name">{names.full || cell.confirmationNumber}</span>
                  <span className="board-stay-name-short">
                    {names.short || cell.confirmationNumber}
                  </span>
                  <span className="board-stay-initials">{names.initials || '•'}</span>
                  {hasDebt && (
                    <span
                      className="board-stay-due-dot"
                      data-testid="cell-due-dot"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="board-stay-line board-stay-line--meta">
                  {/* Источник — маленьким бейджем: цвет плашки уже занят статусом брони (DESIGN.md §9) */}
                  {badge && (
                    <span className="board-stay-source" data-testid="cell-channel">
                      {badge.code}
                    </span>
                  )}
                  {(arrivalToday || departureToday) && (
                    <span className="board-stay-today">
                      {arrivalToday ? 'заезд сегодня' : 'выезд сегодня'}
                    </span>
                  )}
                  {label.span >= 2 && (
                    <span className="board-stay-nights">
                      {/* «+»: проживание начато до окна или идёт дальше его — видимых ночей меньше */}
                      {nights(label.span, label.continues || !label.ends)}
                    </span>
                  )}
                  {hasDebt && (
                    <AmountChip
                      minor={cell.balanceMinor!}
                      tone="due"
                      className="board-stay-due"
                      data-testid="cell-due"
                    />
                  )}
                </span>
              </span>
            )}
          </Link>
          {/* C2: меню действий — брат ссылки, а не её потомок: клик по плашке и перетаскивание не задеты */}
          {label && withMenu && cell.confirmationNumber && cell.itemId && (
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
              style={{ left: `calc(${label.span * 100}% - 54px)` }}
            />
          )}
          {draggable && cell.isLastNight && (
            <StayResize
              guest={cell.guestLabel || cell.confirmationNumber!}
              lastNight={cell.date}
              disabled={pending}
              onExtend={(nights) =>
                onExtend(
                  {
                    number: cell.confirmationNumber!,
                    itemId: cell.itemId!,
                    unitCode,
                    guest: cell.guestLabel || cell.confirmationNumber!,
                    status: cell.itemStatus ?? '',
                  },
                  nights,
                )
              }
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

/** Строки в порядке категорий: нумерация может быть несплошной, рядом могут идти разные категории. */
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
