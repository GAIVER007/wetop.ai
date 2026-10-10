import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import {
  can,
  demandLevel,
  formatOccupancy,
  formatPoints,
  type DemandLevel,
} from '@pms/domain';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { marketApi, type MarketInsight, type MarketView } from '../../lib/api';
import { hotelToday, validDate } from '../../lib/hotel-api';
import { displayDate, displayDay } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
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
  SectionTitle,
  Select,
  Stat,
  Table,
  cx,
} from '../../components/ui';
import { CompetitorButton, NightDrawer } from './drawers';
import { signalCells, signalNights } from './derive';
import { SignalCalendar } from './calendar';
import { OccupancyChart } from './chart';
import { CompetitorsTable } from './competitors-table';
import '../directory.css';
import './market.css';

const WINDOWS = [7, 14, 30] as const;
const COMPARES: Array<[number, string]> = [
  [1, 'со вчера'],
  [7, 'с неделей назад'],
  [0, 'без сравнения'],
];

/** Таблица и подсказки: целые проценты; плитки: до десятых. Хранится точнее (базисные пункты) */
const round = (bp: number, step: number) => Math.round(bp / step) * step;
const pct = (bp: number | null) => (bp === null ? '–' : formatOccupancy(round(bp, 100)));
const pctTile = (bp: number | null) => (bp === null ? '–' : formatOccupancy(round(bp, 10)));
const points = (bp: number) => formatPoints(round(bp, 100));
const weekday = new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', weekday: 'short' });
const dayHead = (d: string) => ({
  wd: weekday.format(new Date(`${d}T00:00:00Z`)),
  day: displayDate(d),
});
const range = (i: { from: string; to: string }) =>
  i.from === i.to ? displayDate(i.from) : `${displayDate(i.from)} → ${displayDate(i.to)}`;

/** Слова подсказки (ADR-142 п. 4): что видно на рынке и что с этим сделать; цены человек меняет сам */
function insightText(i: MarketInsight): { title: string; text: string; tone: 'warn' | 'ok' | 'info' } {
  const nights = pluralRu(i.nights, ['ночь', 'ночи', 'ночей']);
  const market = i.marketBp === null ? '' : `рынок ${pct(i.marketBp)}`;
  const own = i.ownBp === null ? '' : `, у вас ${pct(i.ownBp)}`;
  switch (i.kind) {
    case 'high-behind':
      return {
        title: `Рынок почти полон, у вас есть места: ${range(i)}`,
        text: `${market}${own} (${nights}). Соседи распроданы: цену на эти даты можно поднять.`,
        tone: 'warn',
      };
    case 'high':
      return {
        title: `Высокий спрос: ${range(i)}`,
        text: `${market}${own} (${nights}). Проверьте, что ваша цена не ниже рынка.`,
        tone: 'info',
      };
    case 'low-ahead':
      return {
        title: `Вы продаёте лучше рынка: ${range(i)}`,
        text: `${market}${own} (${nights}). Цену держите, скидка не нужна.`,
        tone: 'ok',
      };
    case 'low':
      return {
        title: `Спрос слабый: ${range(i)}`,
        text: `${market}${own} (${nights}). Подумайте об акции или промокоде на эти даты.`,
        tone: 'info',
      };
    case 'missing':
      return {
        title: `Нет данных: ${i.competitors?.join(', ')}`,
        text: 'Внесите их загрузку, и средняя по рынку станет точнее.',
        tone: 'info',
      };
  }
}

const LEVEL_WORD: Record<DemandLevel, string> = {
  high: 'высокий спрос',
  mid: 'средний спрос',
  low: 'слабый спрос',
};

