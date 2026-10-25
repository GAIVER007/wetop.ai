'use client';
import { createContext, useActionState, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {cashDraftIntent} from './cash-draft-intent';
import type { CashBalances, CashCategory } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { useConfirm } from '../../components/use-confirm';
import { Alert, Button, Field, Input, Select, Stat, Textarea } from '../../components/ui';
import { METHOD_RU } from './labels';
import { displayDate } from '../../lib/display-date';
import { msg, type Translate } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
import {
  cashOperationAction,
  cashReconcileAction,
  cashTransferAction,
  voidCashOperationAction,
  voidPaymentAction,
  type CashActionResult,
} from './cash-actions';

const CashScopeContext = createContext('');
function useCashIntentAction(server: (prev: CashActionResult, fd: FormData)=>Promise<CashActionResult>, command: string) {
  const scope = useContext(CashScopeContext);
  return useActionState(async (prev: CashActionResult, fd: FormData) => {
    try {
      const intent = await cashDraftIntent(scope, command, fd);
      fd.set('idempotencyKey', intent.key);
      const result = await server(prev, fd);
      if (!result.error && result.ok !== prev.ok) intent.acknowledge();
      return result;
    } catch {
      return {error:msg('Не удалось подтвердить операцию. Повторите с тем же черновиком.'),ok:prev.ok};
    }
  }, NONE);
}
const NONE: CashActionResult = { error: null, ok: 0 };
type Drawer = 'operation' | 'income' | 'expense' | 'transfer' | 'reconcile' | null;

/**
 * Касса (DATA_MODEL §21, план plans/finance-cashbox-2026-10-02.md): остатки по способам за всё время,
 * поступление и расход мимо счетов гостей, перевод между способами, статьи. Гостевые оплаты в кассу не
 * дублируются — остаток считает их сам, поэтому «оплата брони» принимается на счёте брони, а не здесь.
 */
export function CashPanel({
  scopeKey,
  cash,
  categories,
  cashOpsHref,
  editable,
  maySettings,
  quickOnly = false,
}: {
  scopeKey: string;
  quickOnly?: boolean;
  cash: CashBalances;
  categories: CashCategory[];
  /** вкладка «Операции» с отбором «Касса» — общая лента вместо второго списка */
  cashOpsHref: string;
  editable: boolean;
  maySettings: boolean;
}) {
  const t = useT();
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
    <CashScopeContext.Provider value={scopeKey}>
    <CashMethodsContext.Provider value={methods}>
    <section
      className={quickOnly ? 'cash-quick' : 'finance-block cash'}
      aria-label={quickOnly ? t('Быстрые действия кассы') : t('Касса')}
      data-testid={quickOnly ? 'cash-quick' : 'finance-cash'}
    >
      <div className="cash-toolbar">
        {quickOnly && editable && (
          <>
            <Button type="button" onClick={() => open('operation')}>
              <Icon name="plus" />
              {t('Новая операция')}
            </Button>
            <Button type="button" tone="secondary" onClick={() => open('transfer')}>
              {t('Новый перевод')}
            </Button>
          </>
        )}
        {!quickOnly && editable && (
          <>
            <Button type="button" onClick={() => open('income')} data-testid="cash-income-btn">
              <Icon name="plus" />
              {t('Поступление')}
            </Button>
            <Button
              type="button"
              tone="secondary"
              onClick={() => open('expense')}
              data-testid="cash-expense-btn"
            >
              <Icon name="receipt" />
              {t('Расход')}
            </Button>
            <Button
              type="button"
              tone="secondary"
              onClick={() => open('transfer')}
              data-testid="cash-transfer-btn"
            >
              <Icon name="refresh" />
              {t('Перевод')}
            </Button>
            <Button
              type="button"
              tone="secondary"
              onClick={() => open('reconcile')}
              data-testid="cash-reconcile-btn"
            >
              <Icon name="check" />
              {t('Сверить')}
            </Button>
          </>
        )}
        {!quickOnly && maySettings && (
          <Link
            className="btn btn--ghost"
            href="/hotel-settings/directories#cash-categories"
            data-testid="cash-categories-btn"
          >
            {t('Статьи кассы')}
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
              label={t('Всего в кассе')}
              value={formatMoney(cash.totalMinor, cur)}
              testId="cash-total"
            />
            {cash.balances.map((b) => (
              <Stat
                key={b.method}
                label={t(METHOD_RU[b.method] ?? b.method)}
                value={formatMoney(b.balanceMinor, cur)}
                testId={`cash-${b.method}`}
              />
            ))}
          </div>
          <ReconciliationStatus cash={cash} />
          <details className="finance-disclosure">
            <summary>{t('Как считается остаток')}</summary>
            <p className="finance-note">
              {t('Остатки , за всё время: оплаты гостей по способу, минус возвраты, плюс операции кассы.')}{' '}
              <Link href={cashOpsHref} data-testid="cash-ops-link">
                {t('Движения кассы за период , во вкладке «Операции»')}
              </Link>
              .
            </p>
          </details>
        </>
      )}
      {drawer === 'operation' && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={t('Новая операция')}
          onClose={() => setDrawer(null)}
        >
          <div className="cash-toolbar">
            <Button type="button" onClick={() => open('income')}>
              {t('Поступление')}
            </Button>
            <Button type="button" tone="secondary" onClick={() => open('expense')}>
              {t('Расход')}
            </Button>
          </div>
        </Overlay>
      )}
      {drawer === 'income' || drawer === 'expense' ? (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={drawer === 'income' ? t('Поступление') : t('Расход')}
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
          title={t('Перевод между способами')}
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
          title={t('Сверка кассы')}
          onClose={() => setDrawer(null)}
        >
          <ReconcileForm cash={cash} onCancel={() => setDrawer(null)} onSaved={onSaved} />
        </Overlay>
      )}
    </section>
    </CashMethodsContext.Provider>
    </CashScopeContext.Provider>
  );
}

