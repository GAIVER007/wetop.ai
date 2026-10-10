'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import type { MarketingExpenseRow } from '../../../lib/api';
import { minorToInput } from '../../../lib/money';
import { Icon } from '../../../components/icon';
import { Overlay } from '../../../components/overlay';
import { useToast } from '../../../components/toast';
import { useConfirm } from '../../../components/use-confirm';
import { Switch } from '../../../components/switch';
import { Alert, Button, Field, Input, Select, Textarea } from '../../../components/ui';
import {
  deleteExpenseAction,
  saveExpenseAction,
  savePlanAction,
  type BudgetActionResult,
} from './actions';
import { CATEGORY_HINTS, PLATFORM_LABELS, monthTitle, platformLabel } from './parts';

const NONE: BudgetActionResult = { error: null, ok: 0 };

/** То же устройство, что у /market: уведомление сразу по ответу, панель закрывается эффектом */
function useBudgetAction(
  serverAction: (prev: BudgetActionResult, fd: FormData) => Promise<BudgetActionResult>,
  close: () => void,
) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(
    async (prev: BudgetActionResult, fd: FormData) => {
      const next = await serverAction(prev, fd);
      if (next.ok) toast({ text: next.message ?? 'Сохранено', tone: 'success' });
      return next;
    },
    NONE,
  );
  const seen = useRef(0);
  useEffect(() => {
    if (!state.ok || state.ok === seen.current) return;
    seen.current = state.ok;
    close();
  }, [state, close]);
  return [state, action, pending] as const;
}

