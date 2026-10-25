import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import {
  can,
  competitorPlatform,
  demandLevel,
  formatOccupancy,
  formatPoints,
  type DemandLevel,
} from '@pms/domain';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { marketApi, type MarketRates, type MarketView } from '../../lib/api';
import { hotelToday, validDate } from '../../lib/hotel-api';
import { requireFeature } from '../../lib/vertical-guard';
import { displayDate, displayDay } from '../../lib/display-date';
import { countLabel, intlLocale, msg, type DeskLocale, type Translate } from '../../i18n';
import { dateFormat } from '../../i18n/dates';
import { currentLocale, serverT } from '../../i18n/server';
import { deskShell } from '../../lib/desk-shell';
import { loadErrorProps } from '../../lib/load-error';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { DateInput } from '../../components/date-field';
import { Icon } from '../../components/icon';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Grid as AutoGrid,
  SectionTitle,
  Select,
  Stat,
  Table,
  cx,
} from '../../components/ui';
import { CompetitorButton, NightDrawer } from './drawers';
import { MarketCharts } from './market-charts';
import { CompetitorsTable } from './competitors-table';
import { signalCells, signalNights } from './derive';
import { SignalCalendar } from './calendar';
import { OccupancyChart } from './chart';
import { insightText } from './insight-text';
import '../directory.css';
import './market.css';

const WINDOWS = [7, 14, 30] as const;
const COMPARES: Array<[number, string]> = [
  [1, msg('со вчера')],
  [7, msg('с неделей назад')],
  [0, msg('без сравнения')],
];

/** Таблица и подсказки: целые проценты; плитки: до десятых. Хранится точнее (базисные пункты) */
const round = (bp: number, step: number) => Math.round(bp / step) * step;
const pct = (bp: number | null) => (bp === null ? '–' : formatOccupancy(round(bp, 100)));
const pctTile = (bp: number | null) => (bp === null ? '–' : formatOccupancy(round(bp, 10)));
const points = (bp: number) => formatPoints(round(bp, 100));
const dayHead = (d: string, locale: DeskLocale) => ({
  wd: dateFormat(intlLocale(locale), { timeZone: 'UTC', weekday: 'short' }).format(new Date(`${d}T00:00:00Z`)),
  day: displayDate(d, 'short', intlLocale(locale)),
});

/** Уровень наличия без точного процента (сборщик видит «мест нет» или «осталось 2»): словом, тон как у спроса */
const AVAILABILITY: Record<'SOLD_OUT' | 'FEW_LEFT' | 'AVAILABLE', { word: string; tone: DemandLevel }> = {
  SOLD_OUT: { word: msg('Нет мест'), tone: 'high' },
  FEW_LEFT: { word: msg('Мало мест'), tone: 'mid' },
  AVAILABLE: { word: msg('Есть места'), tone: 'low' },
};

const LEVEL_WORD: Record<DemandLevel, string> = {
  high: msg('высокий спрос'),
  mid: msg('средний спрос'),
  low: msg('слабый спрос'),
};

