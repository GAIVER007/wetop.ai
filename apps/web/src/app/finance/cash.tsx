'use client';
import { createContext, useActionState, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CashBalances, CashCategory } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { useConfirm } from '../../components/use-confirm';
import { Alert, Button, Field, Input, Select, Stat, Textarea } from '../../components/ui';
import { METHOD_RU } from './labels';
import { displayDate } from '../../lib/display-date';
import {
  cashOperationAction,
  cashReconcileAction,
  cashTransferAction,
  voidCashOperationAction,
  voidPaymentAction,
  type CashActionResult,
} from './cash-actions';

const NONE: CashActionResult = { error: null, ok: 0 };
type Drawer = 'operation' | 'income' | 'expense' | 'transfer' | 'reconcile' | null;

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
  quickOnly = false,
}: {
  quickOnly?: boolean;
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
  const methods = cash.paymentMethods ?? CASH_METHOD_OPTIONS;
  return (
    <CashMethodsContext.Provider value={methods}>
    <section
      className={quickOnly ? 'cash-quick' : 'finance-block cash'}
      aria-label={quickOnly ? 'Быстрые действия кассы' : 'Касса'}
      data-testid={quickOnly ? 'cash-quick' : 'finance-cash'}
    >
      <div className="cash-toolbar">
        {quickOnly && editable && (
          <>
            <Button type="button" onClick={() => open('operation')}>
              <Icon name="plus" />
              Новая операция
            </Button>
            <Button type="button" tone="secondary" onClick={() => open('transfer')}>
              Новый перевод
            </Button>
          </>
        )}
        {!quickOnly && editable && (
          <>
            <Button type="button" onClick={() => open('income')} data-testid="cash-income-btn">
              <Icon name="plus" />
              Поступление
            </Button>
            <Button
              type="button"
              tone="secondary"
              onClick={() => open('expense')}
              data-testid="cash-expense-btn"
            >
              <Icon name="receipt" />
              Расход
            </Button>
            <Button
              type="button"
              tone="secondary"
              onClick={() => open('transfer')}
              data-testid="cash-transfer-btn"
            >
              <Icon name="refresh" />
              Перевод
            </Button>
            <Button
              type="button"
              tone="secondary"
              onClick={() => open('reconcile')}
              data-testid="cash-reconcile-btn"
            >
              <Icon name="check" />
              Сверить
            </Button>
          </>
        )}
        {!quickOnly && maySettings && (
          <Link
            className="btn btn--ghost"
            href="/hotel-settings/directories#cash-categories"
            data-testid="cash-categories-btn"
          >
            Статьи кассы
          </Link>
        )}
        <span
          className="settings-save-state settings-save-state--saved"
          role="status"
          data-testid={quickOnly ? 'cash-quick-saved' : 'cash-saved'}
        >
          {saved ? `✓ ${saved}` : ''}
        </span>
      </div>
      {!quickOnly && (
        <>
          <div className="cash-tiles" data-testid="cash-tiles">
            <Stat
              label="Всего в кассе"
              value={formatMoney(cash.totalMinor, cur)}
              testId="cash-total"
            />
            {cash.balances.map((b) => (
              <Stat
                key={b.method}
                label={METHOD_RU[b.method] ?? b.method}
                value={formatMoney(b.balanceMinor, cur)}
                testId={`cash-${b.method}`}
              />
            ))}
          </div>
          <ReconciliationStatus cash={cash} />
          <p className="finance-note">
            Остатки — за всё время: оплаты гостей по способу, минус возвраты, плюс операции кассы.{' '}
            <Link href={cashOpsHref} data-testid="cash-ops-link">
              Движения кассы за период — во вкладке «Операции»
            </Link>
            .
          </p>
        </>
      )}
      {drawer === 'operation' && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title="Новая операция"
          onClose={() => setDrawer(null)}
        >
          <div className="cash-toolbar">
            <Button type="button" onClick={() => open('income')}>
              Поступление
            </Button>
            <Button type="button" tone="secondary" onClick={() => open('expense')}>
              Расход
            </Button>
          </div>
        </Overlay>
      )}
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
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title="Перевод между способами"
          onClose={() => setDrawer(null)}
        >
          <TransferForm onCancel={() => setDrawer(null)} onSaved={onSaved} />
        </Overlay>
      )}
      {drawer === 'reconcile' && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title="Сверка кассы"
          onClose={() => setDrawer(null)}
        >
          <ReconcileForm cash={cash} onCancel={() => setDrawer(null)} onSaved={onSaved} />
        </Overlay>
      )}
    </section>
    </CashMethodsContext.Provider>
  );
}

