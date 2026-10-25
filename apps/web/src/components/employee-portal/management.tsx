'use client';
import { useState, useTransition, type FormEvent } from 'react';
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
      <Field label={t('Модель оплаты')}><Select name="model" defaultValue={data.pay.model ?? ''} required><option value="" disabled>{t('Выберите модель')}</option><option value="FIXED">{t('Фиксированная')}</option><option value="PERCENT">{t('Процент')}</option><option value="FIXED_PLUS_PERCENT">{t('Фиксированная + процент')}</option><option value="BONUS_ONLY">{t('Только бонусы')}</option></Select></Field>
      <Field label={t('Фиксированная ставка, {currency}', { currency: currencySign(data.pay.currency) })}><Input name="fixedAmount" inputMode="decimal" required defaultValue={data.pay.fixedMinor === null ? '' : minorToInput(data.pay.fixedMinor)} /></Field>
      <Field label={t('Процент, от 0 до 100')}><Input name="percent" type="number" min={0} max={100} step={1} required defaultValue={data.pay.percent ?? ''} /></Field>
      <p>{t('Сумма в валюте филиала. Зарплату за месяц WETOP посчитает сам.')}</p>
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

/** Приглашение в личный кабинет (уровень PORTAL): то же приглашение, что в форме «Новый сотрудник», с привязкой к карточке */
function PortalInvite({ data }: { data: EmployeePortalDto }) {
  const t = useT();
  const beauty = data.business.vertical === 'BEAUTY';
  const [email, setEmail] = useState(data.employee.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setError(msg('Укажите почту: на неё придёт приглашение.'));
      return;
    }
    start(async () => {
      const result = await inviteNewStaffAction({ employeeId: data.employee.id, level: 'PORTAL', email, allBranches: false });
      setError(result.error);
      setInvited(result.invited);
    });
  };
  return <form className="portal-invite" data-testid="portal-invite" onSubmit={submit} noValidate>
    <p>{beauty ? t('Мастер увидит свои записи, график и зарплату. Пароль он задаст сам по ссылке из письма.') : t('Сотрудник увидит свои заказы, график и зарплату. Пароль он задаст сам по ссылке из письма.')}</p>
    <Field label={t('Почта для приглашения')}>
      <Input
        type="email"
        name="portalInviteEmail"
        autoComplete="off"
        placeholder="name@company.kz"
        value={email}
        aria-invalid={error ? true : undefined}
        onChange={(event) => setEmail(event.target.value)}
      />
    </Field>
    {error && <p role="alert">{t(error)}</p>}
    {invited && <p role="status">{t('Приглашение отправлено на {email}.', { email: invited })}</p>}
    <button className="btn btn--primary" type="submit" disabled={pending}>{pending ? t('Отправляем…') : t('Пригласить в личный кабинет')}</button>
  </form>;
}
