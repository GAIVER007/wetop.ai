'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CashBalances, CashCategory } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { useConfirm } from '../../components/use-confirm';
import { Alert, Badge, Button, Field, Input, Select, Stat, Table, Textarea } from '../../components/ui';
import { METHOD_RU } from './labels';
import {
  cashOperationAction,
  cashTransferAction,
  createCashCategoryAction,
  toggleCashCategoryAction,
  voidCashOperationAction,
  type CashActionResult,
} from './cash-actions';

const NONE: CashActionResult = { error: null, ok: 0 };
type Drawer = 'income' | 'expense' | 'transfer' | 'categories' | null;

/**
 * Касса (DATA_MODEL §21, план plans/finance-cashbox-2026-10-02.md): остатки по способам за всё время,
 * поступление и расход мимо счетов гостей, перевод между способами, статьи. Гостевые оплаты в кассу не
 * дублируются — остаток считает их сам, поэтому «оплата брони» принимается на счёте брони, а не здесь.
 */
export function CashPanel({
  cash,
  categories,
  cashOpsHref,
  editable,
  maySettings,
}: {
  cash: CashBalances;
  categories: CashCategory[];
  /** вкладка «Операции» с отбором «Касса» — общая лента вместо второго списка */
  cashOpsHref: string;
  editable: boolean;
  maySettings: boolean;
}) {
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const cur = cash.currency;
  const open = (d: Drawer) => {
    setSaved(null);
    setDrawer(d);
  };
  const onSaved = (text: string) => {
    setSaved(text);
    setDrawer(null);
  };
  return (
    <section className="finance-block cash" aria-label="Касса" data-testid="finance-cash">
      <div className="cash-toolbar">
        {editable && (
          <>
            <Button type="button" onClick={() => open('income')} data-testid="cash-income-btn">
              <Icon name="plus" />
              Поступление
            </Button>
            <Button type="button" tone="secondary" onClick={() => open('expense')} data-testid="cash-expense-btn">
              <Icon name="receipt" />
              Расход
            </Button>
            <Button type="button" tone="secondary" onClick={() => open('transfer')} data-testid="cash-transfer-btn">
              <Icon name="refresh" />
              Перевод
            </Button>
          </>
        )}
        {maySettings && (
          <Button type="button" tone="ghost" onClick={() => open('categories')} data-testid="cash-categories-btn">
            Статьи
          </Button>
        )}
        <span className="settings-save-state settings-save-state--saved" role="status" data-testid="cash-saved">
          {saved ? `✓ ${saved}` : ''}
        </span>
      </div>
      <div className="cash-tiles" data-testid="cash-tiles">
        <Stat label="Всего в кассе" value={formatMoney(cash.totalMinor, cur)} testId="cash-total" />
        {cash.balances.map((b) => (
          <Stat
            key={b.method}
            label={METHOD_RU[b.method] ?? b.method}
            value={formatMoney(b.balanceMinor, cur)}
            testId={`cash-${b.method}`}
          />
        ))}
      </div>
      <p className="finance-note">
        Остатки — за всё время: оплаты гостей по способу, минус возвраты, плюс операции кассы.{' '}
        <Link href={cashOpsHref} data-testid="cash-ops-link">
          Движения кассы за период — во вкладке «Операции»
        </Link>
        .
      </p>
      {drawer === 'income' || drawer === 'expense' ? (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={drawer === 'income' ? 'Поступление' : 'Расход'}
          onClose={() => setDrawer(null)}
        >
          <OperationForm
            kind={drawer === 'income' ? 'INCOME' : 'EXPENSE'}
            categories={categories}
            onCancel={() => setDrawer(null)}
            onSaved={onSaved}
          />
        </Overlay>
      ) : null}
      {drawer === 'transfer' && (
        <Overlay open drawer className="settings-service-drawer" title="Перевод между способами" onClose={() => setDrawer(null)}>
          <TransferForm onCancel={() => setDrawer(null)} onSaved={onSaved} />
        </Overlay>
      )}
      {drawer === 'categories' && (
        <Overlay open drawer className="settings-service-drawer" title="Статьи кассы" onClose={() => setDrawer(null)}>
          <Categories categories={categories} />
        </Overlay>
      )}
    </section>
  );
}

/** Способы, которыми касса оперирует (Q-237): без площадки, депозита и гарантии картой */
const CASH_METHOD_OPTIONS = [
  'CASH',
  'KASPI',
  'HALYK',
  'CARD_TERMINAL',
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
] as const;

