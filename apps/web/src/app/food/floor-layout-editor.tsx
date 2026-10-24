'use client';
import { useRef, useState, useTransition, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LAYOUT_SIZE, layoutSpots, tableShapeOf, type TableLayout, type TableShape } from '@pms/domain';
import { Alert, Button, Field, Select } from '../../components/ui';
import type { DiningArea, DiningTable } from '../../lib/food-types';
import { saveFloorLayout } from './restaurant-actions';
import { tableTitle } from '../../lib/table-title';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/** Форма стола на плане: те же три фигуры, что рисует CSS плана зала */
export const SHAPE_CSS: Record<TableShape, string> = { ROUND: 'round', SQUARE: 'square', RECT: 'long' };

/** Место стола на полотне зоны: проценты и масштаб через переменные, их читает `.rest-fp__spot` */
export function spotStyle(x: number, y: number, scale: number, rotation: number): CSSProperties {
  return {
    ['--spot-x' as string]: `${x / 10}%`,
    ['--spot-y' as string]: `${y / 10}%`,
    ['--spot-scale' as string]: String(scale / 100),
    ['--spot-turn' as string]: `${rotation}deg`,
  };
}

const SIZES = [
  { value: 75, label: msg('Маленький') },
  { value: 100, label: msg('Обычный') },
  { value: 130, label: msg('Большой') },
  { value: 160, label: msg('Очень большой') },
];
const clamp = (v: number) => Math.max(0, Math.min(LAYOUT_SIZE, Math.round(v)));

/**
 * Редактор схемы зоны (DATA_MODEL §42, ADR-174). Столы перетаскиваются мышью или пальцем; с клавиатуры выбранный стол
 * двигают стрелки (Shift быстрее). Форма, размер и поворот у выбранного стола. Сохраняется вся зона одним запросом.
 */
export function FloorLayoutEditor({
  scopeKey,
  area,
  tables,
  onClose,
}: {
  scopeKey: string;
  area: DiningArea;
  tables: DiningTable[];
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const canvas = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [layout, setLayout] = useState<Record<string, TableLayout>>(() => {
    const spots = layoutSpots(tables.map((t) => ({ id: t.id, posX: t.posX ?? null, posY: t.posY ?? null })));
    return Object.fromEntries(
      tables.map((t) => [
        t.id,
        {
          id: t.id,
          posX: spots.get(t.id)!.x,
          posY: spots.get(t.id)!.y,
          shape: t.shape ?? null,
          scale: t.scale ?? 100,
          rotation: t.rotation === 90 ? 90 : 0,
        },
      ]),
    );
  });
  const [selected, setSelected] = useState(tables[0]?.id ?? '');
  const [dragging, setDragging] = useState<string | null>(null);
  const patch = (id: string, change: Partial<TableLayout>) =>
    setLayout((prev) => ({ ...prev, [id]: { ...prev[id]!, ...change } }));

  function moveTo(id: string, e: PointerEvent) {
    const box = canvas.current?.getBoundingClientRect();
    if (!box) return;
    patch(id, {
      posX: clamp(((e.clientX - box.left) / box.width) * LAYOUT_SIZE),
      posY: clamp(((e.clientY - box.top) / box.height) * LAYOUT_SIZE),
    });
  }
  function onKey(id: string, e: KeyboardEvent) {
    const step = e.shiftKey ? 50 : 10;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const spot = layout[id]!;
    patch(id, { posX: clamp(spot.posX + d[0]), posY: clamp(spot.posY + d[1]) });
  }
  function save() {
    start(async () => {
      const result = await saveFloorLayout(scopeKey, area.id, Object.values(layout));
      if (result.error) return setError(result.error);
      onClose();
      router.refresh();
    });
  }

  const current = layout[selected];
  const table = tables.find((t) => t.id === selected);
  return (
    <section className="rest-fp-editor" aria-label={t('Схема зоны «{name}»', { name: area.name })} data-testid="floor-layout-editor">
      <p className="muted">
        {t('Перетащите столы мышью или пальцем. С клавиатуры: выберите стол и двигайте стрелками, с Shift быстрее.')}
      </p>
      {error && <Alert>{error}</Alert>}
      <div className="rest-fp__layout" ref={canvas} data-editing="true">
        {tables.map((spot) => {
          const l = layout[spot.id]!;
          return (
            <div
              key={spot.id}
              className="rest-fp__spot"
              style={spotStyle(l.posX, l.posY, l.scale, l.rotation)} /* slop-allow: inline-style место стола из схемы зала */
            >
              <div
                className="rest-fp-table"
                data-kind="FREE"
                data-shape={SHAPE_CSS[tableShapeOf({ capacity: spot.capacity, shape: l.shape })]}
                data-selected={selected === spot.id || undefined}
              >
                <button
                  type="button"
                  className="rest-fp-table__body"
                  aria-label={t('{name}: место {x}% по ширине, {y}% по высоте', { name: spot.name, x: Math.round(l.posX / 10), y: Math.round(l.posY / 10) })}
                  aria-pressed={selected === spot.id}
                  data-table-id={spot.id}
                  data-dragging={dragging === spot.id || undefined}
                  onPointerDown={(e) => {
                    setSelected(spot.id);
                    setDragging(spot.id);
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => dragging === spot.id && moveTo(spot.id, e)}
                  onPointerUp={() => setDragging(null)}
                  onFocus={() => setSelected(spot.id)}
                  onKeyDown={(e) => onKey(spot.id, e)}
                >
                  <strong>{spot.name.replace(/^Стол\s+/, '')}</strong>{/* kk-allow: слово из названия стола (данные) снимается, номер виден на фигуре */}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {current && table && (
        <div className="rest-fp-editor__fields" aria-label={tableTitle(table.name)} role="group">
          <Field label={t('Форма: {name}', { name: table.name })}>
            <Select
              value={current.shape ?? ''}
              onChange={(e) => patch(selected, { shape: (e.target.value || null) as TableShape | null })}
            >
              <option value="">{t('По числу мест')}</option>
              <option value="ROUND">{t('Круглый')}</option>
              <option value="SQUARE">{t('Квадратный')}</option>
              <option value="RECT">{t('Прямоугольный')}</option>
            </Select>
          </Field>
          <Field label={t('Размер: {name}', { name: table.name })}>
            <Select value={current.scale} onChange={(e) => patch(selected, { scale: Number(e.target.value) })}>
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {t(s.label)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Поворот: {name}', { name: table.name })}>
            <Select
              value={current.rotation}
              onChange={(e) => patch(selected, { rotation: e.target.value === '90' ? 90 : 0 })}
            >
              <option value={0}>{t('Прямо')}</option>
              <option value={90}>{t('Повёрнут на 90°')}</option>
            </Select>
          </Field>
        </div>
      )}
      <div className="rest-fp-editor__actions">
        <Button disabled={pending} onClick={save}>
          {pending ? t('Сохраняем…') : t('Сохранить расстановку')}
        </Button>
        <Button tone="secondary" disabled={pending} onClick={onClose}>
          {t('Отмена')}
        </Button>
      </div>
    </section>
  );
}
