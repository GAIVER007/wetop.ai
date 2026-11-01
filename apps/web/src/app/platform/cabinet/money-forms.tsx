'use client';
import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { DateInput } from '../../../components/date-field';
import { Alert, Button, Field, Input, Notice, Select } from '../../../components/ui';
import type { PlatformExpenseCategory, PlatformPlan } from '../../../lib/api';
import { useT } from '../../../i18n/locale-provider';
import { CATEGORY_LABEL } from './categories';
import {
  addExpenseAction,
  addPaymentAction,
  saveSubscriptionAction,
  savePlanAction,
  saveTeamMemberAction,
  savePartnerAction,
  payPartnerAction,
  setClientPartnerAction,
  voidExpenseAction,
  voidPaymentAction,
  type MoneyFormResult,
  invitePartnerAction,
  createAndInvitePartnerAction,
} from './money-actions';

/** Формы кабинета WETOP (DATA_MODEL §63): одна кнопка, поля в окне, отказ словами API */


/** Форма очищается только после успешной записи: при ошибке введённое остаётся, человек правит одно поле */
function formKey(state: MoneyFormResult | null): number {
  return state?.saved ?? 0;
}

/**
 * Отправка без сброса полей: `action` формы React после ответа очищает поля даже при ошибке; здесь отправляем сами,
 * а очищает форму только новый `key` после успешной записи
 */
function keepOnError(action: (form: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
}

function Result({ state, testId }: { state: MoneyFormResult | null; testId: string }) {
  if (state?.error) return <Alert data-testid={`${testId}-error`}>{state.error}</Alert>;
  // `data-saved`: окно с формой (FormDialog) закрывается само после успешной записи
  if (state?.message)
    return (
      <Notice data-testid={`${testId}-result`} data-saved="">
        {state.message}
      </Notice>
    );
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
      key={formKey(state)}
      onSubmit={keepOnError(action)}
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
      {/* тариф или доп (ИИ-продавец, таргетолог, контент, продвижение): партнёру разово за тариф, 30% с допов (30.10.2026) */}
      <Field label={t('За что')}>
        <Select name="kind" defaultValue="PLAN" data-testid="money-payment-kind">
          <option value="PLAN">{t('Тариф')}</option>
          <option value="ADDON">{t('Доп: ИИ-продавец, таргет, контент')}</option>
        </Select>
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
  preset,
}: {
  categories: PlatformExpenseCategory[];
  today: string;
  /** Выплата зарплаты из «Сотрудников»: статья, сумма и заметка (имя) заполнены заранее */
  preset?: { category: PlatformExpenseCategory; amount: string; note: string } | undefined;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    addExpenseAction,
    null,
  );
  return (
    <form
      key={formKey(state)}
      onSubmit={keepOnError(action)}
      className="cabinet__form cabinet__form--wide"
      data-testid="money-expense-form"
    >
      <Field label={t('Статья')} required>
        <Select name="category" defaultValue={preset?.category ?? 'SERVER'}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {t(CATEGORY_LABEL[c])}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('Сумма, $')} required>
        <Input name="amount" inputMode="decimal" placeholder="20" defaultValue={preset?.amount ?? ''} />
      </Field>
      <Field label={t('Дата')} required>
        <DateInput name="spentOn" defaultValue={today} />
      </Field>
      <Field label={t('Заметка')}>
        <Input name="note" maxLength={300} defaultValue={preset?.note ?? ''} />
      </Field>
      {/* миграция 176: кому заплатили, проект, документ, повторяется каждый месяц */}
      <Field label={t('Получатель')}>
        <Input name="payee" maxLength={200} />
      </Field>
      <Field label={t('Проект')}>
        <Input name="project" maxLength={100} />
      </Field>
      <Field label={t('Документ')}>
        <Input name="document" maxLength={200} placeholder={t('Счёт № 17')} />
      </Field>
      <label className="cabinet__check">
        <input type="checkbox" name="recurring" data-testid="money-expense-recurring" /> {t('Повторяется каждый месяц')}
      </label>
      <Button type="submit" disabled={pending} aria-busy={pending} data-testid="money-expense-save">
        {pending ? t('Сохраняю…') : preset?.category === 'SALARIES' ? t('Выплатить') : t('Записать расход')}
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
    <form onSubmit={keepOnError(action)}>
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

export function PlanForm({ plan }: { plan: (PlatformPlan & { priceInput: string; partnerPayoutInput?: string }) | null }) {
  const t = useT();
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    savePlanAction.bind(null, plan?.id ?? null),
    null,
  );
  return (
    <form
      key={formKey(state)}
      onSubmit={keepOnError(action)}
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
      {/* владелец 30.10.2026: месяц $19, партнёру $10; год $199, партнёру $100; разово с первого чека клиента */}
      <Field label={t('Партнёру за первый чек, $')}>
        <Input name="partnerPayout" inputMode="decimal" defaultValue={plan?.partnerPayoutInput ?? ''} data-testid="money-plan-payout" />
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
    promoCode?: string | null | undefined;
    discountPercent?: number | null | undefined;
    autoRenew?: boolean | undefined;
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
      key={formKey(state)}
      onSubmit={keepOnError(action)}
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
      <Field label={t('Промокод')}>
        <Input name="promoCode" maxLength={40} defaultValue={client.promoCode ?? ''} />
      </Field>
      <Field label={t('Скидка, %')}>
        <Input name="discountPercent" inputMode="numeric" defaultValue={client.discountPercent?.toString() ?? ''} />
      </Field>
      <label className="cabinet__check">
        <input type="checkbox" name="autoRenew" defaultChecked={client.autoRenew ?? true} /> {t('Автопродление')}
      </label>
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
  kind,
}: {
  member: {
    id: string;
    name: string;
    role: string | null;
    email: string | null;
    phone?: string | null | undefined;
    kind?: 'PERSON' | 'DIGITAL' | undefined;
    salaryInput: string;
    active: boolean;
  } | null;
  /** Новый: человек или цифровой сотрудник (ИИ-агент: имя и зарплата) */
  kind?: 'PERSON' | 'DIGITAL' | undefined;
}) {
  const t = useT();
  const digital = (member?.kind ?? kind) === 'DIGITAL';
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    saveTeamMemberAction.bind(null, member?.id ?? null),
    null,
  );
  return (
    <form
      key={formKey(state)}
      onSubmit={keepOnError(action)}
      className="cabinet__form"
      data-testid="money-team-form"
    >
      <input type="hidden" name="kind" value={digital ? 'DIGITAL' : 'PERSON'} />
      <Field label={digital ? t('Имя') : t('ФИО')} required>
        <Input name="name" maxLength={200} defaultValue={member?.name ?? ''} />
      </Field>
      {!digital && (
        <>
          <Field label={t('Должность')}>
            <Input name="role" maxLength={100} defaultValue={member?.role ?? ''} />
          </Field>
          <Field label={t('Телефон')}>
            <Input name="phone" type="tel" maxLength={40} defaultValue={member?.phone ?? ''} />
          </Field>
          <Field label={t('Почта')}>
            <Input name="email" type="email" maxLength={320} defaultValue={member?.email ?? ''} />
          </Field>
        </>
      )}
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
        {pending ? t('Сохраняю…') : member ? t('Сохранить') : t('Добавить')}
      </Button>
      <Result state={state} testId="money-team" />
    </form>
  );
}

