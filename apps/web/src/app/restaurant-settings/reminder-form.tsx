'use client';
import { useActionState, useMemo, useState } from 'react';
import { FOOD_DEFAULT_REMINDER_TEMPLATE, FOOD_REMINDER_PLACEHOLDERS, renderFoodReminder } from '@pms/domain';
import { Alert, Button, Field, Input, Textarea } from '../../components/ui';
import type { FoodReminderSettings } from '../../lib/food-api';
import { saveFoodReminderSettings } from './reminder-actions';
import { useT } from '../../i18n/locale-provider';

/**
 * Пример для предпросмотра: вымышленный гость (AGENTS.md §8). Ключи это имена подстановок шаблона, значения пример
 * данных: напоминание уходит гостю текстом шаблона ресторана, предпросмотр показывает его как есть.
 */
const SAMPLE = {
  имя: 'Айгуль', // kk-allow: имя подстановки шаблона и пример данных гостя
  дата: '23 октября', // kk-allow: имя подстановки шаблона и пример данных гостя
  время: '19:00', // kk-allow: имя подстановки шаблона
  гостей: '4 гостя', // kk-allow: имя подстановки шаблона и пример данных гостя
  ресторан: 'Ваш ресторан', // kk-allow: имя подстановки шаблона и пример данных гостя
  адрес: 'ул. Абая, 10', // kk-allow: имя подстановки шаблона и пример данных гостя
  телефон: '+7 700 000 00 00', // kk-allow: имя подстановки шаблона
};

/**
 * «Напоминания гостям» в настройках ресторана (§61, миграция 152). Тот же вид, что «Напоминания клиентам» салона:
 * включено, за сколько часов, текст с предпросмотром, шаблон WhatsApp. Брони с сайта получают подтверждение сразу.
 */
export function FoodReminderForm({ initial, scopeKey, canEdit }: { initial: FoodReminderSettings; scopeKey: string; canEdit: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveFoodReminderSettings, null);
  const data = state?.data ?? initial;
  const [template, setTemplate] = useState(initial.template ?? '');
  const preview = useMemo(() => renderFoodReminder(template || FOOD_DEFAULT_REMINDER_TEMPLATE, SAMPLE), [template]);
  return (
    <form action={action} className="rest-reminders" data-testid="food-reminder-settings">
      <h2 id="rest-settings-title">{t('Напоминания гостям')}</h2>
      <p>
        {t(
          'Гость получает напоминание о брони. Если у гостя есть почта, письмо уходит само. WhatsApp уходит сам, когда номер ресторана подключён и указан одобренный шаблон. Иначе напоминание появится на «Бронированиях» в списке «Напомнить сегодня» с кнопкой «Написать в WhatsApp». Бронь с сайта сразу получает подтверждение.',
        )}
      </p>
      <input type="hidden" name="scopeKey" value={scopeKey} />
      <input type="hidden" name="revision" value={data.revision} />
      <fieldset disabled={!canEdit || pending} className="rest-reminders__fields">
        <legend className="sr-only">{t('Настройки напоминаний')}</legend>
        <label className="rest-reminders__toggle">
          <input type="checkbox" name="enabled" defaultChecked={data.enabled} />
          {t('Напоминать гостям о брони')}
        </label>
        <Field label={t('За сколько часов до брони')} controlId="food-reminder-hours" hint={t('Через запятую, например 24, 2')}>
          <Input name="hoursBefore" defaultValue={data.hoursBefore.join(', ')} inputMode="numeric" />
        </Field>
        <Field
          label={t('Текст напоминания')}
          controlId="food-reminder-template"
          hint={t('Можно вставить: {list}. Пусто: текст по умолчанию.', { list: FOOD_REMINDER_PLACEHOLDERS.map((p) => `{${p}}`).join(' ') })}
        >
          <Textarea
            name="template"
            rows={4}
            maxLength={1000}
            value={template}
            placeholder={FOOD_DEFAULT_REMINDER_TEMPLATE}
            onChange={(event) => setTemplate(event.target.value)}
          />
        </Field>
        <div className="rest-reminders__preview" aria-label={t('Как увидит гость')}>
          <span className="muted">{t('Как увидит гость')}</span>
          <p data-testid="food-reminder-preview">{preview}</p>
        </div>
        <Field
          label={t('Шаблон WhatsApp')}
          controlId="food-reminder-wa-template"
          hint={
            data.whatsappConnected
              ? t('Имя шаблона, одобренного в кабинете Meta')
              : t('Номер WhatsApp ресторана пока не подключён: напоминания будут в списке «Напомнить сегодня»')
          }
        >
          <Input name="whatsappTemplateName" defaultValue={data.whatsappTemplateName ?? ''} placeholder="restaurant_reminder" />
        </Field>
      </fieldset>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.data && <Alert tone="success">{t('Напоминания сохранены. Будущие брони получат новое расписание.')}</Alert>}
      {canEdit && (
        <Button type="submit" disabled={pending}>
          {pending ? t('Сохраняем…') : t('Сохранить напоминания')}
        </Button>
      )}
    </form>
  );
}
