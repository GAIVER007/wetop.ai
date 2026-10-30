'use client';
import { useState, useTransition, type FormEvent } from 'react';
import { InviteLinkBox } from '../invite-link-box';
import type { EmployeePortalDto } from '@pms/domain';
import { Field, Input, Select } from '../ui';
import { inviteNewStaffAction } from '../../app/login/actions';
import { currencySign, minorToInput } from '../../lib/money';
import { PortalForm, type PortalContext } from './forms';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
export type PortalAccountOption = { userId: string; label: string };

export function PortalManagement({
  data,
  context,
  accountOptions,
}: {
  data: EmployeePortalDto;
  context: PortalContext;
  /** undefined: список не запрашивали; null: запрос завершился ошибкой */
  accountOptions?: PortalAccountOption[] | null | undefined;
}) {
  const t = useT();
  if (data.access !== 'MANAGER') return null;
  return <section className="panel portal-section" data-testid="portal-manager-controls">
    <h2>{t('Настройки руководителя')}</h2>
    <h3>{t('Публичная страница')}</h3>
    <p>{t('Публикуются только одобренные профессиональные сведения и работы с согласием. Контакты, заказы и оплата труда остаются закрытыми.')}</p>
    <PortalForm context={context} command="publication" revision={data.profile.revision} label={t('Сохранить публикацию')}>
      <label><input name="publicationConsent" type="checkbox" defaultChecked={data.profile.publicationConsent} /> {t('Получено согласие на публичную страницу')}</label>
      <label><input name="published" type="checkbox" defaultChecked={data.profile.published} /> {t('Одобрить публикацию профиля')}</label>
    </PortalForm>
    <h3>{t('Статус')}</h3>
    <p>
      {/* E5 (паритет с zapis.kz): архив из карточки, без похода в форму создания */}
      {data.employee.active ? t('Сейчас активен. Архивный мастер не показывается в журнале и онлайн-записи, его записи и история остаются.') : t('Сейчас в архиве. Архивный мастер не показывается в журнале и онлайн-записи, его записи и история остаются.')}
    </p>
    <PortalForm
      context={context}
      command="active"
      label={data.employee.active ? t('Убрать в архив') : t('Вернуть из архива')}
      testId="portal-active-form"
    >
      <input type="hidden" name="active" value={data.employee.active ? 'false' : 'true'} />
    </PortalForm>
    <h3>{t('Личный кабинет')}</h3>
    {/* аудит салона 22.10.2026: вместо «Личный кабинет пока недоступен» одно понятное действие */}
    {data.employee.accountLinked
      ? <p>{data.business.vertical === 'BEAUTY' ? t('Мастер входит в личный кабинет и видит свои записи, график и зарплату.') : t('Сотрудник входит в личный кабинет и видит свои заказы, график и зарплату.')}</p>
      : <PortalInvite data={data} />}
    <a href="/team">{t('Все приглашения и доступы')}</a>
    {!data.employee.accountLinked && accountOptions === null && (
      <p role="alert">{t('Не удалось загрузить участников команды. Обновите страницу и попробуйте снова.')}</p>
    )}
    {!data.employee.accountLinked && accountOptions !== undefined && accountOptions !== null && accountOptions.length === 0 && (
      <p>{t('Нет подтверждённых участников с доступом к этому филиалу. Сначала добавьте участника в команду или настройте его доступ.')}</p>
    )}
    {!data.employee.accountLinked && accountOptions && accountOptions.length > 0 && (
      <PortalForm context={context} command="account" label={t('Привязать подтверждённого участника')}>
        <Field label={t('Участник команды')}>
          <Select name="userId" required defaultValue="">
            <option value="" disabled>{t('Выберите участника')}</option>
            {accountOptions.map((option) => <option key={option.userId} value={option.userId}>{option.label}</option>)}
          </Select>
        </Field>
        <p>{t('Привязать можно только участника, у которого есть вход и доступ к этому филиалу.')}</p>
      </PortalForm>
    )}
    {data.employee.accountLinked && <PortalForm context={context} command="unlink" label={t('Отвязать аккаунт')} />}
    <h3>{t('Условия оплаты труда')}</h3>
    <PortalForm context={context} command="pay" label={t('Сохранить условия оплаты')}>
      <PortalPayFields pay={data.pay} />
    </PortalForm>
    {data.business.vertical === 'BEAUTY' && <>
      <h3>{t('База процента для бизнеса')}</h3>
      <p>{t('Настройка общая для всех специалистов бизнеса: от какой суммы считать процент.')}</p>
      <PortalForm context={context} command="pay-policy" revision={data.pay.policyRevision} label={t('Сохранить базу процента')}>
        <Field label={t('База процента')}><Select name="percentBasis" required defaultValue={data.pay.percentBasis ?? ''}><option value="" disabled>{t('Не настроена')}</option><option value="COMPLETED_SERVICES">{t('Стоимость оказанных услуг')}</option><option value="PAID_COMPLETED_SERVICES">{t('Оплаченные оказанные услуги')}</option></Select></Field>
      </PortalForm>
    </>}
  </section>;
}

