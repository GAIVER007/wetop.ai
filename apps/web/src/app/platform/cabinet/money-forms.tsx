'use client';
import { useActionState } from 'react';
import { DateInput } from '../../../components/date-field';
import { Alert, Button, Field, Input, Notice, Select } from '../../../components/ui';
import type { PlatformExpenseCategory, PlatformPlan } from '../../../lib/api';
import { useT } from '../../../i18n/locale-provider';
import { msg } from '../../../i18n';
import {
  addExpenseAction,
  addPaymentAction,
  saveSubscriptionAction,
  savePlanAction,
  saveTeamMemberAction,
  voidExpenseAction,
  voidPaymentAction,
  type MoneyFormResult,
} from './money-actions';

/** Формы кабинета WETOP (DATA_MODEL §63): одна кнопка, поля в окне, отказ словами API */

export const CATEGORY_LABEL: Record<PlatformExpenseCategory, string> = {
  SERVER: msg('Сервер'),
  DOMAINS: msg('Домены'),
  ADS: msg('Реклама'),
  AI: msg('ИИ'),
  SALARIES: msg('Зарплаты'),
  SERVICES: msg('Сервисы'),
  OTHER: msg('Другое'),
};

function Result({ state, testId }: { state: MoneyFormResult | null; testId: string }) {
  if (state?.error) return <Alert data-testid={`${testId}-error`}>{state.error}</Alert>;
  if (state?.message) return <Notice data-testid={`${testId}-result`}>{state.message}</Notice>;
  return null;
}

export function PaymentForm({
  clients,
  today,
}: {
  clients: Array<{ id: string; name: string }>;
  today: string;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    addPaymentAction,
    null,
  );
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="cabinet__form"
      data-testid="money-payment-form"
    >
      <Field label={t('Клиент')} required>
        <Select name="organizationId" defaultValue={clients[0]?.id ?? ''}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('Сумма, $')} required>
        <Input name="amount" inputMode="decimal" placeholder="49" />
      </Field>
      <Field label={t('Дата')} required>
        <DateInput name="paidOn" defaultValue={today} />
      </Field>
      <Field label={t('Продлить подписку')}>
        <Select name="extendMonths" defaultValue="1">
          <option value="1">{t('на месяц')}</option>
          <option value="12">{t('на год')}</option>
          <option value="0">{t('не продлевать')}</option>
        </Select>
      </Field>
      <Field label={t('Заметка')}>
        <Input name="note" maxLength={300} />
      </Field>
      <Button
        type="submit"
        disabled={pending || clients.length === 0}
        aria-busy={pending}
        data-testid="money-payment-save"
      >
        {pending ? t('Сохраняю…') : t('Записать оплату')}
      </Button>
      <Result state={state} testId="money-payment" />
    </form>
  );
}