/**
 * «Анализ конкурентов» (ADR-142; редизайн COMP3.2, план `plans/competitor-analysis-comp3-2026-10-09.md`):
 * пять показателей, календарь рыночных сигналов, график «вы и рынок», рекомендация по данным,
 * таблица конкурентов и детализация «По ночам». Данные вносит человек или ИИ-коллектор; цен
 * конкурентов пока нет (линия `competitor_rates`), показатели цен появятся после неё.
 */
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
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
  const [loaded, shell, nightLoaded] = await Promise.all([
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
  ]);
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'rates'));
  const subtitle = (
    <span data-testid="market-subtitle">
      Сравните свою загрузку с ближайшими объектами: где рынок полон, цену можно поднять; где
      пусто, пора акция.
    </span>
  );
  if (!loaded.ok)
    return (
      <Page width="wide" title="Анализ конкурентов" subtitle={subtitle}>
        <LoadError testId="market-error" {...loadErrorProps(loaded.e)} />
      </Page>
    );
  const view = loaded.r;
  const empty = view.competitors.length === 0;
  const cells = empty ? [] : signalCells(view.board);
  return (
    <Page
      width="wide"
      title="Анализ конкурентов"
      subtitle={subtitle}
      actions={editable ? <CompetitorButton primary={empty} /> : undefined}
    >
      <Toolbar from={from} days={days} asOf={asOf} compare={compare} today={today} />
      {empty ? (
        <EmptyState
          icon={<Icon name="analytics" />}
          title="Добавьте ближайших конкурентов"
          data-testid="market-empty"
          actions={editable ? <CompetitorButton primary /> : undefined}
        >
          Три-пять отелей рядом с вами, с которыми гость сравнивает вас при выборе. Вносите их
          загрузку на ближайшие ночи, и WETOP покажет, где рынок почти полон и цену можно поднять,
          а где спрос слабый и нужна акция.{' '}
          {!editable && 'Добавлять конкурентов могут владелец и управляющий.'}
        </EmptyState>
      ) : (
        <>
          <Summary view={view} signals={signalNights(cells)} />
          <div className="market-overview">
            <section className="market-block" aria-labelledby="market-calendar-title">
              <SectionTitle id="market-calendar-title">
                Календарь рыночных сигналов ({pluralRu(days, ['ночь', 'ночи', 'ночей'])})
              </SectionTitle>
              <SignalCalendar cells={cells} nightHref={nightHref} />
            </section>
            <section className="market-block" aria-labelledby="market-chart-title">
              <SectionTitle id="market-chart-title">Сравнение загрузки</SectionTitle>
              <OccupancyChart
                points={cells.map((c) => ({
                  date: c.date,
                  label: displayDate(c.date),
                  ownBp: c.ownBp,
                  marketBp: c.marketBp,
                  count: c.count,
                }))}
              />
            </section>
            <Recommendation view={view} asOf={asOf} />
          </div>
          <div
            className={cx(
              'market-main',
              view.board.insights.length <= 1 && 'market-main--single',
            )}
          >
            <section className="market-block" aria-labelledby="market-competitors-title">
              <SectionTitle id="market-competitors-title">Конкуренты</SectionTitle>
              <CompetitorsTable view={view} editable={editable} />
            </section>
            <Insights view={view} />
          </div>
          <Grid view={view} nightHref={nightHref} />
          {night && (
            <NightDrawer date={night} history={nightLoaded} closeHref={`/market?${base}`} />
          )}
        </>
      )}
      <p className="market-note" data-testid="market-source-note">
        Сейчас загрузку конкурентов вносите вы: процент занятых номеров на ночь, по тому, что видно
        на их странице бронирования. Автоматический сбор ИИ-агентом готовим. Ваша загрузка берётся
        из календаря: занятые места от всех, включая заблокированные. Цен конкурентов в разделе пока
        нет: без проверенного источника они не показываются.
      </p>
    </Page>
  );
}

