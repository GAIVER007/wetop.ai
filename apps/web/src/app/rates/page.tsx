import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { ratesApi } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { Alert, Button, EmptyState, Field, Input, Select, Table, cx } from '../../components/ui';
import { BulkEditor } from './bulk-editor';
import { PriceCell } from './price-cell';
import './rates.css';

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
const nights = (n: number) => pluralRu(n, ['ночь', 'ночи', 'ночей']);
/** Родительный падеж после «до»: до 1 ночи, до 5 ночей, до 21 ночи */
const maxNights = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'ночи' : 'ночей'}`;

/** Ответ API как есть или причина отказа: экран остаётся, вместо данных — сбой со следующим шагом (D4) */
const settle = <T,>(p: Promise<T>) =>
  p.then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => ({ ok: false as const, e }),
  );

/**
 * Календарь цен и ограничений по категории × тарифу за месяц; массовое изменение справа.
 * Цена правится в ячейке (срез 7.2), ограничения — только массовым изменением (развилка 7.2-1).
 * D4 (план владельца 19.09): отказ справочников или календаря не уносит экран — заголовок, форма и
 * массовое изменение остаются, вместо таблицы сбой с «Повторить загрузку»; пустой справочник назван
 * пустым состоянием с причиной; месяц листается только кнопками-значками (дубли ссылок сняты).
 */
export default async function RatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = normalizeSearchParams(await searchParams);
  const month = q.month ?? new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7);
  const validMonth =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
    Number(month.slice(0, 4)) >= 1000 &&
    Number(month.slice(0, 4)) <= 9998;
  const monthLabel = validMonth
    ? monthTitle.format(new Date(`${month}-01T00:00:00Z`)).replace(' г.', '')
    : '';
  const loadedOptions = await settle(ratesApi.options());
  if (!loadedOptions.ok) {
    // Без справочника категорий и тарифов заполнять нечего: заголовок и месяц на месте, дальше — повтор
    return (
      <Page width="wide" title="Цены и ограничения" subtitle={monthLabel || undefined}>
        <LoadError testId="rates-error" {...loadErrorProps(loadedOptions.e)} />
      </Page>
    );
  }
  const options = loadedOptions.r;
  const category = q.category ?? options.categories[0]?.code ?? '';
  const ratePlan =
    q.ratePlan ?? options.ratePlans.find((p) => p.active)?.code ?? options.ratePlans[0]?.code ?? '';
  const noDirectory = !options.categories.length || !options.ratePlans.length;
  const error = !validMonth
    ? 'Выберите корректный месяц.'
    : !noDirectory &&
        (!options.categories.some((c) => c.code === category) ||
          !options.ratePlans.some((p) => p.code === ratePlan))
      ? 'Выберите существующую категорию и тариф.'
      : null;
  const { from, to } = validMonth ? monthRange(month) : { from: '', to: '' };
  const loadedCal =
    !error && !noDirectory && category && ratePlan
      ? await settle(ratesApi.calendar(category, ratePlan, from, to))
      : null;
  const cal = loadedCal?.ok ? loadedCal.r : null;
  const calError: unknown = loadedCal && !loadedCal.ok ? loadedCal.e : null;
  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const d = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
    return `/rates?category=${category}&ratePlan=${ratePlan}&month=${d}`;
  };
  const categoryName = options.categories.find((c) => c.code === category)?.name ?? category;
  const planName = options.ratePlans.find((p) => p.code === ratePlan)?.name ?? ratePlan;
  return (
    <Page
      width="wide"
      title="Цены и ограничения"
      subtitle={
        !error && !noDirectory && validMonth
          ? `${categoryName}, ${planName}, ${monthLabel}`
          : undefined
      }
    >
      {noDirectory ? (
        <EmptyState
          data-testid="rates-empty"
          title="Календарь цен пуст"
          actions={
            <Link href="/hotel-settings/penalties" className="btn btn--secondary">
              Открыть тарифы объекта
            </Link>
          }
        >
          {!options.categories.length
            ? 'Категорий ещё нет: состав и категории приходят из Exely при импорте фонда, цены задаются по категориям.'
            : 'Тарифов ещё нет: они приходят из Exely при импорте, а цена задаётся на категорию и тариф — без тарифа календарь заполнить нечем.'}
        </EmptyState>
      ) : (
        <>
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
              {calError !== null && (
                <LoadError testId="rates-error" {...loadErrorProps(calError)} />
              )}
              {cal && (
                <Table size="sm" nowrap className="rates-table" data-testid="rates-table">
                  <thead>
                    <tr>
                      {[
                        'Дата',
                        ...Array.from(
                          { length: cal.capacityAdults },
                          (_, i) => `Цена за ${pluralRu(i + 1, ['гостя', 'гостей', 'гостей'])}`,
                        ),
                        'Мин. ночей',
                        'Ограничения',
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cal.days.map((d) => {
                      const wd = new Date(`${d.date}T00:00:00Z`).getUTCDay();
                      const weekend = wd === 0 || wd === 6;
                      // Ограничения — одной колонкой словами: на обычный месяц их нет, и четыре
                      // колонки прочерков только прятали последнюю за прокруткой (21.09).
                      // «закрыто» — слово, которое ждёт запись сертификации Channex
                      const restrictions = [
                        d.stopSell ? 'закрыто (стоп-продажа)' : '',
                        d.closedToArrival ? 'закрыт заезд' : '',
                        d.closedToDeparture ? 'закрыт выезд' : '',
                        d.maxStay != null ? `до ${maxNights(d.maxStay)}` : '',
                      ].filter(Boolean);
                      return (
                        <tr
                          key={d.date}
                          data-testid={`rate-row-${d.date}`}
                          className={cx(
                            d.stopSell && 'is-stop',
                            !d.stopSell && weekend && 'is-weekend',
                          )}
                        >
                          <td className="nowrap">
                            <time dateTime={d.date}>{displayDate(d.date)}</time>{' '}
                            <span className="muted-2">{WD[wd]}</span>
                          </td>
                          {Array.from({ length: cal.capacityAdults }, (_, i) => {
                            return (
                              <td key={i} className="num" data-testid={`price-${d.date}-${i + 1}`}>
                                <span className="rates-cell-word">
                                  {pluralRu(i + 1, ['гость', 'гостя', 'гостей'])}
                                </span>
                                <PriceCell
                                  date={d.date}
                                  occupancy={i + 1}
                                  minor={d.prices[String(i + 1)] ?? null}
                                  currency={cal.currency}
                                  accommodationTypeCode={category}
                                  ratePlanCode={ratePlan}
                                />
                              </td>
                            );
                          })}
                          <td>
                            <span className="rates-cell-word">мин. </span>
                            {d.minStay != null ? nights(d.minStay) : '—'}
                          </td>
                          <td
                            className={cx(
                              'rates-restrictions',
                              !restrictions.length && 'rates-restrictions--none',
                            )}
                          >
                            {restrictions.length ? restrictions.join(', ') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
              {cal && !cal.days.length && (
                <EmptyState data-testid="rates-empty" title="В этом месяце нет ни одной ночи">
                  Календарь на {monthLabel} пуст: проверьте месяц или откройте соседний кнопками
                  рядом с полем.
                </EmptyState>
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
        </>
      )}
    </Page>
  );
}
