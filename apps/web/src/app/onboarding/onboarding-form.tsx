'use client';
import { useState, useTransition } from 'react';
import { Icon } from '../../components/icon';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { postponeOnboarding, provisionHotel } from './actions';
import type { OnboardingCategoryInput } from '../../lib/api';
import './onboarding.css';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

type Kind = OnboardingCategoryInput['kind'];
const KINDS: [Kind, string][] = [
  ['PRIVATE_ROOM', msg('Отдельный номер')],
  ['DORM_BED', msg('Койко-место (общий номер)')],
  ['APARTMENT', msg('Апартаменты')],
];

export interface Row {
  name: string;
  kind: Kind;
  capacityAdults: string;
  units: string;
  price: string;
}

const emptyRow = (): Row => ({
  name: '',
  kind: 'PRIVATE_ROOM',
  capacityAdults: '2',
  units: '1',
  price: '',
});

/**
 * Настройка отеля в один экран: разделы «Отель», «Номера», «Цены». Цена у каждой категории, рядом
 * с ней (в тенге, на сервер уходит в тиынах). Кнопка «Запустить отель» заводит номера, тариф и цены.
 */
export function OnboardingForm({
  hotelName,
  currency,
  embedded = false,
  initialRows,
  onRowsChange,
  readOnly = false,
}: {
  hotelName: string;
  currency: string;
  embedded?: boolean;
  initialRows?: Row[];
  onRowsChange?: (rows: Row[]) => void;
  readOnly?: boolean;
}) {
  const t = useT();
  const [rows, setRowsState] = useState<Row[]>(initialRows?.length ? initialRows : [emptyRow()]);
  const setRows = (update: (current: Row[]) => Row[]) => {
    const next = update(rows);
    setRowsState(next);
    onRowsChange?.(next);
  };
  const Container = embedded ? 'section' : 'main';
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (i: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((_, k) => k !== i) : rs));

  const submit = () => {
    setError(null);
    // Пустые строки (без названия и цены) не отправляем, человек мог добавить лишнюю
    const filled = rows.filter((r) => r.name.trim() || r.price.trim());
    if (filled.length === 0) {
      setError(msg('Добавьте хотя бы одну категорию номеров с ценой.'));
      return;
    }
    const categories: OnboardingCategoryInput[] = filled.map((r) => ({
      name: r.name.trim(),
      kind: r.kind,
      capacityAdults: Number(r.capacityAdults),
      units: Number(r.units),
      // тенге → тиыны; округляем на всякий случай
      priceMinor: Math.round(Number(r.price) * 100),
    }));
    start(async () => {
      const result = await provisionHotel(categories);
      setError(result.error);
    });
  };

  return (
    <Container className="onboarding" id={embedded ? undefined : 'main-content'}>
      {!embedded && (
        <header className="onboarding__head">
          {/* Путь нового аккаунта (ADR-100): почта подтверждена → номера и цены → знакомство со стойкой */}
          <ol className="onboarding__steps" aria-label={t('Путь до работы')}>
            <li className="is-done">{t('Почта подтверждена')}</li>
            <li aria-current="step">{t('Номера и цены')}</li>
            <li>{t('Знакомство со стойкой')}</li>
          </ol>
          <h1>{t('Настройте отель')}</h1>
          <p>
            {t(
              'Заведите номера и цены, и можно принимать гостей. Всё это потом меняется в настройках. Нет времени сейчас, нажмите «Заполнить позже»: стойка откроется, а Главная напомнит об этом шаге.',
            )}
          </p>
        </header>
      )}

      <section className="onboarding__section" aria-label={t('Отель')}>
        <h2>{t('Отель')}</h2>
        <div className="onboarding__hotel">
          <Field label={t('Название')}>
            <Input value={hotelName} readOnly aria-readonly="true" />
          </Field>
          <Field label={t('Валюта')}>
            <Input value={currency} readOnly aria-readonly="true" />
          </Field>
        </div>
        <p className="onboarding__hint">
          {t('Название и реквизиты можно изменить в настройках объекта.')}
        </p>
      </section>

      <fieldset disabled={readOnly} style={{ border: 0, padding: 0 }}>
        <section className="onboarding__section" aria-label={t('Номера и цены')}>
          <h2>{t('Номера и цены')}</h2>
          <div className="onboarding__rows" role="list">
            {rows.map((r, i) => (
              <div className="onboarding__row" role="listitem" key={i}>
                <Field label={t('Название категории')}>
                  <Input
                    value={r.name}
                    placeholder={t('Двухместный номер')}
                    maxLength={100}
                    onChange={(e) => setRow(i, { name: e.target.value })}
                  />
                </Field>
                <Field label={t('Тип')}>
                  <Select
                    value={r.kind}
                    onChange={(e) => setRow(i, { kind: e.target.value as Kind })}
                  >
                    {KINDS.map(([id, label]) => (
                      <option key={id} value={id}>
                        {t(label)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('Гостей на место')}>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={r.capacityAdults}
                    onChange={(e) => setRow(i, { capacityAdults: e.target.value })}
                  />
                </Field>
                <Field label={t('Сколько мест')}>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={r.units}
                    onChange={(e) => setRow(i, { units: e.target.value })}
                  />
                </Field>
                <Field label={t('Цена за ночь, {currency}', { currency })}>
                  <Input
                    type="number"
                    min={0}
                    value={r.price}
                    placeholder="21000"
                    onChange={(e) => setRow(i, { price: e.target.value })}
                  />
                </Field>
                <button
                  type="button"
                  className="onboarding__remove"
                  aria-label={t('Убрать категорию {n}', { n: i + 1 })}
                  disabled={rows.length === 1}
                  onClick={() => removeRow(i)}
                >
                  <Icon name="close" width={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--secondary onboarding__add" onClick={addRow}>
            <Icon name="plus" width={16} />
            {t('Добавить категорию')}
          </button>
        </section>
      </fieldset>
      {error && <Alert boxed>{t(error)}</Alert>}

      <div className="onboarding__actions">
        <form action={postponeOnboarding}>
          <Button
            tone="ghost"
            type="submit"
            disabled={pending || readOnly}
            data-testid="onboarding-later"
          >
            {t('Заполнить позже')}
          </Button>
        </form>
        <Button onClick={submit} disabled={pending || readOnly} aria-busy={pending}>
          {pending ? t('Запускаем…') : t('Запустить отель')}
          <Icon name="arrow" width={16} />
        </Button>
      </div>
    </Container>
  );
}