/**
 * «Анализ конкурентов» (ADR-142; редизайн COMP3.2, план `plans/competitor-analysis-comp3-2026-10-09.md`):
 * пять показателей, календарь рыночных сигналов, график «вы и рынок», рекомендация по данным,
 * таблица конкурентов и детализация «По ночам». Данные вносит человек или ИИ-коллектор; цены соседей (SALES2.3, `competitor_rates`)
 * идут вторым необязательным запросом: таблица конкурентов и графики цен.
 */
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // мониторинг конкурентов считает загрузку гостиниц: салону и ресторану его нет, они уходят на свой «Сегодня»
  await requireFeature('/market');
  const t = await serverT();
  const locale = await currentLocale();
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const from = sp.from && validDate(sp.from) ? sp.from : today;
  const days = WINDOWS.includes(Number(sp.days) as 7) ? Number(sp.days) : 14;
  const asOf = sp.asOf && validDate(sp.asOf) && sp.asOf <= today ? sp.asOf : today;
  const compare = sp.compare && ['0', '1', '7'].includes(sp.compare) ? Number(sp.compare) : 1;
  // «История ночи» (M1.2): панель по адресу `?night=`, свой запрос только когда она открыта
  const night = sp.night && validDate(sp.night) ? sp.night : null;
  const base = new URLSearchParams({ from, days: String(days), asOf, compare: String(compare) });
  const nightHref = (d: string) => `/market?${base}&night=${d}`;
  const district = sp.district ?? '';
  const category = sp.category ?? '';
  const [loaded, shell, nightLoaded, rates] = await Promise.all([
    marketApi.occupancy({ from, days, asOf, compare }).then(
      (r) => ({ ok: true as const, r }),
      (e: unknown) => {
        unstable_rethrow(e);
        return { ok: false as const, e };
      },
    ),
    deskShell(),
    night
      ? marketApi.night(night).then(
          (r) => r,
          (e: unknown) => {
            unstable_rethrow(e);
            return null;
          },
        )
      : null,
    // цены вторым, необязательным запросом: сбой не роняет страницу загрузки, график и столбцы цен просто не рисуются
    marketApi.rates({ from, days, asOf, compare }).then(
      (r): MarketRates | null => r,
      (e: unknown) => {
        unstable_rethrow(e);
        return null;
      },
    ),
  ]);
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'rates'));
  const subtitle = (
    <span data-testid="market-subtitle">
      {t('Сравните свою загрузку с ближайшими объектами: где рынок полон, цену можно поднять; где пусто, пора акция.')}
    </span>
  );
  if (!loaded.ok)
    return (
      <Page width="wide" title={t('Анализ конкурентов')} subtitle={subtitle}>
        <LoadError testId="market-error" {...loadErrorProps(loaded.e)} />
      </Page>
    );
  const view = loaded.r;
  const empty = view.competitors.length === 0;
  const cells = empty ? [] : signalCells(view.board);
  return (
    <Page
      width="wide"
      title={t('Анализ конкурентов')}
      subtitle={subtitle}
      // одна кнопка «Добавить» на экране: пусто, она в пустом состоянии; есть конкуренты, в шапке
      actions={editable && !empty ? <CompetitorButton defaultOpen={sp.add === '1'} /> : undefined}
    >
      {!empty && <Toolbar from={from} days={days} asOf={asOf} compare={compare} today={today} />}
      {empty ? (
        <EmptyState
          icon={<Icon name="analytics" />}
          title={t('Добавьте ближайших конкурентов')}
          data-testid="market-empty"
          details={<HowItWorks />}
          actions={editable ? <CompetitorButton primary defaultOpen={sp.add === '1'} /> : undefined}
        >
          {t('Три-пять отелей рядом с вами, с которыми гость сравнивает вас при выборе.')}{' '}
          {!editable && t('Добавлять конкурентов могут владелец и управляющий.')}
        </EmptyState>
      ) : (
        <>
          <Summary view={view} signals={signalNights(cells)} />
          <div className="market-overview">
            <section className="market-block" aria-labelledby="market-calendar-title">
              <SectionTitle id="market-calendar-title">
                {t('Календарь рыночных сигналов ({nights})', {
                  nights: countLabel(locale, t, days, [msg('ночь'), msg('ночи'), msg('ночей')]),
                })}
              </SectionTitle>
              <SignalCalendar cells={cells} nightHref={nightHref} />
            </section>
            <section className="market-block" aria-labelledby="market-chart-title">
              <SectionTitle id="market-chart-title">{t('Сравнение загрузки')}</SectionTitle>
              <OccupancyChart
                points={cells.map((c) => ({
                  date: c.date,
                  label: displayDate(c.date, 'short', intlLocale(locale)),
                  ownBp: c.ownBp,
                  marketBp: c.marketBp,
                  count: c.count,
                }))}
              />
            </section>
            <Recommendation view={view} asOf={asOf} />
          </div>
          <div className={cx('market-main', view.board.insights.length <= 1 && 'market-main--single')}>
            <CompetitorsTable
              view={view}
              rates={rates}
              today={today}
              editable={editable}
              district={district}
              category={category}
              keep={[...base.entries()]}
            />
            <Insights view={view} />
          </div>
          <MarketCharts board={view.board} rates={rates && rates.board.summary.competitorsWithData > 0 ? rates : null} />
          <Grid view={view} nightHref={nightHref} />
          {night && (
            <NightDrawer date={night} history={nightLoaded} closeHref={`/market?${base}`} />
          )}
        </>
      )}
      {!empty && (
        <p className="market-note" data-testid="market-source-note">
          {t('Ваша загрузка берётся из календаря: занятые места от всех, включая заблокированные. Загрузку и цены соседей вносите вы или загружаете из файла; снимки сборщика подписаны «ИИ». Сайты бронирования мы автоматически не читаем, их условия это запрещают; автоматический сбор из разрешённого источника пока не подключён.')}
        </p>
      )}
    </Page>
  );
}

