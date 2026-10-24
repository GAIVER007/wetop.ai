'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, EmptyState, Field, Input, Row, Select, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import type { PlatformOrganization, PlatformVertical } from '../../lib/api';
import { PLATFORM_STATUS_LABEL, PLATFORM_VERTICAL_LABEL, organizationSince, organizationStatusLine } from '../../lib/platform';
import { useT } from '../../i18n/locale-provider';
import { sellerText, statusText } from './words';

/**
 * Таблица клиентов платформы (срез P1, макет владельца): поиск по названию и почте владельца, отбор по статусу
 * и направлению. Организаций немного, отбор идёт на клиенте без запросов к API. Колонок «Пакет», «Сумма» и
 * «Город» нет: пакетов и платежей в модели нет (Q-PA-1, Q-PA-2), города у организации нет.
 */
export function ClientsTable({
  items,
  ownId,
  selected,
  archivedParam,
}: {
  items: PlatformOrganization[];
  ownId: string;
  selected: string;
  archivedParam: string;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [vertical, setVertical] = useState('');
  const t = useT();
  const needle = q.trim().toLowerCase();
  const visible = items.filter((o) => {
    if (status && o.status !== status) return false;
    if (vertical && !o.verticals.includes(vertical as PlatformVertical)) return false;
    if (!needle) return true;
    return (
      o.name.toLowerCase().includes(needle) ||
      o.owners.some((email) => email.toLowerCase().includes(needle))
    );
  });
  const filtered = Boolean(needle || status || vertical);
  return (
    <div className="stack stack--sm">
      <Row align="end" data-testid="platform-clients-filters">
        <Field label={t('Поиск')} controlId="platform-clients-search">
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder={t('Название или почта владельца')}
            data-testid="platform-clients-search"
          />
        </Field>
        <Field label={t('Статус')} controlId="platform-filter-status">
          <Select
            value={status}
            onChange={(e) => setStatus(e.currentTarget.value)}
            data-testid="platform-filter-status"
          >
            <option value="">{t('Все статусы')}</option>
            {Object.entries(PLATFORM_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('Направление')} controlId="platform-filter-vertical">
          <Select
            value={vertical}
            onChange={(e) => setVertical(e.currentTarget.value)}
            data-testid="platform-filter-vertical"
          >
            <option value="">{t('Все направления')}</option>
            {Object.entries(PLATFORM_VERTICAL_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </Select>
        </Field>
      </Row>
      {filtered && (
        <p className="muted" role="status" data-testid="platform-clients-count">
          {t('Показано {n} из {total}', { n: visible.length, total: items.length })}
          {status && t(', статус «{status}»', { status: t(PLATFORM_STATUS_LABEL[status] ?? status) })}
          {vertical && t(', направление «{vertical}»', { vertical: t(PLATFORM_VERTICAL_LABEL[vertical as PlatformVertical]) })}
        </p>
      )}
      {visible.length === 0 ? (
        <EmptyState
          icon={<Icon name="search" width={32} height={32} />}
          title={t('Под условия поиска никто не попал')}
          data-testid="platform-clients-empty"
        >
          {t('Смягчите поиск или снимите отбор по статусу и направлению.')}
        </EmptyState>
      ) : (
        <Table aria-label={t('Организации платформы')} data-testid="platform-organizations">
          <thead>
            <tr>
              <th>{t('Организация')}</th>
              <th>{t('Направление')}</th>
              <th>{t('Состояние')}</th>
              <th>{t('Филиалы')}</th>
              <th>{t('Людей')}</th>
              <th>{t('Владелец')}</th>
              <th>{t('Подключена')}</th>
              <th>{t('ИИ-продавец')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => {
              const line = organizationStatusLine(o);
              const seller = sellerText(o.aiSeller, t);
              return (
                <tr key={o.id} aria-current={o.id === selected ? 'true' : undefined}>
                  <td>
                    <Link href={`/platform?org=${o.id}${archivedParam}#organization`} prefetch={false}>
                      {o.name}
                    </Link>
                    {o.id === ownId && (
                      <>
                        {' '}
                        <Badge tone="info">{t('Ваша')}</Badge>
                      </>
                    )}
                    {o.ownerPending && (
                      <>
                        {' '}
                        <Badge tone="warn">{t('ждёт пароля')}</Badge>
                      </>
                    )}
                  </td>
                  <td>{o.verticals.map((v) => t(PLATFORM_VERTICAL_LABEL[v])).join(', ') || t('Не указано')}</td>
                  <td>
                    <Badge tone={line.tone}>{statusText(o, t)}</Badge>
                  </td>
                  <td>{o.locations}</td>
                  <td>{o.members}</td>
                  <td>{o.owners.length > 0 ? o.owners.join(', ') : t('Не указан')}</td>
                  <td>
                    <time dateTime={o.createdAt.slice(0, 10)}>{organizationSince(o.createdAt)}</time>
                  </td>
                  <td>
                    <Badge tone={seller.tone}>{seller.label}</Badge>
                    <span className="sub"> {seller.detail}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
