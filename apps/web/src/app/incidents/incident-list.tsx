'use client';
import { useState } from 'react';
import type { Incident } from '../../lib/api';
import { almatyStamp } from '../../lib/almaty';
import { Badge, Button, Field, Input, Select, Table } from '../../components/ui';
import { IncidentButtons } from './buttons';

const CLASS_RU: Record<Incident['class'], string> = {
  A: 'техника — сторож чинит сам',
  B: 'данные — решает человек',
  C: 'код — исправляет дежурный агент',
};
const STATUS_RU: Record<Incident['status'], string> = {
  OPEN: 'замечена',
  FIXING: 'сторож чинит',
  ESCALATED: 'ждёт человека',
  ACKNOWLEDGED: 'принято',
  RESOLVED: 'закрыта',
};
const STATUS_TONE: Record<Incident['status'], 'info' | 'warn' | 'danger' | 'ok' | 'neutral'> = {
  OPEN: 'info',
  FIXING: 'info',
  ESCALATED: 'danger',
  ACKNOWLEDGED: 'warn',
  RESOLVED: 'ok',
};

const stamp = (iso: string) => <time dateTime={iso}>{almatyStamp(iso)}</time>;

export function IncidentList({
  incidents,
  total,
  emptyHint,
}: {
  incidents: Array<
    Pick<
      Incident,
      | 'id'
      | 'kind'
      | 'class'
      | 'severity'
      | 'status'
      | 'title'
      | 'occurrences'
      | 'firstSeenAt'
      | 'lastSeenAt'
      | 'fixAttempts'
      | 'lastFixResult'
      | 'alertedAt'
    >
  >;
  total: number | null;
  emptyHint: string;
}) {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const filtered = !!query || severity !== 'ALL' || status !== 'ALL';
  const rows = incidents.filter(
    (item) =>
      `${item.title} ${item.kind} ${item.lastFixResult ?? ''}`
        .toLocaleLowerCase('ru')
        .includes(query.trim().toLocaleLowerCase('ru')) &&
      (severity === 'ALL' || item.severity === severity) &&
      (status === 'ALL' || item.status === status),
  );
  return (
    <section className="control-list" aria-label="Открытые неисправности">
      <div className="control-toolbar">
        <Field label="Поиск неисправности">
          <Input
            type="search"
            placeholder="Название или результат проверки"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <Field label="Срочность">
          <Select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="ALL">Любая срочность</option>
            <option value="CRITICAL">Срочные</option>
            <option value="WARNING">Несрочные</option>
          </Select>
        </Field>
        <Field label="Статус неисправности">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">Все открытые</option>
            {Object.entries(STATUS_RU)
              .filter(([value]) => value !== 'RESOLVED')
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </Select>
        </Field>
        {filtered && (
          <Button
            tone="ghost"
            onClick={() => {
              setQuery('');
              setSeverity('ALL');
              setStatus('ALL');
            }}
          >
            Сбросить фильтры
          </Button>
        )}
      </div>
      <p className="control-result" role="status">
        Показано {rows.length} из {incidents.length} загруженных
      </p>
      {total !== null && total > incidents.length && (
        <p className="note">
          Загружены последние {incidents.length} из {total} открытых неисправностей.
        </p>
      )}
      <Table
        size="sm"
        className="dir-table dir-table--incidents control-table"
        data-testid="incidents-table"
      >
        <thead>
          <tr>
            {['Что случилось', 'Статус', 'Замечена', 'Что делал сторож', ''].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {incidents.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-state" data-testid="incidents-empty">
                {emptyHint}
              </td>
            </tr>
          )}
          {incidents.length > 0 && rows.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-state" data-testid="incidents-filter-empty">
                По этим фильтрам неисправностей нет. Измените условия или сбросьте фильтры.
              </td>
            </tr>
          )}
          {rows.map((i) => (
            <tr key={i.id} data-testid="incident-row" data-kind={i.kind} data-id={i.id}>
              <td>
                <Badge tone={i.severity === 'CRITICAL' ? 'danger' : 'warn'}>
                  {i.severity === 'CRITICAL' ? 'срочно' : 'не срочно'}
                </Badge>{' '}
                {i.title}
                <div className="cell-sub">{CLASS_RU[i.class]}</div>
              </td>
              <td>
                <Badge tone={STATUS_TONE[i.status]} data-testid="incident-status">
                  {STATUS_RU[i.status]}
                </Badge>
                {i.alertedAt && <div className="cell-sub">разбудил {stamp(i.alertedAt)}</div>}
              </td>
              <td className="nowrap">
                {stamp(i.firstSeenAt)}
                {/* Счётчик растёт на каждом проходе сторожа: у ошибки API это повторы, у остального — минуты,
                    пока неисправность держится. «Замечена 47 раз» у брони без ячейки читалось бы как 47 случаев */}
                {i.kind === 'api.error'
                  ? i.occurrences > 1 && (
                      <div className="cell-sub">повторилась {i.occurrences} раз</div>
                    )
                  : Date.parse(i.lastSeenAt) - Date.parse(i.firstSeenAt) >= 60_000 && (
                      <div className="cell-sub">
                        держится{' '}
                        {Math.round(
                          (Date.parse(i.lastSeenAt) - Date.parse(i.firstSeenAt)) / 60_000,
                        )}{' '}
                        мин
                      </div>
                    )}
              </td>
              <td>
                {i.fixAttempts > 0 ? `${i.fixAttempts} попыт. — ` : ''}
                {i.lastFixResult ?? (i.class === 'A' ? 'ждёт' : 'не чинит — не его класс')}
              </td>
              <td>
                <IncidentButtons id={i.id} canAcknowledge={i.status !== 'ACKNOWLEDGED'} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