function MethodSelect({ name, label, testId }: { name: string; label: string; testId?: string }) {
  return (
    <Field label={label}>
      <Select name={name} defaultValue="CASH" data-testid={testId}>
        {CASH_METHOD_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {METHOD_RU[m]}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Необязательная комиссия: сумма или процент — заполняют одно из двух */
function CommissionFields() {
  return (
    <div className="cash-commission">
      <Field label="Комиссия, сумма">
        <Input name="commissionAmount" inputMode="decimal" placeholder="0" />
      </Field>
      <Field label="или %">
        <Input name="commissionPercent" inputMode="decimal" placeholder="0" />
      </Field>
    </div>
  );
}

function FormFooter({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="settings-service-actions">
      <Button type="button" tone="secondary" onClick={onCancel}>
        Отмена
      </Button>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Сохраняю…' : 'Сохранить'}
      </Button>
    </div>
  );
}

function useSavedEffect(state: CashActionResult, onSaved: (text: string) => void) {
  const reported = useRef<number>(0);
  useEffect(() => {
    if (!state.ok || reported.current === state.ok) return;
    reported.current = state.ok;
    onSaved(state.message ?? 'Записано.');
  }, [state, onSaved]);
}

function OperationForm({
  kind,
  categories,
  onCancel,
  onSaved,
}: {
  kind: 'INCOME' | 'EXPENSE';
  categories: CashCategory[];
  onCancel: () => void;
  onSaved: (text: string) => void;
}) {
  const [state, action, pending] = useActionState(cashOperationAction, NONE);
  useSavedEffect(state, onSaved);
  const fit = categories.filter((c) => c.kind === kind && c.active);
  return (
    <form action={action} className="settings-service-form" data-testid="cash-operation-form">
      {state.error && <Alert boxed>{state.error}</Alert>}
      <input type="hidden" name="kind" value={kind} />
      <Field label="Сумма">
        <Input name="amount" inputMode="decimal" required autoFocus data-testid="cash-amount" />
      </Field>
      <MethodSelect name="method" label="Способ" testId="cash-method" />
      <Field label="Статья">
        <Select name="categoryId" defaultValue="" data-testid="cash-category">
          <option value="">— без статьи —</option>
          {fit.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <CommissionFields />
      <Field label="Комментарий">
        <Textarea name="note" rows={2} />
      </Field>
      <p className="settings-note">
        {kind === 'INCOME'
          ? 'Оплата брони сюда не записывается: её принимают на счёте брони («Найти бронь для оплаты»), и касса увидит её сама.'
          : 'Комиссия, если заполнена, запишется отдельным расходом по статье «Комиссия банка» вместе с этой операцией.'}
      </p>
      <FormFooter pending={pending} onCancel={onCancel} />
    </form>
  );
}

function TransferForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (text: string) => void }) {
  const [state, action, pending] = useActionState(cashTransferAction, NONE);
  useSavedEffect(state, onSaved);
  return (
    <form action={action} className="settings-service-form" data-testid="cash-transfer-form">
      {state.error && <Alert boxed>{state.error}</Alert>}
      <MethodSelect name="from" label="Откуда" testId="cash-from" />
      <MethodSelect name="to" label="Куда" testId="cash-to" />
      <Field label="Сумма">
        <Input name="amount" inputMode="decimal" required data-testid="cash-amount" />
      </Field>
      <CommissionFields />
      <Field label="Комментарий">
        <Textarea name="note" rows={2} />
      </Field>
      <p className="settings-note">
        Перевод перекладывает деньги между способами, итог кассы не меняется. Комиссия, если есть,
        спишется расходом со способа «Откуда».
      </p>
      <FormFooter pending={pending} onCancel={onCancel} />
    </form>
  );
}

/** Справочник статей: добавить и выключить; удаления нет — операциям остаётся след */
function Categories({ categories }: { categories: CashCategory[] }) {
  const [state, action, pending] = useActionState(createCashCategoryAction, NONE);
  return (
    <div className="cash-categories" data-testid="cash-categories">
      <form action={action} className="settings-service-form">
        {state.error && <Alert boxed>{state.error}</Alert>}
        {state.ok > 0 && !state.error && (
          <p role="status" className="settings-save-state settings-save-state--saved">
            ✓ Статья добавлена
          </p>
        )}
        <div className="cash-category-add">
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
        </div>
      </form>
      <Table size="sm" data-testid="cash-categories-table">
        <thead>
          <tr>
            <th>Статья</th>
            <th>Тип</th>
            <th>Статус</th>
            <th>
              <span className="sr-only">Действия</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.kind === 'INCOME' ? 'Доход' : 'Расход'}</td>
              <td>
                <Badge tone={c.active ? 'ok' : 'neutral'}>{c.active ? 'действует' : 'выключена'}</Badge>
              </td>
              <td>
                <form action={toggleCashCategoryAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={c.active ? 'false' : 'true'} />
                  <Button type="submit" tone="secondary">
                    {c.active ? 'Выключить' : 'Включить'}
                  </Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/** «Аннулировать» у операции кассы в общей ленте: вопрос с суммой, комиссия снимается вместе с основной */
export function VoidCashOperation({ id, summary }: { id: string; summary: string }) {
  const { ask, dialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      {dialog}
      <Button
        type="button"
        tone="ghost"
        disabled={busy}
        aria-busy={busy}
        data-testid="cash-void"
        onClick={async () => {
          if (
            !(await ask({
              title: 'Аннулировать операцию кассы?',
              body: `${summary}. Операция останется в списке со статусом «аннулирован», комиссия снимется вместе с ней.`,
              confirmLabel: 'Аннулировать',
              tone: 'danger',
            }))
          )
            return;
          setBusy(true);
          const r = await voidCashOperationAction(id);
          setBusy(false);
          setError(r.error);
        }}
      >
        Аннулировать
      </Button>
      {error && <Alert>{error}</Alert>}
    </>
  );
}
