'use client';
import { useActionState, useMemo, useState } from 'react';
import { DEFAULT_REMINDER_TEMPLATE, REMINDER_PLACEHOLDERS, renderReminder } from '@pms/domain';
import { Alert, Button, Field, Input, Textarea } from '../../components/ui';
import type { BeautyBonusProgram, BeautyReminderSettings } from '../../lib/api';
import { saveBonusProgram, saveReminderSettings } from './loyalty-actions';

/** Пример для предпросмотра: вымышленный клиент (AGENTS.md §8) */
const SAMPLE = {
  имя: 'Айгуль',
  услуга: 'Стрижка',
  дата: '23 октября',
  время: '10:30',
  мастер: 'Дина',
  салон: 'Ваш салон',
  адрес: 'ул. Абая, 10',
  телефон: '+7 700 000 00 00',
};

export function ReminderSettingsForm({
  initial,
  scopeKey,
  canEdit,
}: {
  initial: BeautyReminderSettings;
  scopeKey: string;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(saveReminderSettings, null);
  const data = state?.data ?? initial;
  const [template, setTemplate] = useState(initial.template ?? '');
  const preview = useMemo(() => renderReminder(template || DEFAULT_REMINDER_TEMPLATE, SAMPLE), [template]);
  return (
    <form action={action} className="salon-hours-form salon-loyalty-form" data-testid="reminder-settings">
      <h2>Напоминания клиентам</h2>
      <p>
        Клиент получает напоминание о записи. Если у клиента есть почта, письмо уходит само. WhatsApp уходит сам,
        когда номер салона подключён и указан одобренный шаблон. Иначе напоминание появится в журнале в списке
        «Напомнить сегодня» с кнопкой «Написать в WhatsApp».
      </p>
      <p className="muted" data-testid="review-request-note">
        Через 2 часа после визита со статусом «Выполнено» клиент получает просьбу оценить визит со ссылкой на отзыв
        (с 10:00 до 21:00). Выключение напоминаний выключает и её.
      </p>
      <input type="hidden" name="scopeKey" value={scopeKey} />
      <input type="hidden" name="revision" value={data.revision} />
      <fieldset disabled={!canEdit || pending} className="salon-loyalty-fields">
        <legend className="sr-only">Настройки напоминаний</legend>
        <label className="salon-loyalty-toggle">
          <input type="checkbox" name="enabled" defaultChecked={data.enabled} />
          Напоминать клиентам о записи
        </label>
        <Field label="За сколько часов до записи" controlId="reminder-hours" hint="Через запятую, например 24, 2">
          <Input name="hoursBefore" defaultValue={data.hoursBefore.join(', ')} inputMode="numeric" />
        </Field>
        <Field
          label="Текст напоминания"
          controlId="reminder-template"
          hint={`Можно вставить: ${REMINDER_PLACEHOLDERS.map((p) => `{${p}}`).join(' ')}. Пусто: текст по умолчанию.`}
        >
          <Textarea
            name="template"
            rows={4}
            maxLength={1000}
            value={template}
            placeholder={DEFAULT_REMINDER_TEMPLATE}
            onChange={(event) => setTemplate(event.target.value)}
          />
        </Field>
        <div className="salon-loyalty-preview" aria-label="Как увидит клиент">
          <span className="muted">Как увидит клиент</span>
          <p data-testid="reminder-preview">{preview}</p>
        </div>
        <Field
          label="Шаблон WhatsApp"
          controlId="reminder-wa-template"
          hint={
            data.whatsappConnected
              ? 'Имя шаблона, одобренного в кабинете Meta'
              : 'Номер WhatsApp салона пока не подключён: напоминания будут в списке «Напомнить сегодня»'
          }
        >
          <Input name="whatsappTemplateName" defaultValue={data.whatsappTemplateName ?? ''} placeholder="salon_reminder" />
        </Field>
      </fieldset>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.data && <Alert tone="success">Напоминания сохранены. Будущие записи получат новое расписание.</Alert>}
      {canEdit && (
        <Button type="submit" disabled={pending}>
          {pending ? 'Сохраняем…' : 'Сохранить напоминания'}
        </Button>
      )}
    </form>
  );
}

export function BonusProgramForm({
  initial,
  scopeKey,
  canEdit,
}: {
  initial: BeautyBonusProgram;
  scopeKey: string;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(saveBonusProgram, null);
  const data = state?.data ?? initial;
  return (
    <form action={action} className="salon-hours-form salon-loyalty-form" data-testid="bonus-settings">
      <h2>Бонусы</h2>
      <p>
        Клиент получает бонусы с оплаченной суммы и может оплатить ими часть следующего визита. 1 бонус равен 1
        единице валюты филиала.
      </p>
      <input type="hidden" name="scopeKey" value={scopeKey} />
      <input type="hidden" name="revision" value={data.revision} />
      <fieldset disabled={!canEdit || pending} className="salon-loyalty-fields">
        <legend className="sr-only">Настройки бонусов</legend>
        <label className="salon-loyalty-toggle">
          <input type="checkbox" name="enabled" defaultChecked={data.enabled} />
          Начислять и принимать бонусы
        </label>
        <div className="salon-loyalty-row">
          <Field label="Начислять, % от оплаты" controlId="bonus-accrual">
            <Input name="accrualPercent" type="number" min={0} max={100} step={1} defaultValue={data.accrualPercent} />
          </Field>
          <Field label="Оплатить бонусами, % чека" controlId="bonus-redeem">
            <Input name="maxRedeemPercent" type="number" min={0} max={100} step={1} defaultValue={data.maxRedeemPercent} />
          </Field>
          <Field label="Срок бонусов, дней" controlId="bonus-expiry" hint="Пусто: без срока">
            <Input name="expiresDays" type="number" min={1} max={3650} step={1} defaultValue={data.expiresDays ?? ''} />
          </Field>
        </div>
      </fieldset>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.data && <Alert tone="success">Бонусы сохранены.</Alert>}
      {canEdit && (
        <Button type="submit" disabled={pending}>
          {pending ? 'Сохраняем…' : 'Сохранить бонусы'}
        </Button>
      )}
    </form>
  );
}