/** Расхождение сверки словами: «−500 ₸», «+70 ₸» или «совпало» */
function deltaText(expectedMinor: string, countedMinor: string, cur: string, t: Translate): string {
  const delta = BigInt(countedMinor) - BigInt(expectedMinor);
  if (delta === 0n) return t('совпало');
  return t('расхождение {sum}', { sum: `${delta > 0n ? '+' : '−'}${formatMoney(delta > 0n ? delta.toString() : (-delta).toString(), cur)}` });
}

/** Последняя сверка по способам (§21.4): наличные показываются всегда — их и пересчитывают */
function ReconciliationStatus({ cash }: { cash: CashBalances }) {
  const t = useT();
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
              {t('{method}: ещё не сверялись', { method: t(METHOD_RU[method] ?? method) })}
            </li>
          );
        const [day = '', time = ''] = rec.localAt.split(' ');
        return (
          <li key={method}>
            <Icon name="check" />
            {t('{method}: сверено {date}, {time}', { method: t(METHOD_RU[method] ?? method), date: displayDate(day), time })} —{' '}
            {deltaText(rec.expectedMinor, rec.countedMinor, cash.currency, t)}
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
  const t = useT();
  const [state, action, pending] = useCashIntentAction(cashReconcileAction, 'reconcile');
  useSavedEffect(state, onSaved);
  // сверяют то, что лежит плитками: включённые по умолчанию и способы с движениями
  const [method, setMethod] = useState(cash.balances[0]?.method ?? 'CASH');
  const expected = cash.balances.find((b) => b.method === method)?.balanceMinor ?? '0';
  return (
    <form action={action} className="settings-service-form" data-testid="cash-reconcile-form" noValidate>
      {state.error && <Alert boxed>{t(state.error)}</Alert>}
      <Field label={t('Способ')}>
        <Select
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          data-testid="cash-reconcile-method"
        >
          {cash.balances.map((b) => (
            <option key={b.method} value={b.method}>
              {t(METHOD_RU[b.method] ?? b.method)}
            </option>
          ))}
        </Select>
      </Field>
      <p className="settings-note" data-testid="cash-expected">
        {t('По системе:')} <strong>{formatMoney(expected, cash.currency)}</strong>
      </p>
      <Field label={t('Фактически пересчитано')}>
        <Input name="counted" inputMode="decimal" required autoFocus data-testid="cash-counted" />
      </Field>
      <label className="cash-adjust">
        <input type="checkbox" name="adjust" defaultChecked />
        {t('Выровнять остаток поправкой')}
      </label>
      <Field label={t('Комментарий')}>
        <Textarea name="note" rows={2} />
      </Field>
      <p className="settings-note">
        {t('Запишется снимок «по системе» и факт. С галочкой расхождение ляжет отдельной операцией — «Недостача кассы» или «Излишек кассы»; без неё останется только запись сверки.')}
      </p>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onCancel}>
          {t('Отмена')}
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? t('Сохраняю…') : t('Записать сверку')}
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
  const t = useT();
  const methods = useContext(CashMethodsContext);
  return (
    <Field label={label}>
      <Select name={name} defaultValue={methods[0] ?? 'CASH'} data-testid={testId}>
        {methods.map((m) => (
          <option key={m} value={m}>
            {t(METHOD_RU[m] ?? m)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Необязательная комиссия: сумма или процент — заполняют одно из двух */
function CommissionFields() {
  const t = useT();
  return (
    <div className="cash-commission">
      <Field label={t('Комиссия, сумма')}>
        <Input name="commissionAmount" inputMode="decimal" placeholder="0" />
      </Field>
      <Field label={t('или %')}>
        <Input name="commissionPercent" inputMode="decimal" placeholder="0" />
      </Field>
    </div>
  );
}

function FormFooter({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  const t = useT();
  return (
    <div className="settings-service-actions">
      <Button type="button" tone="secondary" onClick={onCancel}>
        {t('Отмена')}
      </Button>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? t('Сохраняю…') : t('Сохранить')}
      </Button>
    </div>
  );
}

function useSavedEffect(state: CashActionResult, onSaved: (text: string) => void) {
  const t = useT();
  const reported = useRef<number>(0);
  useEffect(() => {
    if (!state.ok || reported.current === state.ok) return;
    reported.current = state.ok;
    onSaved(state.message ? t(state.message) : t('Записано.'));
  }, [state, onSaved, t]);
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
  const t = useT();
  const [state, action, pending] = useCashIntentAction(cashOperationAction, 'operation');
  useSavedEffect(state, onSaved);
  const fit = categories.filter((c) => c.kind === kind && c.active);
  return (
    <form action={action} className="settings-service-form" data-testid="cash-operation-form" noValidate>
      {state.error && <Alert boxed>{t(state.error)}</Alert>}
      <input type="hidden" name="kind" value={kind} />
      <Field label={t('Сумма')}>
        <Input name="amount" inputMode="decimal" required autoFocus data-testid="cash-amount" />
      </Field>
      <MethodSelect name="method" label={t('Способ')} testId="cash-method" />
      <Field label={t('Статья')}>
        <Select name="categoryId" defaultValue="" data-testid="cash-category">
          <option value="">{t('— без статьи —')}</option>
          {fit.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <CommissionFields />
      <Field label={t('Комментарий')}>
        <Textarea name="note" rows={2} />
      </Field>
      <p className="settings-note">
        {kind === 'INCOME'
          ? t('Оплата брони сюда не записывается: её принимают на счёте брони («Найти бронь для оплаты»), и касса увидит её сама.')
          : t('Комиссия, если заполнена, запишется отдельным расходом по статье «Комиссия банка» вместе с этой операцией.')}
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
  const t = useT();
  const [state, action, pending] = useCashIntentAction(cashTransferAction, 'transfer');
  useSavedEffect(state, onSaved);
  return (
    <form action={action} className="settings-service-form" data-testid="cash-transfer-form" noValidate>
      {state.error && <Alert boxed>{t(state.error)}</Alert>}
      <MethodSelect name="from" label={t('Откуда')} testId="cash-from" />
      <MethodSelect name="to" label={t('Куда')} testId="cash-to" />
      <Field label={t('Сумма')}>
        <Input name="amount" inputMode="decimal" required data-testid="cash-amount" />
      </Field>
      <CommissionFields />
      <Field label={t('Комментарий')}>
        <Textarea name="note" rows={2} />
      </Field>
      <p className="settings-note">
        {t('Перевод перекладывает деньги между способами, итог кассы не меняется. Комиссия, если есть, спишется расходом со способа «Откуда».')}
      </p>
      <FormFooter pending={pending} onCancel={onCancel} />
    </form>
  );
}

/** «Аннулировать» у платежа гостя в общей ленте: вопрос с суммой; с возвратом или чеком API откажет словами */
export function VoidPaymentOperation({ id, summary }: { id: string; summary: string }) {
  const t = useT();
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
              title: t('Аннулировать платёж?'),
              body: t('{summary}. Платёж останется в ленте со статусом «аннулирован», сумма вернётся в остаток брони к оплате. Поменять способ или сумму можно в карточке брони.', { summary }),
              confirmLabel: t('Аннулировать'),
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
        {t('Аннулировать')}
      </Button>
      {error && <Alert>{error}</Alert>}
    </>
  );
}

/** «Аннулировать» у операции кассы в общей ленте: вопрос с суммой, комиссия снимается вместе с основной */
export function VoidCashOperation({ id, summary }: { id: string; summary: string }) {
  const t = useT();
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
              title: t('Аннулировать операцию кассы?'),
              body: t('{summary}. Операция останется в списке со статусом «аннулирован», комиссия снимется вместе с ней.', { summary }),
              confirmLabel: t('Аннулировать'),
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
        {t('Аннулировать')}
      </Button>
      {error && <Alert>{error}</Alert>}
    </>
  );
}
