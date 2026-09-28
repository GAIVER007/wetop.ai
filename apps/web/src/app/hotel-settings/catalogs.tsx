'use client';
import { useState } from 'react';
import type { ServiceOption } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Button, Field, Input, Table } from '../../components/ui';

const matches = (query: string, values: Array<string | null>) =>
  values
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ru')
    .includes(query.trim().toLocaleLowerCase('ru'));

export function ServicesCatalog({
  services,
  currency,
}: {
  services: ServiceOption[];
  currency: string;
}) {
  const [query, setQuery] = useState('');
  const rows = services.filter((s) => matches(query, [s.nameRu, s.nameKz, s.code, s.group]));
  return (
    <section className="settings-catalog" aria-label="Каталог услуг">
      <div className="settings-toolbar">
        <Field label="Найти услугу">
          <Input
            type="search"
            placeholder="Название, код или группа"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <span className="settings-count" role="status">
          Показано {rows.length} из {services.length}
        </span>
        {query && (
          <Button tone="ghost" onClick={() => setQuery('')}>
            Сбросить поиск
          </Button>
        )}
      </div>
      <Table data-testid="services-table" className="settings-table">
        <thead>
          <tr>
            <th>Услуга</th>
            <th>Группа</th>
            <th className="num">Цена</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.code}>
              <td>
                <strong>{s.nameRu}</strong>
                {(s.code !== s.nameRu || (s.nameKz && s.nameKz !== s.nameRu)) && (
                  <span className="cell-sub">
                    {[
                      ...new Set([s.code, s.nameKz].filter((value) => value && value !== s.nameRu)),
                    ].join(', ')}
                  </span>
                )}
              </td>
              <td>{s.group ?? 'Без группы'}</td>
              <td className="num">{formatMoney(s.priceMinor, currency)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td
                colSpan={3}
                className="empty-state"
                data-testid={services.length ? 'services-no-results' : 'services-empty'}
              >
                {services.length
                  ? 'Ничего не найдено. Измените запрос или сбросьте поиск.'
                  : 'Услуг в каталоге пока нет.'}
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </section>
  );
}
