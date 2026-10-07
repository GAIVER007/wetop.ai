'use client';
import { useActionState, useEffect, useState } from 'react';
import { PAYMENT_METHOD_RU } from '@pms/domain';
import type { CashCategory, PaymentMethodSettingRow } from '../../lib/api';
import { Alert, Badge, Button, Field, Input, Select, Table } from '../../components/ui';
import { saveCashCategory, savePaymentMethods, type DirectoryActionResult } from './actions';
import { SETTINGS_FORM_ID, useSaveReport } from './settings-save';

/**
 * «Справочники» в «Настройках объекта» (DATA_MODEL §21.6, ADR-152, план plans/property-directories-2026-10-07.md):
 * способы оплаты, которые объект принимает, и их порядок; статьи кассы. Способы остаются системными кодами,
 * объект их включает, выключает и упорядочивает; выключенный не предлагается при приёме денег, история не меняется.
 */
const same = (a: PaymentMethodSettingRow[], b: PaymentMethodSettingRow[]) =>
  JSON.stringify(a) === JSON.stringify(b);
const label = (method: string) => PAYMENT_METHOD_RU[method] ?? method;

export function PaymentMethodsForm({
  stored,
  editable,
}: {
  stored: PaymentMethodSettingRow[];
  editable: boolean;
}) {
  const [list, setList] = useState(stored);
  const [state, action, pending] = useActionState<DirectoryActionResult | null, FormData>(
    savePaymentMethods,
    null,
  );
  // после сохранения запись объекта перечитана: список снова равен сохранённому
  useEffect(() => setList(stored), [stored]);
  const dirty = !same(list, stored);
  useSaveReport({ dirty, pending, saved: !!state?.message && !dirty });
  const none = !list.some((m) => m.enabled);
  const move = (i: number, d: -1 | 1) =>
    setList((was) => {
      const j = i + d;
      if (j < 0 || j >= was.length) return was;
      const next = [...was];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const toggle = (i: number) =>
    setList((was) => was.map((m, k) => (k === i ? { ...m, enabled: !m.enabled } : m)));
  if (!editable)
    return (
      <Table size="sm" className="settings-directory-table" data-testid="payment-methods-table" aria-label="Список способов оплаты">
        <thead>
          <tr>
            <th>Способ</th>
            <th>Принимаем</th>
          </tr>
        </thead>
        <tbody>
          {stored.map((m) => (
            <tr key={m.method} data-testid="payment-method-row" data-method={m.method}>
              <td>{label(m.method)}</td>
              <td>
                <Badge tone={m.enabled ? 'ok' : 'neutral'}>{m.enabled ? 'да' : 'нет'}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  return (
    <form id={SETTINGS_FORM_ID} action={action} data-testid="payment-methods-form">
      <input type="hidden" name="methods" value={JSON.stringify(list)} />
      {state?.error && <Alert boxed>{state.error}</Alert>}
      {none && <Alert boxed>Хотя бы один способ оплаты должен быть включён</Alert>}
      <Table size="sm" className="settings-directory-table" data-testid="payment-methods-table" aria-label="Список способов оплаты">
        <thead>
          <tr>
            <th>Способ</th>
            <th>Принимаем</th>
            <th>
              <span className="sr-only">Порядок</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((m, i) => (
            <tr
              key={m.method}
              data-testid="payment-method-row"
              data-method={m.method}
              data-enabled={m.enabled ? 'true' : 'false'}
            >
              <td>{label(m.method)}</td>
              <td>
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    onChange={() => toggle(i)}
                    aria-label={`Принимаем: ${label(m.method)}`}
                    data-testid="payment-method-toggle"
                  />
                  {m.enabled ? 'да' : 'нет'}
                </label>
              </td>
              <td className="settings-order">
                <Button
                  type="button"
                  tone="ghost"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Выше: ${label(m.method)}`}
                >
                  Выше
                </Button>
                <Button
                  type="button"
                  tone="ghost"
                  disabled={i === list.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Ниже: ${label(m.method)}`}
                >
                  Ниже
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="settings-note">
        Выключенный способ не предлагается при приёме оплаты, в кассе и в запросах оплаты. Прошлые
        платежи, отчёты и сверка не меняются. Платёж площадки (внешний канал) ставят каналы продаж, он
        здесь не настраивается.
      </p>
    </form>
  );
}

const IDLE: DirectoryActionResult | null = null;

/** Статьи кассы: добавить, переименовать, выключить; удаления нет, прошлые операции хранят статью */
const kindRu = (kind: string) => (kind === 'INCOME' ? 'Доход' : 'Расход');

export function CashCategoriesEditor({
  categories,
  editable,
}: {
  categories: CashCategory[];
  editable: boolean;
}) {
  const [state, action, pending] = useActionState<DirectoryActionResult | null, FormData>(
    saveCashCategory,
    IDLE,
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  useEffect(() => {
    if (state?.message) setRenaming(null);
  }, [state]);
  return (
    <div className="settings-directory" data-testid="cash-categories-editor">
      {editable && (
        <form action={action} className="settings-category-add" data-testid="cash-category-form">
          {state?.error && !renaming && <Alert boxed>{state.error}</Alert>}
          {state?.message && (
            <p role="status" className="settings-save-state settings-save-state--saved">
              ✓ {state.message}
            </p>
          )}
          <Field label="Тип">
            <Select name="kind" defaultValue="EXPENSE">
              <option value="EXPENSE">Расход</option>
              <option value="INCOME">Доход</option>
            </Select>
          </Field>
          <Field label="Название">
            <Input name="name" required maxLength={80} data-testid="cash-category-name" />
          </Field>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            Добавить
          </Button>
        </form>
      )}
      <Table size="sm" className="settings-directory-table" data-testid="cash-categories-table" aria-label="Список статей кассы">
        <thead>
          <tr>
            <th>Статья</th>
            <th className="settings-col-wide">Тип</th>
            <th className="settings-col-wide">Статус</th>
            {editable && (
              <th>
                <span className="sr-only">Действия</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} data-testid="cash-category-row">
              <td>
                {editable && renaming === c.id ? (
                  <RenameForm category={c} onDone={() => setRenaming(null)} />
                ) : (
                  c.name
                )}
                {/* на телефоне колонки типа и статуса скрыты, те же слова строкой под названием (как у «Сотрудников») */}
                <span className="settings-row-sub">
                  {kindRu(c.kind)}, {c.active ? 'действует' : 'выключена'}
                </span>
              </td>
              <td className="settings-col-wide">{kindRu(c.kind)}</td>
              <td className="settings-col-wide">
                <Badge tone={c.active ? 'ok' : 'neutral'}>
                  {c.active ? 'действует' : 'выключена'}
                </Badge>
              </td>
              {editable && (
                <td className="settings-order">
                  {renaming !== c.id && (
                    <Button type="button" tone="ghost" onClick={() => setRenaming(c.id)}>
                      Переименовать
                    </Button>
                  )}
                  <ToggleForm category={c} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function RenameForm({ category, onDone }: { category: CashCategory; onDone: () => void }) {
  const [state, action, pending] = useActionState<DirectoryActionResult | null, FormData>(
    saveCashCategory,
    IDLE,
  );
  useEffect(() => {
    if (state?.message) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="settings-rename" data-testid="cash-category-rename">
      <input type="hidden" name="id" value={category.id} />
      <Field label={`Новое название: ${category.name}`}>
        <Input name="name" defaultValue={category.name} required maxLength={80} autoFocus />
      </Field>
      {state?.error && <Alert boxed>{state.error}</Alert>}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        Сохранить
      </Button>
      <Button type="button" tone="ghost" onClick={onDone}>
        Отмена
      </Button>
    </form>
  );
}

function ToggleForm({ category }: { category: CashCategory }) {
  const [state, action, pending] = useActionState<DirectoryActionResult | null, FormData>(
    saveCashCategory,
    IDLE,
  );
  return (
    <form action={action} className="settings-inline-form">
      <input type="hidden" name="id" value={category.id} />
      <input type="hidden" name="active" value={category.active ? 'false' : 'true'} />
      {state?.error && <Alert boxed>{state.error}</Alert>}
      <Button type="submit" tone="secondary" disabled={pending} aria-busy={pending}>
        {category.active ? 'Выключить' : 'Включить'}
      </Button>
    </form>
  );
}
