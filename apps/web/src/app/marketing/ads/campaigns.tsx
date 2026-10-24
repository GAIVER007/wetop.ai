'use client';
import { useState } from 'react';
import type { MarketingCampaignView } from '../../../lib/api';
import { displayDate } from '../../../lib/display-date';
import { Icon } from '../../../components/icon';
import { Overlay } from '../../../components/overlay';
import { useConfirm } from '../../../components/use-confirm';
import { Alert, Button, Field, Input, Select } from '../../../components/ui';
import {
  importCampaignDaysAction,
  removeCampaignDayAction,
  saveCampaignAction,
  saveCampaignDayAction,
} from '../budget/actions';
import { useBudgetAction, useFileAction } from '../budget/drawers';
import { PLATFORM_LABELS } from '../budget/parts';
import { CAMPAIGN_STATUS } from './labels';
import { useLocale, useT } from '../../../i18n/locale-provider';
import { intlLocale } from '../../../i18n';

/**
 * Кампании «Рекламы» (DATA_MODEL §53, ADR-MKT-B3): создание и правка кампании, статистика по дням вручную и CSV.
 * Панели те же, что у «Бюджета» (`Overlay drawer`, `settings-service-form`).
 */

export function CampaignButton({ campaign }: { campaign?: MarketingCampaignView | undefined }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <>
      <Button
        type="button"
        tone={campaign ? 'ghost' : undefined}
        size={campaign ? 'xs' : undefined}
        onClick={() => setOpen(true)}
        data-testid={campaign ? `campaign-edit-${campaign.id}` : 'campaign-add'}
        aria-label={campaign ? t('Изменить кампанию {name}', { name: campaign.name }) : undefined}
      >
        {!campaign && <Icon name="plus" width={16} aria-hidden="true" />}
        {campaign ? t('Изменить') : t('Создать кампанию')}
      </Button>
      {open && (
        <Overlay open drawer className="settings-service-drawer" title={campaign ? t('Кампания') : t('Новая кампания')} onClose={() => setOpen(false)}>
          <CampaignForm campaign={campaign} onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

function CampaignForm({ campaign, onClose }: { campaign?: MarketingCampaignView | undefined; onClose: () => void }) {
  const [state, action, pending] = useBudgetAction(saveCampaignAction, onClose);
  const t = useT();
  const v = (name: string, fallback: string | null | undefined) => state.values?.[name] ?? fallback ?? '';
  return (
    <form action={action} className="settings-service-form" data-testid="campaign-form">
      {state.error && <Alert boxed>{t(state.error)}</Alert>}
      {campaign && <input type="hidden" name="id" value={campaign.id} />}
      <Field label={t('Площадка')}>
        <Select name="platform" required defaultValue={v('platform', campaign?.platform ?? 'META')} data-testid="campaign-platform">
          {Object.entries(PLATFORM_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {t(label)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('Название')}>
        <Input name="name" required maxLength={200} autoFocus defaultValue={v('name', campaign?.name)} data-testid="campaign-name" />
      </Field>
      <Field label={t('Статус')}>
        <Select name="status" defaultValue={v('status', campaign?.status ?? 'ACTIVE')} data-testid="campaign-status">
          {Object.entries(CAMPAIGN_STATUS).map(([code, label]) => (
            <option key={code} value={code}>
              {t(label)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('Начало')}>
        <Input name="startsOn" type="date" defaultValue={v('startsOn', campaign?.startsOn)} />
      </Field>
      <Field label={t('Окончание')}>
        <Input name="endsOn" type="date" defaultValue={v('endsOn', campaign?.endsOn)} />
      </Field>
      <p className="settings-note">
        {t('Расход кампании берётся из журнала «Бюджета»: выберите кампанию в форме расхода. Кампания не удаляется, её завершают статусом.')}
      </p>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onClose}>
          {t('Отмена')}
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="campaign-save">
          {pending ? t('Сохраняю…') : campaign ? t('Сохранить') : t('Создать')}
        </Button>
      </div>
    </form>
  );
}

/** «Статистика»: день вручную, загрузка CSV и список дней месяца; панель после ввода не закрывается */
export function StatsButton({ campaign, today }: { campaign: MarketingCampaignView; today: string }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <>
      <Button
        type="button"
        tone="ghost"
        size="xs"
        onClick={() => setOpen(true)}
        data-testid={`campaign-stats-${campaign.id}`}
        aria-label={t('Статистика кампании {name}', { name: campaign.name })}
      >
        {t('Статистика')}
      </Button>
      {open && (
        <Overlay open drawer className="settings-service-drawer" title={t('Статистика: {name}', { name: campaign.name })} onClose={() => setOpen(false)}>
          <StatsPanel campaign={campaign} today={today} />
        </Overlay>
      )}
    </>
  );
}

function StatsPanel({ campaign, today }: { campaign: MarketingCampaignView; today: string }) {
  const [day, saveDay, saving] = useFileAction(saveCampaignDayAction);
  const [imported, importDays, importing] = useFileAction(importCampaignDaysAction);
  const [removed, removeDay, removing] = useFileAction(removeCampaignDayAction);
  const { ask, dialog } = useConfirm();
  const t = useT();
  const locale = intlLocale(useLocale());
  const error = day.error ?? imported.error ?? removed.error;
  return (
    <div className="settings-service-form" data-testid="campaign-stats-panel">
      {error && (
        <Alert boxed className="budget-import-error">
          {t(error)}
        </Alert>
      )}
      <form action={saveDay} className="budget-files__add" data-testid="campaign-day-form" key={day.ok}>
        <input type="hidden" name="id" value={campaign.id} />
        <p className="settings-note">{t('Цифры дня из кабинета площадки. Повторный ввод того же дня заменяет его.')}</p>
        <Field label={t('День')}>
          <Input name="date" type="date" required defaultValue={day.values?.['date'] ?? today} data-testid="campaign-day-date" />
        </Field>
        <Field label={t('Показы')}>
          <Input name="impressions" inputMode="numeric" defaultValue={day.values?.['impressions'] ?? ''} data-testid="campaign-day-impressions" />
        </Field>
        <Field label={t('Клики')}>
          <Input name="clicks" inputMode="numeric" defaultValue={day.values?.['clicks'] ?? ''} data-testid="campaign-day-clicks" />
        </Field>
        <Field label={t('Лиды площадки')}>
          <Input name="leads" inputMode="numeric" defaultValue={day.values?.['leads'] ?? ''} data-testid="campaign-day-leads" />
        </Field>
        <Button type="submit" tone="secondary" size="sm" disabled={saving} aria-busy={saving} data-testid="campaign-day-save">
          {saving ? t('Сохраняю…') : t('Сохранить день')}
        </Button>
      </form>
      <form action={importDays} className="budget-files__add" data-testid="campaign-import-form" key={`i${imported.ok}`}>
        <input type="hidden" name="id" value={campaign.id} />
        <Field label={t('Или файл CSV: Дата;Показы;Клики;Лиды')}>
          <Input type="file" name="file" accept=".csv,text/csv" required data-testid="campaign-import-file" />
        </Field>
        <Button type="submit" tone="secondary" size="sm" disabled={importing} aria-busy={importing} data-testid="campaign-import-save">
          {importing ? t('Загружаю…') : t('Загрузить CSV')}
        </Button>
      </form>
      {campaign.days.length === 0 ? (
        <p className="settings-note">{t('За этот месяц статистики пока нет.')}</p>
      ) : (
        <ul className="budget-files__list" data-testid="campaign-days">
          {campaign.days.map((d) => (
            <li key={d.date} className="budget-files__item">
              <time dateTime={d.date} className="budget-files__name">
                {t('{date}: {impressions} показов, {clicks} кликов, {leads} лидов', { date: displayDate(d.date, undefined, locale), impressions: d.impressions, clicks: d.clicks, leads: d.leads })}
              </time>
              <form action={removeDay}>
                <input type="hidden" name="id" value={campaign.id} />
                <input type="hidden" name="date" value={d.date} />
                <Button
                  type="button"
                  tone="ghost"
                  size="xs"
                  disabled={removing}
                  aria-label={t('Удалить день {date}', { date: displayDate(d.date, undefined, locale) })}
                  onClick={async (e) => {
                    const form = e.currentTarget.form;
                    const yes = await ask({
                      title: t('Удалить день?'),
                      body: t('Показы, клики и лиды этого дня уйдут из статистики; запись останется в журнале организации.'),
                      confirmLabel: t('Удалить'),
                      tone: 'danger',
                    });
                    if (yes) form?.requestSubmit();
                  }}
                >
                  {t('Удалить')}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </div>
  );
}
