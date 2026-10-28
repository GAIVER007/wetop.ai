'use client';
import { useState, useTransition } from 'react';
import { Alert, Badge, Button, EmptyState, Table } from '../../../../components/ui';
import { useT } from '../../../../i18n/locale-provider';
import { msg } from '../../../../i18n';
import type { SiteLeadStatus, SiteLeadView } from '../../../../lib/api';
import { leadStatusAction } from './actions';
import { LEAD_NEXT } from './lead-flow';

/**
 * «Заявки с сайта» (аудит «Сайт и SEO» 28.10.2026, S3). Запись и бронь с выбором времени сразу встают в журнал
 * (SITE-4/5), а сюда приходит то, что без времени: «перезвоните мне» и вопросы. Каждую заявку берут в работу и
 * закрывают; спам убирается из новых. Тот же статус видит API (`PATCH /marketing/site/leads/:id`, право `dialogs`).
 */
const STATUS_LABEL: Record<SiteLeadStatus, string> = {
  NEW: msg('Новая'),
  IN_PROGRESS: msg('В работе'),
  DONE: msg('Готово'),
  SPAM: msg('Спам'),
};
const STATUS_TONE = { NEW: 'info', IN_PROGRESS: 'warn', DONE: 'ok', SPAM: 'neutral' } as const;
const ACTION_LABEL: Record<SiteLeadStatus, string> = {
  NEW: msg('Вернуть в новые'),
  IN_PROGRESS: msg('Взять в работу'),
  DONE: msg('Готово'),
  SPAM: msg('Спам'),
};
const KIND_LABEL: Record<string, string> = { CALLBACK: msg('Перезвонить'), OTHER: msg('Вопрос') };

const when = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale === 'kk' ? 'kk-KZ' : locale === 'en' ? 'en-GB' : 'ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export function LeadsBoard({ items, readOnly, locale }: { items: SiteLeadView[]; readOnly: boolean; locale: string }) {
  const t = useT();
  const [rows, setRows] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const move = (lead: SiteLeadView, status: SiteLeadStatus) =>
    start(async () => {
      const r = await leadStatusAction(lead.id, status);
      if (r.error) return setError(r.error);
      setError(null);
      setRows((all) => all.map((x) => (x.id === lead.id ? { ...x, status } : x)));
    });
  if (rows.length === 0)
    return (
      <EmptyState title={t('Заявок пока нет')} data-testid="site-leads-empty">
        {t('Здесь появятся просьбы перезвонить и вопросы с сайта. Запись и бронь с выбором времени сразу встают в журнал.')}
      </EmptyState>
    );
  return (
    <>
      {error && (
        <Alert boxed tone="warning" role="alert" data-testid="site-leads-error">
          {error}
        </Alert>
      )}
      <Table stack aria-label={t('Заявки с сайта')} data-testid="site-leads">
        <thead>
          <tr>
            <th scope="col">{t('Когда')}</th>
            <th scope="col">{t('Клиент')}</th>
            <th scope="col">{t('Что нужно')}</th>
            <th scope="col">{t('Статус')}</th>
            <th scope="col">
              <span className="sr-only">{t('Действия')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => (
            <tr key={lead.id} data-testid="site-lead" data-status={lead.status}>
              <td data-label={t('Когда')}>{when(lead.createdAt, locale)}</td>
              <td data-label={t('Клиент')}>
                <strong>{lead.name}</strong>
                <br />
                <a href={`tel:${lead.phone}`}>{lead.phone}</a>
              </td>
              <td data-label={t('Что нужно')}>
                {t(KIND_LABEL[lead.kind] ?? KIND_LABEL['OTHER']!)}
                {lead.comment && <div className="muted">{lead.comment}</div>}
              </td>
              <td data-label={t('Статус')}>
                <Badge tone={STATUS_TONE[lead.status]}>{t(STATUS_LABEL[lead.status])}</Badge>
              </td>
              <td className="site-leads__actions">
                {LEAD_NEXT[lead.status].map((next) => (
                  <Button
                    key={next}
                    type="button"
                    tone={next === 'SPAM' || next === 'NEW' ? 'secondary' : 'primary'}
                    disabled={readOnly || pending}
                    onClick={() => move(lead, next)}
                    data-testid={`site-lead-${next.toLowerCase()}`}
                  >
                    {t(ACTION_LABEL[next])}
                  </Button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
