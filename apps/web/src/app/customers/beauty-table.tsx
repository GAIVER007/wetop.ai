'use client';
import Link from 'next/link';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, EmptyState, Input, Select, Table } from '../../components/ui';
import { Overlay } from '../../components/overlay';
import { CreateCustomer } from './create-customer';
import type { BeautyCustomerRow } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { CustomerMarks } from '../food/customer-marks';
import { markBeautyCustomer } from './actions';
import './customers.css';
import {
  BEAUTY_REGULAR_CUSTOMER_VISITS,
  customerSegment,
  filterBeautyCustomers,
  type BeautyCustomerSegmentFilter,
} from './customer-filter';
import { formatPhone } from '../../lib/phone';
import { intlLocale, type DeskLocale, type Translate } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { dateFormat } from '../../i18n/dates';

/**
 * Клиенты салона по макету ТЗ (09.10.2026): телефон, последний визит, всего визитов, средний чек и
 * сегмент. Сегмент производный (Q-BS-3): «Новый» меньше двух завершённых визитов, «Постоянный» от двух;
 * VIP и день рождения ручные (§36, общие с рестораном). Поиск и отбор на клиенте: список уже загружен целиком.
 */
export const REGULAR_FROM = BEAUTY_REGULAR_CUSTOMER_VISITS;

