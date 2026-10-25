import Link from 'next/link';
import { demandLevel, formatOccupancy } from '@pms/domain';
import type { MarketCompetitor, MarketRates, MarketView } from '../../lib/api';
import { displayDay } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { Button, Field, SectionTitle, Select, Table, Badge, cx } from '../../components/ui';
import { CompetitorButton, OccupancyButton, RatesButton } from './drawers';
import { competitorStatus, permilleText } from './competitor-status';
import { msg } from '../../i18n';
import { serverT } from '../../i18n/server';

/**
 * Список конкурентов (SALES2.3b): район, тип, загрузка на сегодня, средняя цена по окну, изменение цены и статус
 * свежести. Отбор по району и типу простой формой с адресом; таблица «По ночам» ниже отбору не подчиняется.
 */
export async function CompetitorsTable({
  view,
  rates,
  today,
  editable,
  district,
  category,
  keep,
}: {
  view: MarketView;
  rates: MarketRates | null;
  today: string;
  editable: boolean;
  district: string;
  category: string;
  /** Остальные параметры адреса (период, сравнение): форма отбора их не теряет */
  keep: Array<[string, string]>;
}) {
  const t = await serverT();
  const byId = new Map(view.competitors.map((c) => [c.id, c]));
  const priceById = new Map(rates?.board.competitors.map((c) => [c.id, c]));
  const districts = [...new Set(view.competitors.flatMap((c) => (c.district ? [c.district] : [])))].sort();
  const categories = [...new Set(view.competitors.flatMap((c) => (c.category ? [c.category] : [])))].sort();
  const rows = view.board.competitors.filter((c) => {
    const full = byId.get(c.id);
    return (!district || full?.district === district) && (!category || full?.category === category);
  });
  const currency = rates?.currency ?? 'KZT';
  const filtered = district !== '' || category !== '';
  return (
    <section className="market-list" aria-labelledby="market-list-title" data-testid="market-competitors">
      <div className="market-list__head">
        <SectionTitle id="market-list-title" first>
          {t('Конкуренты')}
        </SectionTitle>
        {(districts.length > 0 || categories.length > 0) && (
          <form method="get" className="market-list__filters" data-testid="market-list-filters">
            {keep.map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <Field inline label={t('Район')}>
              <Select name="district" defaultValue={district} data-testid="market-filter-district">
                <option value="">{t('Все')}</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field inline label={t('Тип')}>
              <Select name="category" defaultValue={category} data-testid="market-filter-category">
                <option value="">{t('Все')}</option>
                {categories.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" tone="secondary" size="sm">
              {t('Показать')}
            </Button>
            {filtered && (
              <Link href={`/market?${new URLSearchParams(keep)}`} className="market-reset">
                {t('Сбросить')}
              </Link>
            )}
          </form>
        )}
      </div>
      <Table size="sm" density="normal" className="market-list__table" aria-label={t('Загрузка и цены по каждому конкуренту')} data-testid="market-list-table">
        <thead>
          <tr>
            <th scope="col">{t('Отель')}</th>
            <th scope="col">{t('Район')}</th>
            <th scope="col">{t('Тип')}</th>
            <th scope="col">{t('Загрузка сегодня')}</th>
            <th scope="col">{t('Средняя цена')}</th>
            <th scope="col">{t('Изменение цены')}</th>
            <th scope="col">{t('Статус')}</th>
            {editable && (
              <th scope="col">
                <span className="sr-only">{t('Действия')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={editable ? 8 : 7} data-testid="market-list-none">
                {t('По такому отбору конкурентов нет.')}
              </td>
            </tr>
          ) : (
            rows.map((c) => {
              const full = byId.get(c.id) as MarketCompetitor;
              const price = priceById.get(c.id);
              const cell = c.cells.find((x) => x.date === today);
              const now = cell?.bp ?? null;
              // снимок сборщика только уровнем: словом вместо прочерка (DATA_MODEL §23.1)
              const word =
                now === null && cell?.level
                  ? t({ SOLD_OUT: msg('Нет мест'), FEW_LEFT: msg('Мало мест'), AVAILABLE: msg('Есть места') }[cell.level])
                  : null;
              const level = word
                ? ({ SOLD_OUT: 'high', FEW_LEFT: 'mid', AVAILABLE: 'low' } as const)[cell!.level!]
                : demandLevel(now);
              const status = competitorStatus(today, c.lastObservedOn, price?.lastObservedOn ?? null, t);
              return (
                <tr key={c.id} data-testid={`market-list-row-${c.id}`}>
                  <th scope="row">
                    <span className="market-name">{c.name}</span>
                    <span className="market-sub">
                      {[full.address, c.distanceM !== null ? t('{n} м', { n: c.distanceM }) : null].filter(Boolean).join(', ') || ' '}
                    </span>
                  </th>
                  <td>{full.district ?? '–'}</td>
                  <td>{full.category ?? '–'}</td>
                  <td className={cx(level && `market-cell market-cell--${level}`)} data-testid="market-list-now">
                    {word ?? (now === null ? '–' : formatOccupancy(Math.round(now / 100) * 100))}
                  </td>
                  <td data-testid="market-list-price">
                    {price?.avgMinor ? formatMoney(price.avgMinor, currency) : '–'}
                  </td>
                  <td data-testid="market-list-change">{permilleText(price?.changePermille ?? null)}</td>
                  <td>
                    <Badge tone={status.tone === 'success' ? 'ok' : status.tone === 'warning' ? 'warn' : 'neutral'}>
                      {status.label}
                    </Badge>
                    {c.lastObservedOn && (
                      <span className="market-sub">
                        {t('загрузка от {date}', { date: displayDay(c.lastObservedOn) })}
                      </span>
                    )}
                  </td>
                  {editable && (
                    <td className="market-row-actions">
                      <OccupancyButton competitor={{ id: c.id, name: c.name }} cells={c.cells} />
                      {price && (
                        <RatesButton competitor={{ id: c.id, name: c.name }} cells={price.cells} currency={currency} />
                      )}
                      <CompetitorButton competitor={full} />
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </section>
  );
}
