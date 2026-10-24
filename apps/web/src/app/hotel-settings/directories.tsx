'use client';
import { useActionState, useEffect, useState } from 'react';
import { PAYMENT_METHOD_RU } from '@pms/domain';
import type { CashCategory, PaymentMethodSettingRow } from '../../lib/api';
import { Alert, Badge, Button, Field, Input, Select, Table } from '../../components/ui';
import { saveCashCategory, savePaymentMethods, type DirectoryActionResult } from './actions';
import { SETTINGS_FORM_ID, useSaveReport } from './settings-save';

/**
 * «Справочники» в «Настройках объекта» (DATA_MODEL §21.6, ADR-185, план plans/property-directories-2026-10-07.md):
 * способы оплаты, которые объект принимает, и их порядок; статьи кассы. Способы остаются системными кодами,
 * объект их включает, выключает и упорядочивает; выключенный не предлагается при приёме денег, история не меняется.
 */
const same = (a: PaymentMethodSettingRow[], b: PaymentMethodSettingRow[]) =>
  JSON.stringify(a) === JSON.stringify(b);
const label = (method: string) => PAYMENT_METHOD_RU[method] ?? method;

export function PaymentMethodsForm({
  stored,
  editable,
  save = savePaymentMethods,
  scopeKey,
  note,
}: {
  stored: PaymentMethodSettingRow[];
  editable: boolean;
  /** действие сохранения: объект гостиницы (§21.6) по умолчанию, филиал салона и ресторана (§21.7) свой */
  save?: (prev: DirectoryActionResult | null, form: FormData) => Promise<DirectoryActionResult>;
  /** филиал, для которого открыта форма: действие сверяет его с текущим, чтобы не записать в чужой */
  scopeKey?: string;
  note?: string;
}) {
  const [list, setList] = useState(stored);
  const [state, action, pending] = useActionState<DirectoryActionResult | null, FormData>(save, null);
  // после сохранения запись объекта перечитана: список снова равен сохранённому
  useEffect(() => setList(stored), [stored]);
  const dirty = !same(list, stored);
  useSaveReport({ dirty, pending, saved: !!state?.message && !dirty });
  const none = !list.some((m) => m.enabled);
  // в таблице только принимаемые способы (22.10.2026, «добавить способ оплаты»): выключенные уходят в список
  // «Добавить»; в сохранении по-прежнему все коды, порядок выключенных за включёнными
  const shown = list.filter((m) => m.enabled);
  const hidden = list.filter((m) => !m.enabled);
  const [pick, setPick] = useState('');
  const chosen = hidden.some((m) => m.method === pick) ? pick : (hidden[0]?.method ?? '');
  const move = (method: string, d: -1 | 1) =>
    setList((was) => {
      const on = was.filter((m) => m.enabled);
      const i = on.findIndex((m) => m.method === method);
      const j = i + d;
      if (i < 0 || j < 0 || j >= on.length) return was;
      [on[i], on[j]] = [on[j]!, on[i]!];
      return [...on, ...was.filter((m) => !m.enabled)];
    });
  const setEnabled = (method: string, enabled: boolean) =>
    setList((was) => {
      const target = was.find((m) => m.method === method);
      if (!target) return was;
      const rest = was.filter((m) => m.method !== method);
      const on = rest.filter((m) => m.enabled);
      const off = rest.filter((m) => !m.enabled);
      return enabled ? [...on, { ...target, enabled: true }, ...off] : [...on, { ...target, enabled: false }, ...off];
    });
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
      {scopeKey && <input type="hidden" name="scopeKey" value={scopeKey} />}
      {state?.error && <Alert boxed>{state.error}</Alert>}
      {none && <Alert boxed>Хотя бы один способ оплаты должен быть включён</Alert>}
      <Table size="sm" className="settings-directory-table settings-payment-table" data-testid="payment-methods-table" aria-label="Список способов оплаты">
        <thead>
          <tr>
            <th>Способ</th>
            <th>
              <span className="sr-only">Действия</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((m, i) => (
            <tr key={m.method} data-testid="payment-method-row" data-method={m.method} data-enabled="true">
              <td>{label(m.method)}</td>
              <td className="settings-actions">
                <div className="settings-order">
                  <Button
                    type="button"
                    tone="ghost"
                    disabled={i === 0}
                    onClick={() => move(m.method, -1)}
                    aria-label={`Выше: ${label(m.method)}`}
                  >
                    Выше
                  </Button>
                  <Button
                    type="button"
                    tone="ghost"
                    disabled={i === shown.length - 1}
                    onClick={() => move(m.method, 1)}
                    aria-label={`Ниже: ${label(m.method)}`}
                  >
                    Ниже
                  </Button>
                  <Button
                    type="button"
                    tone="ghost"
                    onClick={() => setEnabled(m.method, false)}
                    aria-label={`Убрать: ${label(m.method)}`}
                    data-testid="payment-method-remove"
                  >
                    Убрать
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {hidden.length > 0 && (
        <div className="settings-category-add" data-testid="payment-method-add">
          <Field label="Добавить способ оплаты">
            <Select value={chosen} onChange={(e) => setPick(e.target.value)}>
              {hidden.map((m) => (
                <option key={m.method} value={m.method}>
                  {label(m.method)}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            type="button"
            tone="secondary"
            disabled={!chosen}
            onClick={() => chosen && setEnabled(chosen, true)}
            aria-label={chosen ? `Добавить способ: ${label(chosen)}` : 'Добавить способ'}
          >
            Добавить
          </Button>
        </div>
      )}
      <p className="settings-note">
        {note ??
          'Убранный способ не предлагается при приёме оплаты, в кассе и в запросах оплаты. Прошлые платежи, отчёты и сверка не меняются. Платёж площадки (внешний канал) ставят каналы продаж, он здесь не настраивается.'}
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
                <td className="settings-actions">
                  <div className="settings-order">
                    {renaming !== c.id && (
                      <Button type="button" tone="ghost" onClick={() => setRenaming(c.id)}>
                        Переименовать
                      </Button>
                    )}
                    <ToggleForm category={c} />
                  </div>
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
