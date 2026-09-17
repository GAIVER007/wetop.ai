import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { formatMinor, ratesApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Alert, Button, Field, Input, Select, Table, cx } from '../../components/ui';
import { BulkEditor } from './bulk-editor';
import { PriceCell } from './price-cell';
import './rates.css';

const monthRange = (ym: string) => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
};
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** Календарь цен и ограничений по категории × тарифу за месяц; массовое изменение справа. */
export default async function RatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = normalizeSearchParams(await searchParams);
  const options = await ratesApi.options();
  const category = q.category ?? options.categories[0]?.code ?? '';
  const ratePlan =
    q.ratePlan ?? options.ratePlans.find((p) => p.active)?.code ?? options.ratePlans[0]?.code ?? '';
  const month = q.month ?? new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7);
  const validMonth =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
    Number(month.slice(0, 4)) >= 1000 &&
    Number(month.slice(0, 4)) <= 9998;
  const error = !validMonth
    ? 'Выберите корректный месяц.'
    : !options.categories.some((c) => c.code === category) ||
        !options.ratePlans.some((p) => p.code === ratePlan)
      ? 'Выберите существующую категорию и тариф.'
      : null;
  const { from, to } = validMonth ? monthRange(month) : { from: '', to: '' };
  const cal =
    !error && category && ratePlan ? await ratesApi.calendar(category, ratePlan, from, to) : null;
  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const d = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
    return `/rates?category=${category}&ratePlan=${ratePlan}&month=${d}`;
  };
  return (
    <Page width="wide" title="Цены и ограничения">
      <form method="get" className="row row--end row--lg toolbar">
        <Field label="Категория">
          <Select name="category" defaultValue={category}>
            {options.categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Тариф">
          <Select name="ratePlan" defaultValue={ratePlan}>
            {options.ratePlans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.currency}){p.active ? '' : ' — неактивен'}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Месяц">
          <Input type="month" name="month" defaultValue={month} />
        </Field>
        <Button type="submit" tone="secondary">
          Показать
        </Button>
        {validMonth && (
          <span style={{ marginLeft: 8 }}>
            <Link href={shift(-1)}>← месяц</Link> · <Link href={shift(1)}>месяц →</Link>
          </span>
        )}
      </form>
      {error && (
        <Alert boxed>
          {error} <Link href="/rates">Сбросить фильтры</Link>
        </Alert>
      )}
      <div className="split">
        <div className="tbl-wrap">
          {cal ? (
            <Table size="sm" dense nowrap data-testid="rates-table">
              <thead>
                <tr>
                  {[
                    'Дата',
                    ...Array.from({ length: cal.capacityAdults }, (_, i) => `Цена, ${i + 1} гост.`),
                    'Min stay',
                    'Max stay',
                    'Stop sell',
                    'CTA',
                    'CTD',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cal.days.map((d) => {
                  const wd = new Date(`${d.date}T00:00:00Z`).getUTCDay();
                  const weekend = wd === 0 || wd === 6;
                  return (
                    <tr
                      key={d.date}
                      data-testid={`rate-row-${d.date}`}
                      className={cx(
                        d.stopSell && 'is-stop',
                        !d.stopSell && weekend && 'is-weekend',
                      )}
                    >
                      <td>
                        {d.date} <span className="muted-2">{WD[wd]}</span>
                      </td>
                      {Array.from({ length: cal.capacityAdults }, (_, i) => {
                        const minor = d.prices[String(i + 1)];
                        return (
                          <td key={i} className="num" data-testid={`price-${d.date}-${i + 1}`}>
                            <PriceCell
                              date={d.date}
                              occupancy={i + 1}
                              text={minor ? formatMinor(minor, cal.currency) : 'нет'}
                              major={minor ? (BigInt(minor) / 100n).toString() : ''}
                              accommodationTypeCode={category}
                              ratePlanCode={ratePlan}
                            />
                          </td>
                        );
                      })}
                      <td>{d.minStay ?? '—'}</td>
                      <td>{d.maxStay ?? '—'}</td>
                      <td>{d.stopSell ? 'да' : '—'}</td>
                      <td>{d.closedToArrival ? 'да' : '—'}</td>
                      <td>{d.closedToDeparture ? 'да' : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <p className="empty">Нет категорий или тарифов.</p>
          )}
        </div>
        {!error && (
          <BulkEditor
            categories={options.categories}
            ratePlans={options.ratePlans}
            defaults={{
              accommodationTypeCode: category,
              ratePlanCode: ratePlan,
              dateFrom: from,
              dateTo: to,
            }}
          />
        )}
      </div>
    </Page>
  );
}
