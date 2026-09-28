import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { ratesApi, channelsApi } from '../../lib/api';
import { hotelClock } from '../../lib/hotel-api';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { Alert, EmptyState } from '../../components/ui';
import { RatesFilters } from './filters';
import { RatesEditDrawer } from './edit-drawer';
import { MonthGrid } from './month-grid';
import './rates.css';

const monthRange = (ym: string) => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
};
const monthTitle = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});

/** Ответ API как есть или причина отказа: экран остаётся, вместо данных — сбой со следующим шагом (D4) */
const settle = <T,>(p: Promise<T>) =>
  p.then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => ({ ok: false as const, e }),
  );

/**
 * «Тарифы и цены» (ТЗ v2 27.09.2026, ADR-111, RT1): сетка месяца по категории × тарифу, правка —
 * прежними путями (цена в ячейке — срез 7.2; массовое изменение — та же форма в выдвижной панели за
 * кнопкой «Изменить цены»). Фильтры перезагружают данные сами, кнопки «Показать» нет.
 * D4 (план владельца 19.09): отказ справочников или календаря не уносит экран — заголовок, фильтры и
 * правка остаются, вместо сетки сбой с «Повторить загрузку»; пустой справочник назван пустым
 * состоянием с причиной; месяц листается кнопками-значками.
 */
export default async function RatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = normalizeSearchParams(await searchParams);
  const clock = await hotelClock();
  const month = q.month ?? clock.month();
  const today = clock.today();
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
      <Page width="wide" title="Тарифы и цены" subtitle="Управление ценами и ограничениями продаж">
        <LoadError testId="rates-error" {...loadErrorProps(loadedOptions.e)} />
      </Page>
    );
  }
  const options = loadedOptions.r;
  // Подпись каналов на форме (чтобы не путать номера/тарифы при сертификации): маппинг из БД + имена из
  // Channex. Оба через settle — Channex недоступен, экран остаётся, подпись просто не покажется (D4).
  const [mappingRes, namesRes] = await Promise.all([
    settle(channelsApi.mapping()),
    settle(channelsApi.channexNames()),
  ]);
  const channexNames = namesRes.ok ? namesRes.r : { roomTypes: {}, ratePlans: {} };
  const channelHints: {
    byRoom: Record<string, { name: string | null; mapped: boolean }>;
    byPlan: Record<string, { name: string | null; mapped: boolean }>;
  } = { byRoom: {}, byPlan: {} };
  if (mappingRes.ok) {
    for (const m of mappingRes.r) {
      if (!m.localAccommodationTypeCode) continue;
      channelHints.byRoom[m.localAccommodationTypeCode] = {
        name: m.providerRoomTypeId
          ? (channexNames.roomTypes[m.providerRoomTypeId] ?? m.providerRoomTypeId)
          : null,
        mapped: !!m.providerRoomTypeId,
      };
      if (m.localRatePlanCode)
        channelHints.byPlan[`${m.localAccommodationTypeCode}|${m.localRatePlanCode}`] = {
          name: m.providerRatePlanId
            ? (channexNames.ratePlans[m.providerRatePlanId] ?? m.providerRatePlanId)
            : null,
          mapped: !!m.providerRatePlanId,
        };
    }
  }
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
  return (
    <Page
      width="wide"
      title="Тарифы и цены"
      subtitle="Управление ценами и ограничениями продаж"
      actions={
        !noDirectory && !error ? (
          <RatesEditDrawer
            channels={channelHints}
            categories={options.categories}
            ratePlans={options.ratePlans}
            defaults={{
              accommodationTypeCode: category,
              ratePlanCode: ratePlan,
              dateFrom: from,
              dateTo: to,
            }}
          />
        ) : undefined
      }
    >
      {noDirectory ? (
        <EmptyState
          data-testid="rates-empty"
          title="Календарь цен пуст"
          actions={
            <Link href="/rooms/categories" className="btn btn--secondary">
              Создать категорию
            </Link>
          }
        >
          {!options.categories.length
            ? 'Категорий ещё нет. Цена задаётся на категорию номеров: создайте категорию в номерном фонде — и календарь заполнится.'
            : 'Тарифов ещё нет. Тариф создаётся вместе с категорией в номерном фонде, цена задаётся на категорию и тариф.'}
        </EmptyState>
      ) : (
        <>
          <RatesFilters
            key={`${category}|${ratePlan}|${month}`}
            categories={options.categories}
            ratePlans={options.ratePlans}
            category={category}
            ratePlan={ratePlan}
            month={month}
            currentMonth={clock.month()}
            validMonth={validMonth}
          />
          {error && (
            <Alert boxed>
              {error} <Link href="/rates">Сбросить фильтры</Link>
            </Alert>
          )}
          {calError !== null && <LoadError testId="rates-error" {...loadErrorProps(calError)} />}
          {cal && cal.days.length > 0 && (
            <MonthGrid
              days={cal.days}
              currency={cal.currency}
              capacityAdults={cal.capacityAdults}
              category={category}
              ratePlan={ratePlan}
              today={today}
            />
          )}
          {cal && !cal.days.length && (
            <EmptyState data-testid="rates-empty" title="В этом месяце нет ни одной ночи">
              Календарь на {monthLabel} пуст: проверьте месяц или откройте соседний кнопками рядом с
              полем.
            </EmptyState>
          )}
        </>
      )}
    </Page>
  );
}
