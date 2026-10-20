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

/**
 * Кампании «Рекламы» (DATA_MODEL §53, ADR-MKT-B3): создание и правка кампании, статистика по дням вручную и CSV.
 * Панели те же, что у «Бюджета» (`Overlay drawer`, `settings-service-form`).
 */

export function CampaignButton({ campaign }: { campaign?: MarketingCampaignView | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        tone={campaign ? 'ghost' : undefined}
        size={campaign ? 'xs' : undefined}
        onClick={() => setOpen(true)}
        data-testid={campaign ? `campaign-edit-${campaign.id}` : 'campaign-add'}
        aria-label={campaign ? `Изменить кампанию ${campaign.name}` : undefined}
      >
        {!campaign && <Icon name="plus" width={16} aria-hidden="true" />}
        {campaign ? 'Изменить' : 'Создать кампанию'}
      </Button>
      {open && (
        <Overlay open drawer className="settings-service-drawer" title={campaign ? 'Кампания' : 'Новая кампания'} onClose={() => setOpen(false)}>
          <CampaignForm campaign={campaign} onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

function CampaignForm({ campaign, onClose }: { campaign?: MarketingCampaignView | undefined; onClose: () => void }) {
  const [state, action, pending] = useBudgetAction(saveCampaignAction, onClose);
  const v = (name: string, fallback: string | null | undefined) => state.values?.[name] ?? fallback ?? '';
  return (
    <form action={action} className="settings-service-form" data-testid="campaign-form">
      {state.error && <Alert boxed>{state.error}</Alert>}
      {campaign && <input type="hidden" name="id" value={campaign.id} />}
      <Field label="Площадка">
        <Select name="platform" required defaultValue={v('platform', campaign?.platform ?? 'META')} data-testid="campaign-platform">
          {Object.entries(PLATFORM_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Название">
        <Input name="name" required maxLength={200} autoFocus defaultValue={v('name', campaign?.name)} data-testid="campaign-name" />
      </Field>
      <Field label="Статус">
        <Select name="status" defaultValue={v('status', campaign?.status ?? 'ACTIVE')} data-testid="campaign-status">
          {Object.entries(CAMPAIGN_STATUS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Начало">
        <Input name="startsOn" type="date" defaultValue={v('startsOn', campaign?.startsOn)} />
      </Field>
      <Field label="Окончание">
        <Input name="endsOn" type="date" defaultValue={v('endsOn', campaign?.endsOn)} />
      </Field>
      <p className="settings-note">
        Расход кампании берётся из журнала «Бюджета»: выберите кампанию в форме расхода. Кампания не удаляется,
        её завершают статусом.
      </p>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="campaign-save">
          {pending ? 'Сохраняю…' : campaign ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
}

/** «Статистика»: день вручную, загрузка CSV и список дней месяца; панель после ввода не закрывается */
export function StatsButton({ campaign, today }: { campaign: MarketingCampaignView; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        tone="ghost"
        size="xs"
        onClick={() => setOpen(true)}
        data-testid={`campaign-stats-${campaign.id}`}
        aria-label={`Статистика кампании ${campaign.name}`}
      >
        Статистика
      </Button>
      {open && (
        <Overlay open drawer className="settings-service-drawer" title={`Статистика: ${campaign.name}`} onClose={() => setOpen(false)}>
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
  const error = day.error ?? imported.error ?? removed.error;
  return (
    <div className="settings-service-form" data-testid="campaign-stats-panel">
      {error && (
        <Alert boxed className="budget-import-error">
          {error}
        </Alert>
      )}
      <form action={saveDay} className="budget-files__add" data-testid="campaign-day-form" key={day.ok}>
        <input type="hidden" name="id" value={campaign.id} />
        <p className="settings-note">Цифры дня из кабинета площадки. Повторный ввод того же дня заменяет его.</p>
        <Field label="День">
          <Input name="date" type="date" required defaultValue={day.values?.['date'] ?? today} data-testid="campaign-day-date" />
        </Field>
        <Field label="Показы">
          <Input name="impressions" inputMode="numeric" defaultValue={day.values?.['impressions'] ?? ''} data-testid="campaign-day-impressions" />
        </Field>
        <Field label="Клики">
          <Input name="clicks" inputMode="numeric" defaultValue={day.values?.['clicks'] ?? ''} data-testid="campaign-day-clicks" />
        </Field>
        <Field label="Лиды площадки">
          <Input name="leads" inputMode="numeric" defaultValue={day.values?.['leads'] ?? ''} data-testid="campaign-day-leads" />
        </Field>
        <Button type="submit" tone="secondary" size="sm" disabled={saving} aria-busy={saving} data-testid="campaign-day-save">
          {saving ? 'Сохраняю…' : 'Сохранить день'}
        </Button>
      </form>
      <form action={importDays} className="budget-files__add" data-testid="campaign-import-form" key={`i${imported.ok}`}>
        <input type="hidden" name="id" value={campaign.id} />
        <Field label="Или файл CSV: Дата;Показы;Клики;Лиды">
          <Input type="file" name="file" accept=".csv,text/csv" required data-testid="campaign-import-file" />
        </Field>
        <Button type="submit" tone="secondary" size="sm" disabled={importing} aria-busy={importing} data-testid="campaign-import-save">
          {importing ? 'Загружаю…' : 'Загрузить CSV'}
        </Button>
      </form>
      {campaign.days.length === 0 ? (
        <p className="settings-note">За этот месяц статистики пока нет.</p>
      ) : (
        <ul className="budget-files__list" data-testid="campaign-days">
          {campaign.days.map((d) => (
            <li key={d.date} className="budget-files__item">
              <time dateTime={d.date} className="budget-files__name">
                {displayDate(d.date)}: {d.impressions} показов, {d.clicks} кликов, {d.leads} лидов
              </time>
              <form action={removeDay}>
                <input type="hidden" name="id" value={campaign.id} />
                <input type="hidden" name="date" value={d.date} />
                <Button
                  type="button"
                  tone="ghost"
                  size="xs"
                  disabled={removing}
                  aria-label={`Удалить день ${displayDate(d.date)}`}
                  onClick={async (e) => {
                    const form = e.currentTarget.form;
                    const yes = await ask({
                      title: 'Удалить день?',
                      body: 'Показы, клики и лиды этого дня уйдут из статистики; запись останется в журнале организации.',
                      confirmLabel: 'Удалить',
                      tone: 'danger',
                    });
                    if (yes) form?.requestSubmit();
                  }}
                >
                  Удалить
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
