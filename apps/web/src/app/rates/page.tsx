import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { ratesApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Alert, Button, Field, Input, Select, Table, cx } from '../../components/ui';
import { BulkEditor } from './bulk-editor';
import { PriceCell, RatesToastScope } from './price-cell';

const monthRange = (ym: string) => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
};
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const monthTitle = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});
const guestsHeader = (n: number) => `Цена, ${n} ${n === 1 ? 'гость' : n < 5 ? 'гостя' : 'гостей'}`;

/**
 * Календарь цен и ограничений по категории × тарифу за месяц; массовое изменение справа.
 * Цена правится в ячейке (срез 7.2), ограничения — только массовым изменением (развилка 7.2-1).
 */
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
  const categoryName = options.categories.find((c) => c.code === category)?.name ?? category;
  const planName = options.ratePlans.find((p) => p.code === ratePlan)?.name ?? ratePlan;
  const monthLabel = validMonth
    ? monthTitle.format(new Date(`${month}-01T00:00:00Z`)).replace(' г.', '')
    : '';
  return (
    <Page
      width="wide"
      title="Цены и ограничения"
      subtitle={!error && cal ? `${categoryName}, ${planName}, ${monthLabel}` : undefined}
    >
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
        {validMonth && (
          <Link href={shift(-1)} className="icon-button" aria-label="Предыдущий месяц">
            <Icon name="chevron" className="rotate-left" />
          </Link>
        )}
        <Field label="Месяц">
          <Input type="month" name="month" defaultValue={month} />
        </Field>
        {validMonth && (
          <Link href={shift(1)} className="icon-button" aria-label="Следующий месяц">
            <Icon name="chevron" />
          </Link>
        )}
        <Button type="submit" tone="secondary">
          Показать
        </Button>
      </form>
      {error && (
        <Alert boxed>
          {error} <Link href="/rates">Сбросить фильтры</Link>
        </Alert>
      )}
      <div className="split">
        <div className="tbl-wrap stack stack--sm">
          {cal ? (
            <RatesToastScope>
              <Table size="sm" dense nowrap data-testid="rates-table">
                <thead>
                  <tr>
                    {[
                      'Дата',
                      ...Array.from({ length: cal.capacityAdults }, (_, i) => guestsHeader(i + 1)),
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
                    return (
                      <tr
                        key={d.date}
                        data-testid={`rate-row-${d.date}`}
                        className={cx(d.stopSell && 'is-stop')}
                      >
                        <td>
                          {d.date.slice(8, 10)}.{d.date.slice(5, 7)}{' '}
                          <span className="muted-2">{WD[wd]}</span>
                        </td>
                        {Array.from({ length: cal.capacityAdults }, (_, i) => (
                          <td key={i} className="num" data-testid={`price-${d.date}-${i + 1}`}>
                            <PriceCell
                              date={d.date}
                              occupancy={i + 1}
                              minor={d.prices[String(i + 1)] ?? null}
                              currency={cal.currency}
                              accommodationTypeCode={cal.accommodationTypeCode}
                              ratePlanCode={cal.ratePlanCode}
                            />
                          </td>
                        ))}
                        <td className="num">{d.minStay ?? '—'}</td>
                        <td className="num">{d.maxStay ?? '—'}</td>
                        <td>{d.stopSell ? <b className="warn-text">закрыто</b> : '—'}</td>
                        <td>{d.closedToArrival ? 'закрыт' : '—'}</td>
                        <td>{d.closedToDeparture ? 'закрыт' : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <p className="hint row row--inline">
                <Icon name="incidents" width={16} height={16} className="warn-text" />
                Стоп-продажа — словом в колонке, строка подсвечена. Цена правится в ячейке: клик,
                Enter — сохранить, Esc — отмена.
              </p>
            </RatesToastScope>
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
