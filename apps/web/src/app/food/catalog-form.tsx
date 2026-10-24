'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { useT } from '../../i18n/locale-provider';
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
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const item = draft.item;
  const editTitle =
    draft.kind === 'area' ? t('Изменить зал') : draft.kind === 'table' ? t('Изменить стол') : t('Изменить период обслуживания');
  const newTitle =
    draft.kind === 'area' ? t('Новый зал') : draft.kind === 'table' ? t('Новый стол') : t('Новый период');
  const capacityMessage = t('Нельзя уменьшить вместимость: на этот стол уже есть бронирование на большее число гостей.');
  return (
    <Overlay
      open
      drawer
      trapFocus
      title={item ? editTitle : newTitle}
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
                draft.kind === 'table' && /вместим|capacity/i.test(result.error) // kk-allow: сверка с ответом API
                  ? capacityMessage
                  : result.error,
              );
            else {
              router.refresh();
              close();
            }
          });
        }}
      >
        <Field label={t('Название')}>
          <Input name="name" defaultValue={item?.name ?? ''} required maxLength={120} />
        </Field>
        {draft.kind !== 'period' && (
          <Field label={t('Порядок')}>
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
          <Field label={t('Вместимость')}>
            <Input
              name="capacity"
              aria-invalid={error === capacityMessage}
              aria-describedby={error ? 'food-catalog-error' : undefined}
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
            <Field label={t('День недели')}>
              <Select name="weekday" defaultValue={draft.item?.weekday ?? new Date().getDay()}>
                {weekdays.map((d, i) => (
                  <option key={i} value={i}>
                    {t(d)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="food-form-row">
              <Field label={t('Начало')}>
                <Input
                  name="timeFrom"
                  type="time"
                  required
                  defaultValue={draft.item?.timeFrom ?? '18:00'}
                />
              </Field>
              <Field label={t('Конец')}>
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
              {t('Заканчивается на следующий день')}
            </label>
            <Field label={t('Длительность брони, мин')}>
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
          {t('Активен (снимите, чтобы архивировать)')}
        </label>
        {error && (
          <Alert id="food-catalog-error" tone="warning">
            {error}
          </Alert>
        )}
        <Button disabled={pending}>
          {pending ? t('Сохраняем…') : item ? t('Сохранить') : t('Создать')}
        </Button>
        {item && (
          <Button
            type="submit"
            tone="secondary"
            name="activeAction"
            value={item.active ? 'archive' : 'restore'}
            disabled={pending}
          >
            {item.active ? t('Архивировать') : t('Вернуть')}
          </Button>
        )}
      </form>
    </Overlay>
  );
}