/** Партнёр WETOP (DATA_MODEL §63.1): имя, телефон, почта, процент от оплат его клиентов */
export function PartnerForm({
  partner,
}: {
  partner: { id: string; name: string; phone: string | null; email: string | null; percentInput: string; active: boolean } | null;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    savePartnerAction.bind(null, partner?.id ?? null),
    null,
  );
  return (
    <form key={formKey(state)} onSubmit={keepOnError(action)} className="cabinet__form" data-testid="partner-form">
      <Field label={t('Имя или компания')} required>
        <Input name="name" maxLength={200} defaultValue={partner?.name ?? ''} />
      </Field>
      <Field label={t('Телефон')}>
        <Input name="phone" type="tel" maxLength={40} defaultValue={partner?.phone ?? ''} />
      </Field>
      <Field label={t('Почта')}>
        <Input name="email" type="email" maxLength={320} defaultValue={partner?.email ?? ''} />
      </Field>
      <Field label={t('Процент с допов')} required>
        <Input name="percent" inputMode="decimal" placeholder="20" defaultValue={partner?.percentInput ?? ''} />
      </Field>
      {partner && (
        <Field label={t('Состояние')}>
          <Select name="active" defaultValue={partner.active ? 'true' : 'false'}>
            <option value="true">{t('работает')}</option>
            <option value="false">{t('не работает')}</option>
          </Select>
        </Field>
      )}
      <Button type="submit" disabled={pending} aria-busy={pending} data-testid="partner-save">
        {pending ? t('Сохраняю…') : partner ? t('Сохранить') : t('Добавить партнёра')}
      </Button>
      <Result state={state} testId="partner" />
    </form>
  );
}

/** Выплата партнёру: сумма к выплате подставлена, пишется расходом «Партнёрам» */
export function PartnerPayoutForm({ partnerId, amount, today }: { partnerId: string; amount: string; today: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    payPartnerAction.bind(null, partnerId),
    null,
  );
  return (
    <form key={formKey(state)} onSubmit={keepOnError(action)} className="cabinet__form" data-testid="partner-payout-form">
      <Field label={t('Сумма, $')} required>
        <Input name="amount" inputMode="decimal" defaultValue={amount} />
      </Field>
      <Field label={t('Дата')} required>
        <DateInput name="spentOn" defaultValue={today} />
      </Field>
      <Field label={t('Заметка')}>
        <Input name="note" maxLength={300} />
      </Field>
      <Button type="submit" disabled={pending} aria-busy={pending} data-testid="partner-payout-save">
        {pending ? t('Сохраняю…') : t('Выплатить')}
      </Button>
      <Result state={state} testId="partner-payout" />
    </form>
  );
}