/**
 * Как работает раздел: три шага. Источник загрузки не обещаем: сбор с площадок не решён (Q-257 открыт, ADR-142
 * запрещает автоматически читать площадки), поэтому шаг 2 говорит «вручную или сборщиком».
 */
async function HowItWorks() {
  const t = await serverT();
  return (
    <AutoGrid min={180} role="list" className="market-steps" data-testid="market-steps">
      <div role="listitem">
        <strong>{t('Добавьте соседа')}</strong>
        {t('название, расстояние и число номеров')}
      </div>
      <div role="listitem">
        <strong>{t('Загрузка соседей обновляется')}</strong>
        {t('вручную или сборщиком: процент занятых номеров на каждую ближайшую ночь')}
      </div>
      <div role="listitem">
        <strong>{t('WETOP подсказывает цену')}</strong>
        {t('где рынок почти полон, цену можно поднять; где пусто, пора акция')}
      </div>
    </AutoGrid>
  );
}

/**
 * Кто даёт данные по соседу: «ИИ», только если в окне есть снимки сборщика (`AI_AGENT`). Ссылка на площадку есть, а
 * сборщика нет: «Сбор не подключён» (не обещаем сбор до решения Q-257). Ссылки нет: «вручную».
 */
function tracking(c: { url: string | null; sources: string[] }): {
  word: string;
  tone: 'info' | 'neutral';
} {
  if (c.sources.includes('AI_AGENT')) return { word: msg('ИИ'), tone: 'info' };
  return competitorPlatform(c.url)
    ? { word: msg('Сбор не подключён'), tone: 'neutral' }
    : { word: msg('вручную'), tone: 'neutral' };
}