/** Расхождение сверки словами: «−500 ₸», «+70 ₸» или «совпало» */
function deltaText(expectedMinor: string, countedMinor: string, cur: string): string {
  const delta = BigInt(countedMinor) - BigInt(expectedMinor);
  if (delta === 0n) return 'совпало';
  return `расхождение ${delta > 0n ? '+' : '−'}${formatMoney(delta > 0n ? delta.toString() : (-delta).toString(), cur)}`;
}

/** Последняя сверка по способам (§21.4): наличные показываются всегда — их и пересчитывают */
function ReconciliationStatus({ cash }: { cash: CashBalances }) {
  const byMethod = new Map(cash.reconciliations.map((r) => [r.method, r]));
  const methods = [
    'CASH',
    ...cash.reconciliations.map((r) => r.method).filter((m) => m !== 'CASH'),
  ];
  return (
    <ul className="cash-reconciliation-status" data-testid="cash-reconciliation-status">
      {methods.map((method) => {
        const rec = byMethod.get(method);
        if (!rec)
          return (
            <li key={method}>
              <Icon name="clock" />
              {METHOD_RU[method] ?? method}: ещё не сверялись
            </li>
          );
        const [day = '', time = ''] = rec.localAt.split(' ');
        return (
          <li key={method}>
            <Icon name="check" />
            {METHOD_RU[method] ?? method}: сверено {displayDate(day)}, {time} —{' '}
            {deltaText(rec.expectedMinor, rec.countedMinor, cash.currency)}
          </li>
        );
      })}
    </ul>
  );
}

/** Пересчёт кассы: «по системе» — текущий остаток способа, расхождение выравнивается поправкой по галочке */
function ReconcileForm({
  cash,
  onCancel,
  onSaved,
}: {
  cash: CashBalances;
  onCancel: () => void;
  onSaved: (text: string) => void;
}) {
  const [state, action, pending] = useActionState(cashReconcileAction, NONE);
  useSavedEffect(state, onSaved);
  // сверяют то, что лежит плитками: включённые по умолчанию и способы с движениями
  const [method, setMethod] = useState(cash.balances[0]?.method ?? 'CASH');
  const expected = cash.balances.find((b) => b.method === method)?.balanceMinor ?? '0';
  return (
    <form action={action} className="settings-service-form" data-testid="cash-reconcile-form">
      {state.error && <Alert boxed>{state.error}</Alert>}
      <Field label="Способ">
        <Select
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          data-testid="cash-reconcile-method"
        >
          {cash.balances.map((b) => (
            <option key={b.method} value={b.method}>
              {METHOD_RU[b.method]}
            </option>
          ))}
        </Select>
      </Field>
      <p className="settings-note" data-testid="cash-expected">
        По системе: <strong>{formatMoney(expected, cash.currency)}</strong>
      </p>
      <Field label="Фактически пересчитано">
        <Input name="counted" inputMode="decimal" required autoFocus data-testid="cash-counted" />
      </Field>
      <label className="cash-adjust">
        <input type="checkbox" name="adjust" defaultChecked />
        Выровнять остаток поправкой
      </label>
      <Field label="Комментарий">
        <Textarea name="note" rows={2} />
      </Field>
      <p className="settings-note">
        Запишется снимок «по системе» и факт. С галочкой расхождение ляжет отдельной операцией —
        «Недостача кассы» или «Излишек кассы»; без неё останется только запись сверки.
      </p>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Сохраняю…' : 'Записать сверку'}
        </Button>
      </div>
    </form>
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
/** Включённые способы кассы объекта (DATA_MODEL §21.6): старый API без поля даёт все шесть */
const CashMethodsContext = createContext<readonly string[]>(CASH_METHOD_OPTIONS);

function MethodSelect({ name, label, testId }: { name: string; label: string; testId?: string }) {
  const methods = useContext(CashMethodsContext);
  return (
    <Field label={label}>
      <Select name={name} defaultValue={methods[0] ?? 'CASH'} data-testid={testId}>
        {methods.map((m) => (
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

function TransferForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: (text: string) => void;
}) {
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

/** «Аннулировать» у платежа гостя в общей ленте: вопрос с суммой; с возвратом или чеком API откажет словами */
export function VoidPaymentOperation({ id, summary }: { id: string; summary: string }) {
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
        data-testid="payment-void"
        onClick={async () => {
          if (
            !(await ask({
              title: 'Аннулировать платёж?',
              body: `${summary}. Платёж останется в ленте со статусом «аннулирован», сумма вернётся в остаток брони к оплате. Поменять способ или сумму можно в карточке брони.`,
              confirmLabel: 'Аннулировать',
              tone: 'danger',
            }))
          )
            return;
          setBusy(true);
          const r = await voidPaymentAction(id);
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