/**
 * Условия оплаты в карточке сотрудника той же логикой, что окно «Оплата» в «Зарплате» (владелец 25.10.2026): три
 * способа, поля только выбранного способа. Поле другого способа уходит нулём скрытым полем: разбор действия прежний.
 */
function PortalPayFields({ pay }: { pay: EmployeePortalDto['pay'] }) {
  const t = useT();
  const start = pay.model === 'BONUS_ONLY' || pay.model === null ? 'FIXED' : pay.model;
  const [model, setModel] = useState<'FIXED' | 'PERCENT' | 'FIXED_PLUS_PERCENT'>(start);
  const fixed = model !== 'PERCENT';
  const percent = model !== 'FIXED';
  return <>
    <Field label={t('Как платим')}>
      <Select name="model" value={model} required onChange={(e) => setModel(e.target.value as typeof model)}>
        <option value="FIXED">{t('Только оклад')}</option>
        <option value="PERCENT">{t('Только процент')}</option>
        <option value="FIXED_PLUS_PERCENT">{t('Оклад + процент')}</option>
      </Select>
    </Field>
    {fixed
      ? <Field label={t('Оклад за месяц, {currency}', { currency: currencySign(pay.currency) })}><Input name="fixedAmount" inputMode="decimal" required defaultValue={pay.fixedMinor === null || pay.fixedMinor === '0' ? '' : minorToInput(pay.fixedMinor)} /></Field>
      : <input type="hidden" name="fixedAmount" value="0" />}
    {percent
      ? <Field label={t('Процент, от 1 до 100')}><Input name="percent" type="number" min={1} max={100} step={1} required defaultValue={pay.percent ? pay.percent : ''} /></Field>
      : <input type="hidden" name="percent" value="0" />}
    <p>{t('Сумма в валюте филиала. Зарплату за месяц WETOP посчитает сам. Премии и удержания добавляются в «Зарплате».')}</p>
  </>;
}

/** Приглашение в личный кабинет (уровень PORTAL): то же приглашение, что в форме «Новый сотрудник», с привязкой к карточке */
function PortalInvite({ data }: { data: EmployeePortalDto }) {
  const t = useT();
  const beauty = data.business.vertical === 'BEAUTY';
  const [email, setEmail] = useState(data.employee.email ?? '');
  // владелец 30.10.2026 (вариант A): «на почту и скопировать ссылку»; по умолчанию и то и другое
  const [delivery, setDelivery] = useState<'email' | 'link' | 'both'>('both');
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setError(msg('Укажите почту: по ней сотрудник будет входить.'));
      return;
    }
    start(async () => {
      const result = await inviteNewStaffAction({ employeeId: data.employee.id, level: 'PORTAL', email, allBranches: false, delivery });
      setError(result.error);
      setInvited(result.error ? null : result.invited);
      setLink(result.link ?? null);
    });
  };
  const options = [
    { id: 'both', label: msg('Почта и ссылка') },
    { id: 'email', label: msg('На почту') },
    { id: 'link', label: msg('Скопировать ссылку') },
  ] as const;
  return <form className="portal-invite" data-testid="portal-invite" onSubmit={submit} noValidate>
    <p>{beauty ? t('Мастер увидит свои записи, график и зарплату. Пароль он задаст сам по ссылке.') : t('Сотрудник увидит свои заказы, график и зарплату. Пароль он задаст сам по ссылке.')}</p>
    <Field label={t('Почта для входа')}>
      <Input
        type="email"
        name="portalInviteEmail"
        autoComplete="off"
        placeholder="name@example.com"
        value={email}
        aria-invalid={error ? true : undefined}
        onChange={(event) => setEmail(event.target.value)}
      />
    </Field>
    <div className="portal-invite__delivery" role="group" aria-label={t('Как отправить приглашение')} data-testid="portal-invite-delivery">
      {options.map((o) => (
        <button key={o.id} type="button" className="cash-header__chip" aria-pressed={delivery === o.id} disabled={pending} onClick={() => setDelivery(o.id)}>
          {t(o.label)}
        </button>
      ))}
    </div>
    {error && <p role="alert">{t(error)}</p>}
    {invited && delivery !== 'link' && <p role="status">{t('Приглашение отправлено на {email}.', { email: invited })}</p>}
    {invited && delivery === 'link' && <p role="status">{t('Приглашение для {email} готово. Отправьте ссылку сотруднику.', { email: invited })}</p>}
    {link && <InviteLinkBox link={link} business={data.business.name} phone={data.employee.phone} />}
    {!invited && <button className="btn btn--primary" type="submit" disabled={pending}>{pending ? t('Отправляем…') : t('Пригласить в личный кабинет')}</button>}
  </form>;
}