export function ExpenseForm({
  categories,
  today,
}: {
  categories: PlatformExpenseCategory[];
  today: string;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    addExpenseAction,
    null,
  );
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="cabinet__form cabinet__form--wide"
      data-testid="money-expense-form"
    >
      <Field label={t('Статья')} required>
        <Select name="category" defaultValue="SERVER">
          {categories.map((c) => (
            <option key={c} value={c}>
              {t(CATEGORY_LABEL[c])}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('Сумма, $')} required>
        <Input name="amount" inputMode="decimal" placeholder="20" />
      </Field>
      <Field label={t('Дата')} required>
        <DateInput name="spentOn" defaultValue={today} />
      </Field>
      <Field label={t('Заметка')}>
        <Input name="note" maxLength={300} />
      </Field>
      <Button type="submit" disabled={pending} aria-busy={pending} data-testid="money-expense-save">
        {pending ? t('Сохраняю…') : t('Записать расход')}
      </Button>
      <Result state={state} testId="money-expense" />
    </form>
  );
}

export function VoidButton({ id, kind }: { id: string; kind: 'payment' | 'expense' }) {
  const t = useT();
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    (kind === 'payment' ? voidPaymentAction : voidExpenseAction).bind(null, id),
    null,
  );
  return (
    <form action={action}>
      <Button
        type="submit"
        tone="ghost"
        size="sm"
        disabled={pending}
        data-testid={`money-void-${kind}`}
      >
        {t('Отменить')}
      </Button>
      {state?.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

export function PlanForm({ plan }: { plan: (PlatformPlan & { priceInput: string }) | null }) {
  const t = useT();
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    savePlanAction.bind(null, plan?.id ?? null),
    null,
  );
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="cabinet__form"
      data-testid="money-plan-form"
    >
      <Field label={t('Тариф')} required>
        <Input name="name" maxLength={100} defaultValue={plan?.name ?? ''} />
      </Field>
      <Field label={t('Цена, $')} required>
        <Input name="price" inputMode="decimal" defaultValue={plan?.priceInput ?? ''} />
      </Field>
      <Field label={t('Срок')}>
        <Select name="periodMonths" defaultValue={String(plan?.periodMonths ?? 1)}>
          <option value="1">{t('в месяц')}</option>
          <option value="12">{t('в год')}</option>
        </Select>
      </Field>
      {plan && (
        <Field label={t('Состояние')}>
          <Select name="active" defaultValue={plan.active ? 'true' : 'false'}>
            <option value="true">{t('продаётся')}</option>
            <option value="false">{t('скрыт')}</option>
          </Select>
        </Field>
      )}
      <Button type="submit" disabled={pending} aria-busy={pending} data-testid="money-plan-save">
        {pending ? t('Сохраняю…') : plan ? t('Сохранить') : t('Добавить тариф')}
      </Button>
      <Result state={state} testId="money-plan" />
    </form>
  );
}

export function SubscriptionForm({
  client,
  plans,
}: {
  client: {
    id: string;
    name: string;
    planId: string | null;
    monthlyInput: string;
    paidUntil: string | null;
    note: string | null;
  };
  plans: PlatformPlan[];
}) {
  const t = useT();
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    saveSubscriptionAction.bind(null, client.id),
    null,
  );
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="cabinet__form cabinet__form--row"
      aria-label={t('Подписка: {name}', { name: client.name })}
      data-testid="money-subscription-form"
    >
      <Field label={t('Тариф')}>
        <Select name="planId" defaultValue={client.planId ?? ''}>
          <option value="">{t('без тарифа')}</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('В месяц, $')} required>
        <Input
          name="monthly"
          inputMode="decimal"
          defaultValue={client.monthlyInput}
          placeholder="0"
        />
      </Field>
      <Field label={t('Оплачено до')}>
        <DateInput name="paidUntil" defaultValue={client.paidUntil ?? ''} />
      </Field>
      <Button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        data-testid="money-subscription-save"
      >
        {pending ? t('Сохраняю…') : t('Сохранить')}
      </Button>
      <Result state={state} testId="money-subscription" />
    </form>
  );
}

export function TeamForm({
  member,
}: {
  member: {
    id: string;
    name: string;
    role: string;
    email: string | null;
    salaryInput: string;
    active: boolean;
  } | null;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    saveTeamMemberAction.bind(null, member?.id ?? null),
    null,
  );
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="cabinet__form"
      data-testid="money-team-form"
    >
      <Field label={t('Имя')} required>
        <Input name="name" maxLength={200} defaultValue={member?.name ?? ''} />
      </Field>
      <Field label={t('Должность')} required>
        <Input name="role" maxLength={100} defaultValue={member?.role ?? ''} />
      </Field>
      <Field label={t('Почта')}>
        <Input name="email" type="email" maxLength={320} defaultValue={member?.email ?? ''} />
      </Field>
      <Field label={t('Зарплата в месяц, $')}>
        <Input name="salary" inputMode="decimal" defaultValue={member?.salaryInput ?? ''} />
      </Field>
      {member && (
        <Field label={t('Состояние')}>
          <Select name="active" defaultValue={member.active ? 'true' : 'false'}>
            <option value="true">{t('работает')}</option>
            <option value="false">{t('ушёл')}</option>
          </Select>
        </Field>
      )}
      <Button type="submit" disabled={pending} aria-busy={pending} data-testid="money-team-save">
        {pending ? t('Сохраняю…') : member ? t('Сохранить') : t('Добавить в команду')}
      </Button>
      <Result state={state} testId="money-team" />
    </form>
  );
}
