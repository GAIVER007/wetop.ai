'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../components/icon';
import { Segmented, type SegmentOption } from '../../components/segmented';
import { Button, Select } from '../../components/ui';
import type { ChessboardRow } from '../../lib/api';
import {
  NO_FILTERS,
  STAY_FLAGS,
  filterRows,
  sourceOptions,
  statusOptions,
  type BoardFilters,
  type SearchNeedle,
  type StayFlag,
  type UnitState,
} from './board-filters';

const GAP = 6;
const EDGE = 8;

export const KIND_OPTIONS: ReadonlyArray<readonly [BoardFilters['kind'], string]> = [
  ['', 'Все'],
  ['ROOM', 'Номера'],
  ['BED', 'Койки'],
];

/** Вид строк (ТЗ v2 §38): из строки над сеткой переключатель убрал владелец 09.10.2026, живёт здесь */
export type BoardView = 'compact' | 'normal' | 'detailed';
export const VIEW_OPTIONS: ReadonlyArray<SegmentOption<BoardView>> = [
  { value: 'compact', label: 'Компактный' },
  { value: 'normal', label: 'Обычный' },
  { value: 'detailed', label: 'Подробный' },
];

/**
 * Окошко «Фильтры» шахматки (ТЗ «Шахматка v2» §9). Правится черновик: «Применить» переносит его на
 * сетку, Escape, крестик и щелчок мимо закрывают без применения, «Сбросить» чистит черновик. Группы —
 * «Тип места», «Брони», «Источник» и «Статус брони»; источники и статусы — только те, что есть на
 * загруженной сетке. Ниже вид строк (§38): применяется сразу, мимо черновика. Под группами ссылка
 * на ящик «Брони без размещения» (PR 6), если такие есть. На телефоне здесь же «Категория» и «Места»:
 * в строке над сеткой для них нет места.
 *
 * Окно в верхнем слое (Popover API), как предпросмотр брони: у панели над сеткой `backdrop-filter`, и
 * `fixed` внутри неё считался бы от неё. Место считается от кнопки «Фильтры» и пересчитывается при
 * прокрутке и смене размера окна.
 */
