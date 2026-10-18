'use client';
import type { EmployeePortalDto } from '@pms/domain';
import { Field, Input, Select } from '../ui';
import { minorToInput } from '../../lib/money';
import { PortalForm, type PortalContext } from './forms';
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
  if (data.access !== 'MANAGER') return null;
  return <section className="panel portal-section" data-testid="portal-manager-controls">
    <h2>Настройки руководителя</h2>
    <h3>Публичная страница</h3>
    <p>Публикуются только одобренные профессиональные сведения и работы с согласием. Контакты, заказы и оплата труда остаются закрытыми.</p>
    <PortalForm context={context} command="publication" revision={data.profile.revision} label="Сохранить публикацию">
      <label><input name="publicationConsent" type="checkbox" defaultChecked={data.profile.publicationConsent} /> Получено согласие на публичную страницу</label>
      <label><input name="published" type="checkbox" defaultChecked={data.profile.published} /> Одобрить публикацию профиля</label>
    </PortalForm>
    <h3>Доступ сотрудника</h3>
    <p>{data.employee.accountLinked ? 'Аккаунт привязан.' : 'Аккаунт не привязан. Личный кабинет пока недоступен.'} Используйте существующий вход по коду или приглашение в команду, без создания пароля.</p>
    <a href="/team">Участники команды и приглашения</a>
    {!data.employee.accountLinked && accountOptions === null && (
      <p role="alert">Не удалось загрузить участников команды. Обновите страницу и попробуйте снова.</p>
    )}
    {!data.employee.accountLinked && accountOptions !== undefined && accountOptions !== null && accountOptions.length === 0 && (
      <p>Нет подтверждённых участников с доступом к этому филиалу. Сначала добавьте участника в команду или настройте его доступ.</p>
    )}
    {!data.employee.accountLinked && accountOptions && accountOptions.length > 0 && (
      <PortalForm context={context} command="account" label="Привязать подтверждённого участника">
        <Field label="Участник команды">
          <Select name="userId" required defaultValue="">
            <option value="" disabled>Выберите участника</option>
            {accountOptions.map((option) => <option key={option.userId} value={option.userId}>{option.label}</option>)}
          </Select>
        </Field>
        <p>Сервер повторно проверит активное членство, подтверждённый вход и доступ к филиалу.</p>
      </PortalForm>
    )}
    {data.employee.accountLinked && <PortalForm context={context} command="unlink" label="Отвязать аккаунт" />}
    <h3>Условия оплаты труда</h3>
    <PortalForm context={context} command="pay" label="Сохранить условия оплаты">
      <Field label="Модель оплаты"><Select name="model" defaultValue={data.pay.model ?? ''} required><option value="" disabled>Выберите модель</option><option value="FIXED">Фиксированная</option><option value="PERCENT">Процент</option><option value="FIXED_PLUS_PERCENT">Фиксированная + процент</option><option value="BONUS_ONLY">Только бонусы</option></Select></Field>
      <Field label={`Фиксированная ставка, ${data.pay.currency === 'KZT' ? '₸' : data.pay.currency}`}><Input name="fixedAmount" inputMode="decimal" required defaultValue={data.pay.fixedMinor === null ? '' : minorToInput(data.pay.fixedMinor)} /></Field>
      <Field label="Процент, от 0 до 100"><Input name="percent" type="number" min={0} max={100} step={1} required defaultValue={data.pay.percent ?? ''} /></Field>
      <p>Введите сумму в выбранной валюте. Расчёт выполняет сервер.</p>
    </PortalForm>
    {data.business.vertical === 'BEAUTY' && <>
      <h3>База процента для бизнеса</h3>
      <p>Настройка общая для бизнеса, а не только для этого сотрудника. Неподдерживаемые закрытые периоды и возвраты не рассчитываются в браузере.</p>
      <PortalForm context={context} command="pay-policy" revision={data.pay.policyRevision} label="Сохранить базу процента">
        <Field label="База процента"><Select name="percentBasis" required defaultValue={data.pay.percentBasis ?? ''}><option value="" disabled>Не настроена</option><option value="COMPLETED_SERVICES">Стоимость оказанных услуг</option><option value="PAID_COMPLETED_SERVICES">Оплаченные оказанные услуги</option></Select></Field>
      </PortalForm>
    </>}
  </section>;
}