// как у ресторана (food/customers.tsx): «15 марта», без года
const dayMonth = (iso: string, locale: DeskLocale) =>
  dateFormat(intlLocale(locale), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
const birthday = (row: BeautyCustomerRow, t: Translate, locale: DeskLocale) =>
  !row.birthDate
    ? t('Не указан')
    : row.birthdayInDays === 0
      ? t('{date}, сегодня', { date: dayMonth(row.birthDate, locale) })
      : (row.birthdayInDays ?? 99) <= 7
        ? t('{date}, через {days}', {
            date: dayMonth(row.birthDate, locale),
            days: pluralRu(row.birthdayInDays!, [t('день'), t('дня'), t('дней')]),
          })
        : dayMonth(row.birthDate, locale);

const segment = (row: BeautyCustomerRow) => customerSegment(row);

export function BeautyCustomersTable({
  items,
  canCreate = false,
  canEdit = false,
  scopeKey = '',
  businessId = '',
  tools,
}: {
  /** импорт клиентов: кнопка в той же панели, что поиск и «Скачать Excel» (аудит 21.10.2026 п.44) */
  tools?: ReactNode;
  items: BeautyCustomerRow[];
  canCreate?: boolean;
  canEdit?: boolean;
  scopeKey?: string;
  businessId?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState<{ id: string; created: boolean } | null>(null);
  const onSaved = useCallback((id: string, created: boolean) => {
    setCreating(false);
    setQuery('');
    setFilter('all');
    setSaved({ id, created });
    router.refresh();
  }, [router]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BeautyCustomerSegmentFilter>('all');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const searchId = useId();
  const rows = filterBeautyCustomers(items, { query, segment: filter });
  const download = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch('/customers/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scopeKey, query, segment: filter }),
      });
      if (!response.ok) throw new Error((await response.text()) || t('Не удалось выгрузить клиентов'));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `wetop-customers-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : t('Не удалось выгрузить клиентов'));
    } finally {
      setExporting(false);
    }
  };
  // новый клиент ещё без оплаченного визита: показываем его отбор, иначе карточка пропала бы из «Все клиенты»
  useEffect(() => {
    if (!saved) return;
    const row = items.find((item) => item.id === saved.id);
    if (row && !filterBeautyCustomers([row], { query: '', segment: filter }).length)
      setFilter(row.status !== 'ACTIVE' ? 'archived' : row.paidVisits > 0 ? 'all' : row.noShows > 0 ? 'no-show' : 'pending');
    document.getElementById(`customer-${saved.id}`)?.focus();
  }, [saved, items, filter]);
  return (
    <>
      <div className="beauty-customers-bar beauty-customers-controls">
        <div className="beauty-customers-bar__filters">
          <Input
            id={searchId}
            type="search"
            aria-label={t('Поиск по имени или телефону')}
            placeholder={t('Имя или телефон')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select
            aria-label={t('Сегмент')}
            value={filter}
            onChange={(e) => setFilter(e.target.value as BeautyCustomerSegmentFilter)}
          >
            <option value="all">{t('Все клиенты')}</option>
            <option value="new">{t('Новые')}</option>
            <option value="regular">{t('Постоянные')}</option>
            <option value="vip">VIP</option>
            <option value="no-show">{t('Не дошли')}</option>
            <option value="pending">{t('Пока без визита')}</option>
            <option value="archived">{t('В архиве')}</option>
          </Select>
        </div>
        <div className="beauty-customers-bar__actions">
          {tools}
          <Button
            type="button"
            tone="secondary"
            data-scope-key={scopeKey}
            onClick={download}
            disabled={exporting || !scopeKey}
            aria-busy={exporting}
          >
            {t('Скачать Excel')}
          </Button>
          {canCreate && <Button type="button" onClick={() => setCreating(true)}>{t('Добавить клиента')}</Button>}
        </div>
      </div>
      {exportError && <Alert>{exportError}</Alert>}
      {saved && <p role="status">{saved.created ? t('Клиент создан.') : t('Клиент уже есть. Используем существующую карточку.')}</p>}
      {items.length === 0 ? (
        <EmptyState
          title={t('Клиентов пока нет')}
          actions={canCreate ? <Button type="button" onClick={() => setCreating(true)}>{t('Добавить первого клиента')}</Button> : undefined}
        >
          {t('Добавьте первого клиента или импортируйте список из CSV или Excel.')}
        </EmptyState>
      ) : (
      <>
      <Table className="beauty-customers-table">
        <thead>
          <tr>
            <th>{t('Клиент')}</th>
            <th>{t('Телефон')}</th>
            <th className="beauty-col-wide">{t('Последний визит')}</th>
            <th>{t('Всего визитов')}</th>
            <th className="beauty-col-wide">{t('Средний чек')}</th>
            <th>{t('Статус')}</th>
            <th>{t('День рождения')}</th>
            {canEdit && <th><span className="sr-only">{t('Действия')}</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 8 : 7}>{t('Никого не нашли. Поменяйте поиск или сегмент.')}</td>
            </tr>
          )}
          {rows.map((row) => {
            const s = segment(row);
            const visitDate = row.lastVisitLocalDate;
            return (
              <tr key={row.id} id={`customer-${row.id}`} tabIndex={-1}>
                <td data-label={t('Клиент')}>
                  <strong>
                    <Link href={`/customers/${encodeURIComponent(row.id)}`}>
                      {[row.firstName, row.lastName].filter(Boolean).join(' ')}
                    </Link>
                  </strong>{' '}
                  {row.isVip && <Badge tone="warn">VIP</Badge>}
                </td>
                <td data-label={t('Телефон')} className="beauty-customer-contact">{row.phone ? <a href={`tel:${row.phone}`}>{formatPhone(row.phone)}</a> : t('Не указан')}</td>
                <td data-label={t('Последний визит')} className="beauty-col-wide">
                  {visitDate ? (
                    <time dateTime={visitDate}>
                      {locale === 'ru'
                        ? displayDate(visitDate)
                        : dateFormat(intlLocale(locale), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${visitDate}T00:00:00Z`))}
                    </time>
                  ) : (
                    row.lastVisitAt ? t('Дата визита недоступна') : t('Визитов не было')
                  )}
                </td>
                <td data-label={t('Всего визитов')}>{row.visits}</td>
                <td data-label={t('Средний чек')} className="beauty-col-wide">
                  {row.avgCheckMinor
                    ? formatMoney(row.avgCheckMinor, row.avgCheckCurrency ?? 'KZT')
                    : t('Нет данных')}
                </td>
                <td data-label={t('Статус')}>
                  <Badge tone={s.tone}>{t(s.label)}</Badge>
                </td>
                <td data-label={t('День рождения')} data-testid="customer-birthday">{birthday(row, t, locale)}</td>
                {canEdit && (
                  <td>
                    <CustomerMarks
                      scopeKey={scopeKey}
                      customer={{ id: row.id, name: [row.firstName, row.lastName].filter(Boolean).join(' '), isVip: row.isVip, birthDate: row.birthDate }}
                      save={markBeautyCustomer}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>
      <p role="status" className="beauty-customers-total">
        {rows.length === items.length
          ? t('Всего: {count}', { count: pluralRu(items.length, [t('клиент'), t('клиента'), t('клиентов')]) })
          : t('Показано {shown} из {total}', { shown: rows.length, total: items.length })}
      </p>
      </>
      )}
      {canCreate && <Overlay open={creating} onClose={() => setCreating(false)} title={t('Добавить клиента')} drawer trapFocus>
        {creating && <CreateCustomer key={businessId} businessId={businessId} onSaved={onSaved} />}
      </Overlay>}
    </>
  );
}