export function BoardFiltersPopover({
  anchor,
  applied,
  rows,
  today,
  needle,
  categories,
  stateOptions,
  stateLabel,
  unassigned,
  view,
  onView,
  help,
  onApply,
  onClose,
}: {
  anchor: HTMLElement;
  applied: BoardFilters;
  rows: ChessboardRow[];
  today: string;
  needle: SearchNeedle | null;
  categories: Array<{ code: string; name: string }>;
  stateOptions: ReadonlyArray<readonly [UnitState, string]>;
  stateLabel: string;
  unassigned: number;
  view: BoardView;
  onView: (view: BoardView) => void;
  /** подсказка «Как работать с календарём» внизу окошка */
  help?: ReactNode;
  onApply: (next: BoardFilters) => void;
  /** restoreFocus — вернуть курсор на «Фильтры» (клавиатура, крестик), но не при щелчке мимо */
  onClose: (restoreFocus: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<BoardFilters>(applied);
  const baseId = useId();
  const sources = sourceOptions(rows);
  const statuses = statusOptions(rows);
  const matched = filterRows(rows, draft, today, needle).length;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.matches(':popover-open')) {
      el.showPopover();
      el.focus({ preventScroll: true });
    }
    const place = () => {
      const box = anchor.getBoundingClientRect();
      const width = el.offsetWidth;
      const left = Math.min(Math.max(box.left, EDGE), window.innerWidth - width - EDGE);
      const below = box.bottom + GAP;
      const top =
        below + el.offsetHeight <= window.innerHeight - EDGE
          ? below
          : Math.max(EDGE, window.innerHeight - EDGE - el.offsetHeight);
      el.style.left = `${Math.max(EDGE, left)}px`;
      el.style.top = `${top}px`;
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, { capture: true });
    };
  }, [anchor]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose(true);
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      // щелчок по самой кнопке «Фильтры» закрывает окошко её же обработчиком
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onClose(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [anchor, onClose]);

  const toggle = <K extends 'stays' | 'sources' | 'statuses'>(
    key: K,
    value: BoardFilters[K][number],
  ) =>
    setDraft((d) => {
      const list = d[key] as string[];
      return {
        ...d,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });

  const group = (
    slug: string,
    label: string,
    options: ReadonlyArray<{ key: string; label: string }>,
    pressed: (key: string) => boolean,
    onPick: (key: string) => void,
  ) => {
    const id = `${baseId}-${slug}`;
    return (
      <div className="board-filters-pop__group" role="group" aria-labelledby={id}>
        <p className="board-filters-pop__label" id={id}>
          {label}
        </p>
        <div className="chips">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={pressed(o.key)}
              onClick={() => onPick(o.key)}
            >
              {/* выбор виден не только цветом (WCAG 1.4.1): у выбранного — галочка */}
              {pressed(o.key) && <Icon name="check" />}
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={ref}
      popover="manual"
      role="dialog"
      aria-label="Фильтры календаря"
      tabIndex={-1}
      className="board-filters-pop"
      data-testid="board-filters-pop"
    >
      <div className="board-filters-pop__head">
        <h2 className="board-filters-pop__title">Фильтры</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть фильтры"
          onClick={() => onClose(true)}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="board-filters-pop__body">
        <div className="board-filters-pop__narrow">
          <label className="field">
            <span>Категория</span>
            <Select
              aria-label="Категория в календаре"
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            >
              <option value="">Все категории</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>{stateLabel}</span>
            <Select
              aria-label="Места в календаре"
              value={draft.state}
              onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value as UnitState }))}
            >
              {stateOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {group(
          'kind',
          'Тип места',
          KIND_OPTIONS.map(([key, label]) => ({ key, label })),
          (key) => draft.kind === key,
          (key) => setDraft((d) => ({ ...d, kind: key as BoardFilters['kind'] })),
        )}
        {group(
          'stays',
          'Брони',
          STAY_FLAGS.map(([key, label]) => ({ key, label })),
          (key) => draft.stays.includes(key as StayFlag),
          (key) => toggle('stays', key as StayFlag),
        )}
        {sources.length > 0 &&
          group(
            'sources',
            'Источник',
            sources,
            (key) => draft.sources.includes(key),
            (key) => toggle('sources', key),
          )}
        {statuses.length > 0 &&
          group(
            'statuses',
            'Статус брони',
            statuses,
            (key) => draft.statuses.includes(key),
            (key) => toggle('statuses', key),
          )}
        {/* Вид: настройка показа, не отбор. Меняет сетку сразу, «Применить» его не ждёт */}
        <div className="board-filters-pop__group">
          <p className="board-filters-pop__label" id={`${baseId}-view`}>
            Вид строк
          </p>
          <Segmented
            label="Вид строк календаря"
            value={view}
            options={VIEW_OPTIONS}
            onChange={onView}
          />
        </div>
        {help && (
          <details className="board-filters-pop__help">
            <summary>Как работать с календарём</summary>
            {help}
          </details>
        )}
        {unassigned > 0 && (
          // ящик PR 6 слушает якорь: окошко закрывается, ящик открывается
          <a
            className="board-filters-pop__unassigned"
            href="#unassigned-stays"
            onClick={() => onClose(false)}
          >
            <Icon name="incidents" />
            Брони без назначенного места: {unassigned}
          </a>
        )}
      </div>
      <div className="board-filters-pop__foot">
        <span
          className="board-filters-pop__preview"
          data-testid="filters-preview"
          role="status"
          aria-live="polite"
        >
          Подходит {matched} из {rows.length} мест
        </span>
        <Button type="button" tone="ghost" onClick={() => setDraft(NO_FILTERS)}>
          Сбросить
        </Button>
        <Button type="button" onClick={() => onApply(draft)}>
          Применить
        </Button>
      </div>
    </div>
  );
}
