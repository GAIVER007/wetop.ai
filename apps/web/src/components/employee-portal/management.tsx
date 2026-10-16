'use client';
import type { EmployeePortalDto } from '@pms/domain';
import { Field, Input, Select } from '../ui';
import { PortalForm, type PortalContext } from './forms';
export function PortalManagement({ data, context }: { data: EmployeePortalDto; context: PortalContext }) {
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
    <PortalForm context={context} command="account" label="Привязать подтверждённого участника">
      <Field label="ID существующего подтверждённого участника команды"><Input name="userId" required autoComplete="off" /></Field>
      <p>Только проверенный ID из команды. Сервер проверит участника и разрешение на привязку; не вводите придуманный ID.</p>
    </PortalForm>
    {data.employee.accountLinked && <PortalForm context={context} command="unlink" label="Отвязать аккаунт" />}
    <h3>Условия оплаты труда</h3>
    <PortalForm context={context} command="pay" label="Сохранить условия оплаты">
      <Field label="Модель оплаты"><Select name="model" defaultValue={data.pay.model ?? ''} required><option value="" disabled>Выберите модель</option><option value="FIXED">Фиксированная</option><option value="PERCENT">Процент</option><option value="FIXED_PLUS_PERCENT">Фиксированная + процент</option><option value="BONUS_ONLY">Только бонусы</option></Select></Field>
      <Field label="Фиксированная ставка, minor units (для KZT: тиын)"><Input name="fixedMinor" inputMode="numeric" pattern="[0-9]+" required defaultValue={data.pay.fixedMinor ?? ''} /></Field>
      <Field label="Процент, от 0 до 100"><Input name="percent" type="number" min={0} max={100} step={1} required defaultValue={data.pay.percent ?? ''} /></Field>
      <p>Сумма целым числом в минимальных единицах валюты, не в тенге. Расчёт выполняет сервер.</p>
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