async function Toolbar({
  from,
  days,
  asOf,
  compare,
  today,
}: {
  from: string;
  days: number;
  asOf: string;
  compare: number;
  today: string;
}) {
  const t = await serverT();
  return (
    <section className="market-controls" aria-label={t('Период и сравнение')}>
      <form method="get" className="market-toolbar" data-testid="market-form">
        <Field inline label={t('С')}>
          <DateInput key={`from-${from}`} name="from" defaultValue={from} aria-label={t('Первая ночь')} />
        </Field>
        <Field inline label={t('Ночей')}>
          <Select name="days" defaultValue={String(days)} data-testid="market-days">
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
        <Field inline label={t('Данные на')}>
          <DateInput key={`asof-${asOf}`} name="asOf" defaultValue={asOf} aria-label={t('Дата снимка')} />
        </Field>
        <Field inline label={t('Изменение@@сравнение')}>
          <Select name="compare" defaultValue={String(compare)} data-testid="market-compare">
            {COMPARES.map(([v, label]) => (
              <option key={v} value={v}>
                {t(label)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" tone="secondary">
          {t('Показать')}
        </Button>
        {(from !== today || asOf !== today) && (
          <Link href="/market" className="market-reset">
            {t('С сегодня')}
          </Link>
        )}
      </form>
    </section>
  );
}

async function Summary({ view, signals }: { view: MarketView; signals: number }) {
  const t = await serverT();
  const locale = await currentLocale();
  const s = view.board.summary;
  return (
    <div className="market-tiles" data-testid="market-tiles">
      <Stat
        label={t('Ваша загрузка')}
        value={pctTile(s.ownBp)}
        hint={t('по календарю')}
        testId="market-tile-own"
      />
      <Stat
        label={t('Загрузка рынка')}
        value={pctTile(s.marketBp)}
        hint={t('по {n} из {total}', {
          n: s.competitorsWithData,
          total: countLabel(locale, t, s.competitors, [msg('конкурента'), msg('конкурентов'), msg('конкурентов')]),
        })}
        testId="market-tile-market"
      />
      <Stat
        label={t('Разница с рынком')}
        value={s.gapBp === null ? '–' : formatPoints(round(s.gapBp, 10))}
        hint={
          s.gapBp === null
            ? t('нет данных')
            : s.gapBp < 0
              ? t('вы ниже рынка')
              : s.gapBp > 0
                ? t('вы выше рынка')
                : t('вровень')
        }
        tone={s.gapBp !== null && s.gapBp <= -1000 ? 'warning' : 'neutral'}
        testId="market-tile-gap"
      />
      <Stat
        label={t('Ночей высокого спроса')}
        value={String(s.highDemandNights)}
        hint={t('рынок от 85 %')}
        testId="market-tile-high"
      />
      <Stat
        label={t('Рыночные сигналы')}
        value={String(signals)}
        hint={t('дат, стоящих внимания')}
        testId="market-tile-signals"
      />
    </div>
  );
}

/**
 * Рекомендация (ТЗ §7): первая подсказка домена акцентной карточкой, с основанием и честной строкой
 * «по каким данным». Уровня уверенности нет: подсказки считаются правилами по снимкам, не моделью.
 */
async function Recommendation({ view, asOf }: { view: MarketView; asOf: string }) {
  const t = await serverT();
  const locale = await currentLocale();
  const first = view.board.insights[0];
  const s = view.board.summary;
  if (!first) return null;
  const it = insightText(first, t, locale);
  return (
    <section
      className={cx('market-reco', `market-reco--${it.tone}`)}
      aria-labelledby="market-reco-title"
      data-testid="market-reco"
    >
      <Badge tone="info">{t('Рекомендация по данным')}</Badge>
      <h2 id="market-reco-title">{it.title}</h2>
      <p>{it.text}</p>
      <p className="market-reco__basis">
        {t('По данным {n} из {total}, снимок на {date}. Цены меняете только вы: автоматических изменений нет.', {
          n: s.competitorsWithData,
          total: countLabel(locale, t, s.competitors, [msg('конкурента'), msg('конкурентов'), msg('конкурентов')]),
          date: displayDay(asOf),
        })}
      </p>
      {first.kind !== 'missing' && (
        <Link href="/rooms/categories" className="btn" data-testid="market-reco-rates">
          {t('Открыть тарифы')}
        </Link>
      )}
    </section>
  );
}

async function Insights({ view }: { view: MarketView }) {
  const t = await serverT();
  const locale = await currentLocale();
  // первая подсказка показана карточкой рекомендации, здесь остальные
  const insights = view.board.insights.slice(1);
  if (!insights.length) return null;
  return (
    <section className="market-insights" aria-labelledby="market-insights-title" data-testid="market-insights">
      <SectionTitle id="market-insights-title">{t('Что это значит')}</SectionTitle>
      <ul>
        {insights.map((i) => {
          const it = insightText(i, t, locale);
          return (
            <li key={`${i.kind}-${i.from}`} className={cx('market-insight', `market-insight--${it.tone}`)} data-kind={i.kind}>
              <div>
                <strong>{it.title}</strong>
                <p>{it.text}</p>
              </div>
              {i.kind !== 'missing' && (
                <Link href="/rooms/categories" className="market-insight__link">
                  {t('Открыть цены')}
                  <Icon name="chevron" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Cell({
  bp,
  delta,
  availability,
  hint,
  t,
}: {
  t: Translate;
  bp: number | null;
  delta?: number | null | undefined;
  availability?: 'SOLD_OUT' | 'FEW_LEFT' | 'AVAILABLE' | null | undefined;
  hint?: string | undefined;
}) {
  // снимок сборщика бывает только уровнем: показываем его словом, а не прочерком «нет данных»
  const byLevel = bp === null && availability ? AVAILABILITY[availability] : null;
  const level = byLevel ? byLevel.tone : demandLevel(bp);
  return (
    <td
      className={cx('market-cell', level && `market-cell--${level}`)}
      title={byLevel ? t(byLevel.word) : level ? t(LEVEL_WORD[level]) : t('нет данных')}
    >
      <span className="market-cell__value">{byLevel ? t(byLevel.word) : pct(bp)}</span>
      {hint && <span className="market-cell__delta">{hint}</span>}
      {delta !== null && delta !== undefined && round(delta, 100) !== 0 && (
        <span className={cx('market-cell__delta', delta > 0 ? 'is-up' : 'is-down')}>
          {points(delta)}
        </span>
      )}
    </td>
  );
}

async function Grid({
  view,
  nightHref,
}: {
  view: MarketView;
  nightHref: (date: string) => string;
}) {
  const t = await serverT();
  const locale = await currentLocale();
  const { board } = view;
  return (
    <section className="market-grid" aria-labelledby="market-grid-title">
      <SectionTitle id="market-grid-title">{t('По ночам')}</SectionTitle>
      <Table size="sm" density="normal" sticky="column" className="market-table" aria-label={t('Загрузка по ночам: вы и конкуренты')} data-testid="market-table">
        <thead>
          <tr>
            <th scope="col" className="market-table__name">
              {t('Отель')}
            </th>
            {board.dates.map((d) => {
              const h = dayHead(d, locale);
              return (
                <th key={d} scope="col" className="market-table__day">
                  <Link
                    href={nightHref(d)}
                    scroll={false}
                    aria-label={t('История ночи {date}', { date: displayDate(d, 'numeric') })}
                    data-testid={`market-night-${d}`}
                  >
                    <span>{h.wd}</span>
                    {h.day}
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr className="market-row--own" data-testid="market-row-own">
            <th scope="row" className="market-table__name">
              {t('Вы')}
              <span className="market-sub">{t('по календарю')}</span>
            </th>
            {board.own.map((o) => (
              <Cell key={o.date} bp={o.bp} t={t} />
            ))}
          </tr>
          {board.competitors.map((c) => {
            return (
              <tr key={c.id} data-testid={`market-row-${c.id}`}>
                <th scope="row" className="market-table__name">
                  <span className="market-name">
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noreferrer noopener">
                        {c.name}
                      </a>
                    ) : (
                      c.name
                    )}
                    <Badge tone={tracking(c).tone} data-testid={`market-tracking-${c.id}`}>
                      {t(tracking(c).word)}
                    </Badge>
                  </span>
                  <span className="market-sub">
                    {[
                      c.distanceM !== null ? t('{n} м', { n: c.distanceM }) : null,
                      c.lastObservedOn
                        ? t('данные от {date}', { date: displayDay(c.lastObservedOn) })
                        : t('данных нет'),
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </th>
                {c.cells.map((cell) => (
                  <Cell key={cell.date} bp={cell.bp} delta={cell.deltaBp} availability={cell.level} t={t} />
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="market-row--market" data-testid="market-row-market">
            <th scope="row" className="market-table__name">
              {t('Средняя по рынку')}
            </th>
            {board.market.map((m) => (
              <Cell
                key={m.date}
                bp={m.bp}
                hint={m.withLevel ? t('почти полны {tight} из {total}', { tight: m.tight ?? 0, total: m.withLevel }) : undefined}
                t={t}
              />
            ))}
          </tr>
          <tr className="market-row--gap" data-testid="market-row-gap">
            <th scope="row" className="market-table__name">
              {t('Вы против рынка')}
            </th>
            {board.gap.map((g) => (
              <td
                key={g.date}
                className={cx(
                  'market-gap',
                  g.bp !== null && g.bp <= -1000 && 'is-behind',
                  g.bp !== null && g.bp >= 1000 && 'is-ahead',
                )}
              >
                {g.bp === null ? '–' : points(g.bp)}
              </td>
            ))}
          </tr>
        </tfoot>
      </Table>
      <ul className="market-legend" aria-label={t('Цвет клетки')}>
        <li>
          <span className="market-swatch market-cell--high" aria-hidden="true" />
          {t('высокий спрос, от 85 %')}
        </li>
        <li>
          <span className="market-swatch market-cell--mid" aria-hidden="true" />
          {t('средний')}
        </li>
        <li>
          <span className="market-swatch market-cell--low" aria-hidden="true" />
          {t('слабый, до 50 %')}
        </li>
      </ul>
    </section>
  );
}