function Toolbar({
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
  return (
    <section className="market-controls" aria-label="Период и сравнение">
      <form method="get" className="market-toolbar" data-testid="market-form">
        <Field inline label="С">
          <DateInput key={`from-${from}`} name="from" defaultValue={from} aria-label="Первая ночь" />
        </Field>
        <Field inline label="Ночей">
          <Select name="days" defaultValue={String(days)} data-testid="market-days">
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
        <Field inline label="Данные на">
          <DateInput key={`asof-${asOf}`} name="asOf" defaultValue={asOf} aria-label="Дата снимка" />
        </Field>
        <Field inline label="Изменение">
          <Select name="compare" defaultValue={String(compare)} data-testid="market-compare">
            {COMPARES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" tone="secondary" size="sm">
          Показать
        </Button>
        {(from !== today || asOf !== today) && (
          <Link href="/market" className="market-reset">
            С сегодня
          </Link>
        )}
      </form>
    </section>
  );
}

function Summary({ view, signals }: { view: MarketView; signals: number }) {
  const s = view.board.summary;
  return (
    <div className="market-tiles" data-testid="market-tiles">
      <Stat label="Ваша загрузка" value={pctTile(s.ownBp)} hint="по календарю" testId="market-tile-own" />
      <Stat
        label="Загрузка рынка"
        value={pctTile(s.marketBp)}
        hint={`по ${s.competitorsWithData} из ${pluralRu(s.competitors, ['конкурента', 'конкурентов', 'конкурентов'])}`}
        testId="market-tile-market"
      />
      <Stat
        label="Разница с рынком"
        value={s.gapBp === null ? '–' : formatPoints(round(s.gapBp, 10))}
        hint={s.gapBp === null ? 'нет данных' : s.gapBp < 0 ? 'вы ниже рынка' : s.gapBp > 0 ? 'вы выше рынка' : 'вровень'}
        tone={s.gapBp !== null && s.gapBp <= -1000 ? 'warning' : 'neutral'}
        testId="market-tile-gap"
      />
      <Stat
        label="Ночей высокого спроса"
        value={String(s.highDemandNights)}
        hint="рынок от 85 %"
        testId="market-tile-high"
      />
      <Stat
        label="Рыночные сигналы"
        value={String(signals)}
        hint="дат, стоящих внимания"
        testId="market-tile-signals"
      />
    </div>
  );
}

/**
 * Рекомендация (ТЗ §7): первая подсказка домена акцентной карточкой, с основанием и честной строкой
 * «по каким данным». Уровня уверенности нет: подсказки считаются правилами по снимкам, не моделью.
 */
function Recommendation({ view, asOf }: { view: MarketView; asOf: string }) {
  const first = view.board.insights[0];
  const s = view.board.summary;
  if (!first) return null;
  const t = insightText(first);
  return (
    <section
      className={cx('market-reco', `market-reco--${t.tone}`)}
      aria-labelledby="market-reco-title"
      data-testid="market-reco"
    >
      <Badge tone="info">Рекомендация по данным</Badge>
      <h2 id="market-reco-title">{t.title}</h2>
      <p>{t.text}</p>
      <p className="market-reco__basis">
        По данным {s.competitorsWithData} из{' '}
        {pluralRu(s.competitors, ['конкурента', 'конкурентов', 'конкурентов'])}, снимок на{' '}
        {displayDay(asOf)}. Цены меняете только вы: автоматических изменений нет.
      </p>
      {first.kind !== 'missing' && (
        <Link href="/rooms/categories" className="btn" data-testid="market-reco-rates">
          Открыть тарифы
        </Link>
      )}
    </section>
  );
}

function Insights({ view }: { view: MarketView }) {
  // первая подсказка показана карточкой рекомендации, здесь остальные
  const insights = view.board.insights.slice(1);
  if (!insights.length) return null;
  return (
    <section className="market-insights" aria-labelledby="market-insights-title" data-testid="market-insights">
      <SectionTitle id="market-insights-title">Что это значит</SectionTitle>
      <ul>
        {insights.map((i) => {
          const t = insightText(i);
          return (
            <li key={`${i.kind}-${i.from}`} className={cx('market-insight', `market-insight--${t.tone}`)} data-kind={i.kind}>
              <div>
                <strong>{t.title}</strong>
                <p>{t.text}</p>
              </div>
              {i.kind !== 'missing' && (
                <Link href="/rooms/categories" className="market-insight__link">
                  Открыть цены
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

function Cell({ bp, delta }: { bp: number | null; delta?: number | null | undefined }) {
  const level = demandLevel(bp);
  return (
    <td
      className={cx('market-cell', level && `market-cell--${level}`)}
      title={level ? LEVEL_WORD[level] : 'нет данных'}
    >
      <span className="market-cell__value">{pct(bp)}</span>
      {delta !== null && delta !== undefined && round(delta, 100) !== 0 && (
        <span className={cx('market-cell__delta', delta > 0 ? 'is-up' : 'is-down')}>
          {points(delta)}
        </span>
      )}
    </td>
  );
}

/** Детализация «По ночам»: тепловая таблица «вы и рынок»; действия строк переехали в «Конкуренты» */
function Grid({ view, nightHref }: { view: MarketView; nightHref: (date: string) => string }) {
  const { board } = view;
  return (
    <section className="market-grid" aria-labelledby="market-grid-title">
      <SectionTitle id="market-grid-title">По ночам</SectionTitle>
      <Table size="sm" density="normal" sticky="column" className="market-table" aria-label="Загрузка по ночам: вы и конкуренты" data-testid="market-table">
        <thead>
          <tr>
            <th scope="col" className="market-table__name">
              Отель
            </th>
            {board.dates.map((d) => {
              const h = dayHead(d);
              return (
                <th key={d} scope="col" className="market-table__day">
                  <Link
                    href={nightHref(d)}
                    scroll={false}
                    aria-label={`История ночи ${displayDate(d, 'numeric')}`}
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
              Вы
              <span className="market-sub">по календарю</span>
            </th>
            {board.own.map((o) => (
              <Cell key={o.date} bp={o.bp} />
            ))}
          </tr>
          {board.competitors.map((c) => (
            <tr key={c.id} data-testid={`market-row-${c.id}`}>
              <th scope="row" className="market-table__name">
                <span className="market-name">{c.name}</span>
                <span className="market-sub">
                  {[
                    c.distanceM !== null ? `${c.distanceM} м` : null,
                    c.lastObservedOn ? `данные от ${displayDay(c.lastObservedOn)}` : 'данных нет',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </th>
              {c.cells.map((cell) => (
                <Cell key={cell.date} bp={cell.bp} delta={cell.deltaBp} />
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="market-row--market" data-testid="market-row-market">
            <th scope="row" className="market-table__name">
              Средняя по рынку
            </th>
            {board.market.map((m) => (
              <Cell key={m.date} bp={m.bp} />
            ))}
          </tr>
          <tr className="market-row--gap" data-testid="market-row-gap">
            <th scope="row" className="market-table__name">
              Вы против рынка
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
      <ul className="market-legend" aria-label="Цвет клетки">
        <li>
          <span className="market-swatch market-cell--high" aria-hidden="true" />
          высокий спрос, от 85 %
        </li>
        <li>
          <span className="market-swatch market-cell--mid" aria-hidden="true" />
          средний
        </li>
        <li>
          <span className="market-swatch market-cell--low" aria-hidden="true" />
          слабый, до 50 %
        </li>
      </ul>
    </section>
  );
}
