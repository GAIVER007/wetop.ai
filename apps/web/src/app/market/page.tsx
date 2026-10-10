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
import { insightText } from './insight-text';
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

const LEVEL_WORD: Record<DemandLevel, string> = {
  high: 'высокий спрос',
  mid: 'средний спрос',
  low: 'слабый спрос',
};

/**
 * «Загрузка конкурентов» (ADR-142, план `plans/market-competitor-occupancy-2026-10-03.md`): ваша загрузка по календарю
 * рядом с загрузкой ближайших отелей на каждую ночь, средняя по рынку, разница и подсказки к цене. Данные вносит
 * человек; сбор ИИ-агентом, следующий срез (Q-257).
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
      Сравните свою загрузку с ближайшими отелями на каждую ночь: где рынок полон, цену можно
      поднять; где пусто, пора акция.
    </span>
  );
  if (!loaded.ok)
    return (
      <Page width="wide" title="Загрузка конкурентов" subtitle={subtitle}>
        <LoadError testId="market-error" {...loadErrorProps(loaded.e)} />
      </Page>
    );
  const view = loaded.r;
  const empty = view.competitors.length === 0;
  return (
    <Page
      width="wide"
      title="Загрузка конкурентов"
      subtitle={subtitle}
      // одна кнопка «Добавить» на экране: пусто, она в пустом состоянии; есть конкуренты, в шапке
      actions={editable && !empty ? <CompetitorButton defaultOpen={sp.add === '1'} /> : undefined}
    >
      {!empty && <Toolbar from={from} days={days} asOf={asOf} compare={compare} today={today} />}
      {empty ? (
        <EmptyState
          icon={<Icon name="analytics" />}
          title="Добавьте ближайших конкурентов"
          data-testid="market-empty"
          details={<HowItWorks />}
          actions={editable ? <CompetitorButton primary defaultOpen={sp.add === '1'} /> : undefined}
        >
          Три-пять отелей рядом с вами, с которыми гость сравнивает вас при выборе.{' '}
          {!editable && 'Добавлять конкурентов могут владелец и управляющий.'}
        </EmptyState>
      ) : (
        <>
          <Summary view={view} />
          <Insights view={view} />
          <CompetitorsTable
            view={view}
            rates={rates}
            today={today}
            editable={editable}
            district={district}
            category={category}
            keep={[...base.entries()]}
          />
          <MarketCharts board={view.board} rates={rates && rates.board.summary.competitorsWithData > 0 ? rates : null} />
          <Grid view={view} nightHref={nightHref} />
          {night && (
            <NightDrawer date={night} history={nightLoaded} closeHref={`/market?${base}`} />
          )}
        </>
      )}
      {!empty && (
        <p className="market-note" data-testid="market-source-note">
          Ваша загрузка берётся из календаря: занятые места от всех, включая заблокированные. Загрузку и цены
          соседей вносите вы или загружаете из файла; снимки сборщика подписаны «ИИ». Сайты бронирования мы
          автоматически не читаем, их условия это запрещают; автоматический сбор из разрешённого источника
          пока не подключён.
        </p>
      )}
    </Page>
  );
}

/**
 * Как работает раздел: три шага. Источник загрузки не обещаем: сбор с площадок не решён (Q-257 открыт, ADR-142
 * запрещает автоматически читать площадки), поэтому шаг 2 говорит «вручную или сборщиком».
 */
function HowItWorks() {
  return (
    <AutoGrid min={180} role="list" className="market-steps" data-testid="market-steps">
      <div role="listitem">
        <strong>Добавьте соседа</strong>
        название, расстояние и число номеров
      </div>
      <div role="listitem">
        <strong>Загрузка соседей обновляется</strong>
        вручную или сборщиком: процент занятых номеров на каждую ближайшую ночь
      </div>
      <div role="listitem">
        <strong>WETOP подсказывает цену</strong>
        где рынок почти полон, цену можно поднять; где пусто, пора акция
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
  if (c.sources.includes('AI_AGENT')) return { word: 'ИИ', tone: 'info' };
  return competitorPlatform(c.url)
    ? { word: 'Сбор не подключён', tone: 'neutral' }
    : { word: 'вручную', tone: 'neutral' };
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
        <Button type="submit" tone="secondary">
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

function Summary({ view }: { view: MarketView }) {
  const s = view.board.summary;
  return (
    <div className="market-tiles" data-testid="market-tiles">
      <Stat
        label="Загрузка рынка"
        value={pctTile(s.marketBp)}
        hint={`по ${s.competitorsWithData} из ${pluralRu(s.competitors, ['конкурента', 'конкурентов', 'конкурентов'])}`}
        testId="market-tile-market"
      />
      <Stat label="Ваша загрузка" value={pctTile(s.ownBp)} hint="по календарю" testId="market-tile-own" />
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
    </div>
  );
}

function Insights({ view }: { view: MarketView }) {
  const { insights } = view.board;
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

function Grid({
  view,
  nightHref,
}: {
  view: MarketView;
  nightHref: (date: string) => string;
}) {
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
                      {tracking(c).word}
                    </Badge>
                  </span>
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
            );
          })}
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