/** «Добавить расход» и «Изменить»: одна форма (экран 4 макета); при правке внизу «Удалить» */
export function ExpenseButton({
  expense,
  defaults,
  primary,
}: {
  expense?: MarketingExpenseRow | undefined;
  defaults: { today: string; reportingCurrency: string; locationCurrency: string };
  primary?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        tone={expense ? 'ghost' : primary ? undefined : 'secondary'}
        size={expense ? 'xs' : undefined}
        onClick={() => setOpen(true)}
        data-testid={expense ? `budget-edit-${expense.id}` : 'budget-add'}
        aria-label={expense ? `Изменить расход: ${platformLabel(expense.platform)}, ${expense.date}` : undefined}
      >
        {!expense && <Icon name="plus" width={16} aria-hidden="true" />}
        {expense ? 'Изменить' : 'Добавить расход'}
      </Button>
      {open && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={expense ? 'Расход' : 'Новый расход'}
          onClose={() => setOpen(false)}
        >
          <ExpenseForm expense={expense} defaults={defaults} onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

function ExpenseForm({
  expense,
  defaults,
  onClose,
}: {
  expense?: MarketingExpenseRow | undefined;
  defaults: { today: string; reportingCurrency: string; locationCurrency: string };
  onClose: () => void;
}) {
  const [state, action, pending] = useBudgetAction(saveExpenseAction, onClose);
  const [deleted, remove, removing] = useBudgetAction(deleteExpenseAction, onClose);
  const { ask, dialog } = useConfirm();
  const deleteForm = useRef<HTMLFormElement>(null);
  const error = state.error ?? deleted.error;
  const v = (name: string, fallback: string | null | undefined) =>
    state.values?.[name] ?? (fallback ?? '');
  const currencies = [...new Set([defaults.reportingCurrency, defaults.locationCurrency, 'USD', 'EUR', 'RUB', expense?.currency ?? defaults.reportingCurrency])];
  const [currency, setCurrency] = useState(v('currency', expense?.currency ?? defaults.reportingCurrency));
  const foreign = currency !== defaults.reportingCurrency;
  return (
    <>
      <form action={action} className="settings-service-form" data-testid="budget-expense-form">
        {error && <Alert boxed>{error}</Alert>}
        {expense && <input type="hidden" name="id" value={expense.id} />}
        <Field label="Дата">
          <Input
            name="date"
            type="date"
            required
            defaultValue={v('date', expense?.date ?? defaults.today)}
            data-testid="budget-date"
          />
        </Field>
        <Field label="Платформа">
          <Select
            name="platform"
            required
            defaultValue={v('platform', expense?.platform ?? 'META')}
            data-testid="budget-platform"
          >
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Кампания" controlId="budget-campaign-input" hint="Необязательно: название кампании или поста">
          <Input name="campaign" maxLength={200} defaultValue={v('campaign', expense?.campaign)} data-testid="budget-campaign" />
        </Field>
        <Field label={`Сумма, ${currency}`}>
          <Input
            name="amount"
            inputMode="decimal"
            required
            defaultValue={v('amount', expense ? minorToInput(expense.amount) : '')}
            data-testid="budget-amount"
          />
        </Field>
        <Field label="Валюта">
          <Select
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            data-testid="budget-currency"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        {foreign && (
          <Field
            label={`Курс ${currency} к ${defaults.reportingCurrency}`}
            controlId="budget-fx-input"
            hint="На дату расхода; пересчёт запишется и не изменится задним числом"
          >
            <Input
              name="fxRate"
              inputMode="decimal"
              required
              defaultValue={v('fxRate', expense?.fxRate === '1' ? '' : expense?.fxRate)}
              data-testid="budget-fx"
            />
          </Field>
        )}
        <Field label="Статья">
          <>
            <Input
              name="category"
              required
              maxLength={100}
              list="budget-category-hints"
              defaultValue={v('category', expense?.category ?? 'Реклама')}
              data-testid="budget-category"
            />
            <datalist id="budget-category-hints">
              {CATEGORY_HINTS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        </Field>
        <Field label="Описание">
          <Textarea name="description" rows={2} maxLength={500} defaultValue={v('description', expense?.description)} />
        </Field>
        <Switch
          name="countedInBudget"
          label="Учитывать в бюджете"
          hint="Выключите для расходов вне плана: они останутся в журнале и аналитике"
          defaultChecked={state.values ? state.values['countedInBudget'] === 'true' : (expense?.countedInBudget ?? true)}
        />
        <div className="settings-service-actions">
          <Button type="button" tone="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending} data-testid="budget-save">
            {pending ? 'Сохраняю…' : expense ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </form>
      {expense && (
        <form ref={deleteForm} action={remove} className="budget-delete">
          <input type="hidden" name="id" value={expense.id} />
          <p className="settings-note">
            Удаление попадёт в журнал организации; суммы месяца пересчитаются сразу.
          </p>
          <Button
            type="button"
            tone="danger"
            disabled={removing}
            data-testid="budget-delete"
            onClick={async () => {
              const yes = await ask({
                title: 'Удалить расход?',
                body: 'Строка исчезнет из журнала расходов; запись об удалении останется в журнале организации.',
                confirmLabel: 'Удалить',
                tone: 'danger',
              });
              if (yes) deleteForm.current?.requestSubmit();
            }}
          >
            {removing ? 'Удаляю…' : 'Удалить расход'}
          </Button>
          {dialog}
        </form>
      )}
    </>
  );
}

/** План месяца: одна сумма в валюте отчётности (экран 2, вкладка «Планы») */
export function PlanButton({
  month,
  plan,
  currency,
}: {
  month: string;
  plan: string | null;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" tone="secondary" onClick={() => setOpen(true)} data-testid="budget-plan-edit">
        {plan === null ? 'Задать план' : 'Изменить план'}
      </Button>
      {open && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={`План на ${monthTitle(month).toLowerCase()}`}
          onClose={() => setOpen(false)}
        >
          <PlanForm month={month} plan={plan} currency={currency} onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

function PlanForm({
  month,
  plan,
  currency,
  onClose,
}: {
  month: string;
  plan: string | null;
  currency: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useBudgetAction(savePlanAction, onClose);
  return (
    <form action={action} className="settings-service-form" data-testid="budget-plan-form">
      {state.error && <Alert boxed>{state.error}</Alert>}
      <input type="hidden" name="month" value={month} />
      <p className="settings-note">
        Общий бюджет месяца в валюте отчётности ({currency}). Прогноз и рекомендация на обзоре
        считаются от этой суммы.
      </p>
      <Field label={`План, ${currency}`}>
        <Input
          name="amount"
          inputMode="decimal"
          required
          autoFocus
          defaultValue={state.values?.['amount'] ?? (plan === null ? '' : minorToInput(plan))}
          data-testid="budget-plan-amount"
        />
      </Field>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="budget-plan-save">
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}

/** Выгрузка журнала месяца в CSV: файл собирается из уже загруженных строк, без запроса */
export function ExportCsvButton({
  rows,
  month,
  reportingCurrency,
}: {
  rows: MarketingExpenseRow[];
  month: string;
  reportingCurrency: string;
}) {
  const save = () => {
    const head = ['Дата', 'Платформа', 'Кампания', 'Статья', 'Описание', 'Сумма', 'Валюта', 'Курс', `Сумма, ${reportingCurrency}`, 'В бюджете'];
    const line = (r: MarketingExpenseRow) =>
      [r.date, platformLabel(r.platform), r.campaign ?? '', r.category, r.description ?? '', minorToInput(r.amount), r.currency, r.fxRate, minorToInput(r.baseAmount), r.countedInBudget ? 'да' : 'нет']
        .map((c) => `"${String(c).replaceAll('"', '""')}"`)
        .join(';');
    const csv = '﻿' + [head.join(';'), ...rows.map(line)].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketing-expenses-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button type="button" tone="secondary" size="sm" onClick={save} disabled={rows.length === 0} data-testid="budget-export">
      Выгрузить CSV
    </Button>
  );
}