/** Чей клиент: партнёр, который привёл клиента (карточка клиента) */
export function ClientPartnerForm({
  organizationId,
  partners,
  current,
}: {
  organizationId: string;
  partners: Array<{ id: string; name: string }>;
  current: string | null;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<MoneyFormResult | null, FormData>(
    setClientPartnerAction.bind(null, organizationId),
    null,
  );
  return (
    <form key={formKey(state)} onSubmit={keepOnError(action)} className="cabinet__form cabinet__form--row" data-testid="client-partner-form">
      <Field label={t('Партнёр')}>
        <Select name="partnerId" defaultValue={current ?? ''}>
          <option value="">{t('без партнёра')}</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" tone="secondary" disabled={pending} aria-busy={pending} data-testid="client-partner-save">
        {pending ? t('Сохраняю…') : t('Сохранить')}
      </Button>
      <Result state={state} testId="client-partner" />
    </form>
  );
}

/** Готовая ссылка приглашения: «Скопировать», «Открыть», «Отправить письмо» (ТЗ 01.11.2026) */
function InviteLinkBox({ link, email, sent }: { link: string; email: string | null; sent: boolean | undefined }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const mail = `mailto:${email ?? ''}?subject=${encodeURIComponent(t('Приглашение в кабинет партнёра WETOP'))}&body=${encodeURIComponent(
    t('Здравствуйте! Приглашаем вас партнёром WETOP. Откройте ссылку, создайте кабинет (ссылка на 7 дней, один раз): {link}', { link }),
  )}`;
  return (
    <div className="stack" data-testid="partner-invite-ready">
      <Field label={t('Ссылка приглашения')}>
        <Input readOnly value={link} data-testid="partner-invite-link" onFocus={(e) => e.currentTarget.select()} />
      </Field>
      <div className="row">
        <Button
          type="button"
          data-testid="partner-invite-copy"
          onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopied(true), () => setCopied(false))}
        >
          {copied ? t('Скопировано') : t('Скопировать')}
        </Button>
        <a className="btn btn--secondary" href={link} target="_blank" rel="noreferrer" data-testid="partner-invite-open">
          {t('Открыть')}
        </a>
        <a className="btn btn--secondary" href={mail} data-testid="partner-invite-mail">
          {t('Отправить письмо')}
        </a>
      </div>
      {sent === true && <Notice>{t('Письмо со ссылкой отправлено партнёру.')}</Notice>}
    </div>
  );
}

/** «Пригласить партнёра» одним окном: имя, почта, телефон, «Создать приглашение» */
export function PartnerCreateInviteForm() {
  const t = useT();
  const [state, action, pending] = useActionState(createAndInvitePartnerAction, null);
  const [email, setEmail] = useState('');
  if (state?.link) return <InviteLinkBox link={state.link} email={email || null} sent={state.sent} />;
  return (
    <form action={action} className="cabinet__form" data-testid="partner-create-invite-form">
      <Field label={t('Имя партнёра')} required>
        <Input name="name" maxLength={200} required autoComplete="off" />
      </Field>
      <Field label={t('Почта')}>
        <Input name="email" type="email" maxLength={320} value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
      </Field>
      <Field label={t('Телефон')}>
        <Input name="phone" type="tel" maxLength={40} />
      </Field>
      <p className="muted">{t('Партнёр получит ссылку на 7 дней, создаст кабинет и сразу увидит свой Partner ID и ссылку для клиентов.')}</p>
      {state?.error && <Alert tone="warning" role="alert">{t(state.error)}</Alert>}
      <Button type="submit" disabled={pending} aria-busy={pending} data-testid="partner-create-invite-save">
        {pending ? t('Готовим…') : t('Создать приглашение')}
      </Button>
    </form>
  );
}

/** «Пригласить» партнёра в его кабинет (DATA_MODEL §63.3): ссылку можно скопировать и отправить в мессенджер */
export function PartnerInviteForm({ partnerId }: { partnerId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(async () => invitePartnerAction(partnerId), null as Awaited<ReturnType<typeof invitePartnerAction>> | null);
  return (
    <form action={action} className="cabinet__form" data-testid="partner-invite-form">
      <p className="muted">{t('Партнёр откроет ссылку, укажет имя, почту и пароль и войдёт в свой кабинет. Ссылка одна, на 7 дней.')}</p>
      {state?.link && <InviteLinkBox link={state.link} email={null} sent={state.sent} />}
      {state?.error && <Alert tone="warning" role="alert">{t(state.error)}</Alert>}
      <Button type="submit" disabled={pending} aria-busy={pending} data-testid="partner-invite-save">
        {pending ? t('Готовим…') : state?.link ? t('Новая ссылка') : t('Получить ссылку')}
      </Button>
    </form>
  );
}
