'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import type { DiningArea, DiningTable, ServicePeriod } from '../../lib/food-types';
import { weekdays } from '../../lib/food-data';
import { saveFoodCatalog } from './actions';
export type CatalogDraft =
  | { kind: 'area'; item?: DiningArea }
  | { kind: 'table'; areaId: string; item?: DiningTable }
  | { kind: 'period'; item?: ServicePeriod };
export function CatalogForm({
  draft,
  scopeKey,
  close,
}: {
  draft: CatalogDraft;
  scopeKey: string;
  close: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const item = draft.item;
  const title =
    draft.kind === 'area' ? 'Зал' : draft.kind === 'table' ? 'Стол' : 'Период обслуживания';
  return (
    <Overlay
      open
      drawer
      title={`${item ? 'Изменить' : 'Добавить'}: ${title}`}
      onClose={close}
      className="food-drawer"
    >
      <form
        className="food-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          setError('');
          const common = {
            name: String(f.get('name')),
            active: f.get('activeAction')
              ? f.get('activeAction') === 'restore'
              : f.get('active') === 'on',
          };
          start(async () => {
            const id = item?.id;
            const command =
              draft.kind === 'area'
                ? {
                    kind: 'area' as const,
                    ...(id ? { id } : {}),
                    body: { ...common, sortOrder: Number(f.get('sortOrder')) },
                  }
                : draft.kind === 'table'
                  ? {
                      kind: 'table' as const,
                      ...(id ? { id } : {}),
                      body: {
                        ...common,
                        sortOrder: Number(f.get('sortOrder')),
                        capacity: Number(f.get('capacity')),
                        areaId: draft.areaId,
                      },
                    }
                  : {
                      kind: 'period' as const,
                      ...(id ? { id } : {}),
                      body: {
                        ...common,
                        weekday: Number(f.get('weekday')),
                        timeFrom: String(f.get('timeFrom')),
                        timeTo: String(f.get('timeTo')),
                        endsNextDay: f.get('endsNextDay') === 'on',
                        defaultDurationMinutes: Number(f.get('duration')),
                      },
                    };
            const result = await saveFoodCatalog(scopeKey, command);
            if (result.error)
              setError(
                draft.kind === 'table' && /вместим|capacity/i.test(result.error)
                  ? 'Нельзя уменьшить вместимость: на этот стол уже есть бронирование на большее число гостей.'
                  : result.error,
              );
            else {
              router.refresh();
              close();
            }
          });
        }}
      >
        <Field label="Название">
          <Input name="name" defaultValue={item?.name ?? ''} required maxLength={120} />
        </Field>
        {draft.kind !== 'period' && (
          <Field label="Порядок">
            <Input
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={item && 'sortOrder' in item ? item.sortOrder : 0}
              required
            />
          </Field>
        )}
        {draft.kind === 'table' && (
          <Field label="Вместимость">
            <Input
              name="capacity"
              type="number"
              min={1}
              max={1000}
              required
              defaultValue={draft.item?.capacity ?? 4}
            />
          </Field>
        )}
        {draft.kind === 'period' && (
          <>
            <Field label="День недели">
              <Select name="weekday" defaultValue={draft.item?.weekday ?? new Date().getDay()}>
                {weekdays.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="food-form-row">
              <Field label="Начало">
                <Input
                  name="timeFrom"
                  type="time"
                  required
                  defaultValue={draft.item?.timeFrom ?? '18:00'}
                />
              </Field>
              <Field label="Конец">
                <Input
                  name="timeTo"
                  type="time"
                  required
                  defaultValue={draft.item?.timeTo ?? '23:00'}
                />
              </Field>
            </div>
            <label className="food-check">
              <input
                name="endsNextDay"
                type="checkbox"
                defaultChecked={draft.item?.endsNextDay ?? false}
              />
              Заканчивается на следующий день
            </label>
            <Field label="Длительность брони, мин">
              <Input
                name="duration"
                type="number"
                min={1}
                max={1440}
                required
                defaultValue={draft.item?.defaultDurationMinutes ?? 120}
              />
            </Field>
          </>
        )}
        <label className="food-check">
          <input name="active" type="checkbox" defaultChecked={item?.active ?? true} />
          Активен (снимите, чтобы архивировать)
        </label>
        {error && <Alert tone="warning">{error}</Alert>}
        <Button disabled={pending}>
          {pending ? 'Сохраняем…' : item ? 'Сохранить' : 'Создать'}
        </Button>
        {item && (
          <Button
            type="submit"
            tone="secondary"
            name="activeAction"
            value={item.active ? 'archive' : 'restore'}
            disabled={pending}
          >
            {item.active ? 'Архивировать' : 'Вернуть'}
          </Button>
        )}
      </form>
    </Overlay>
  );
}
