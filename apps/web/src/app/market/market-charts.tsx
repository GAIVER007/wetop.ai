import { formatOccupancy, formatPoints } from '@pms/domain';
import type { MarketRates, MarketView } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { SectionTitle } from '../../components/ui';
import { formatMoney } from '../../lib/money';
import {
  buildChartRows,
  buildPriceRows,
  changeSummary,
  coverageRuns,
  linePath,
  shortMoney,
  type ChartRow,
  type PriceRow,
} from './chart-data';
import { intlLocale, msg, type Translate } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';

/** Язык графиков: перевод и локаль дат, общие для всех графиков экрана */
interface Lang {
  t: Translate;
  il: ReturnType<typeof intlLocale>;
}

/**
 * Три графика экрана «Загрузка конкурентов» (SALES2.3), чистый SVG без клиентского кода: токены `--chart-*`, подсказка
 * на каждой точке (`<title>`), таблица значений в `<details>` для читалок и клавиатуры. Цен у конкурентов нет
 * (ADR-142), поэтому графики про загрузку, наличие внесённых данных и изменение к прошлому снимку; цены ночей
 * рисуются четвёртым графиком, когда они внесены (DATA_MODEL §23.1). Линии различаются
 * штрихом и подписью, а не только цветом: цветов у графиков два.
 */
const W = 720;
const H = 168;
const PAD = { l: 64, r: 8, t: 12, b: 24 };
const PLOT = { w: W - PAD.l - PAD.r, h: H - PAD.t - PAD.b };

const pct = (bp: number | null, t: Translate) =>
  bp === null ? t('нет данных') : formatOccupancy(Math.round(bp / 100) * 100);

function Frame<R extends { date: string }>({
  title,
  lead,
  note,
  children,
  rows,
  testId,
  columns,
  lang,
}: {
  lang: Lang;
  title: string;
  /** Вывод одной фразой над графиком: что из него следует, без чтения столбиков */
  lead?: string | undefined;
  note?: string;
  children: React.ReactNode;
  rows: R[];
  testId: string;
  columns: Array<{ head: string; cell: (r: R) => string }>;
}) {
  const { t, il } = lang;
  return (
    <figure className="market-chart" data-testid={testId}>
      <figcaption>
        <SectionTitle first>{title}</SectionTitle>
        {lead && <p className="market-chart__lead">{lead}</p>}
        {note && <p className="market-chart__note">{note}</p>}
      </figcaption>
      <div className="market-chart__scroll" tabIndex={0} role="group" aria-label={t('{title}: график, прокручивается на узком экране', { title })}>
        {children}
      </div>
      <details className="market-chart__table">
        <summary>{t('Значения по ночам')}</summary>
        <table className="tbl tbl--compact">
          <thead>
            <tr>
              <th scope="col">{t('Ночь')}</th>
              {columns.map((c) => (
                <th scope="col" key={c.head}>
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <th scope="row">{displayDate(r.date, 'short', il)}</th>
                {columns.map((c) => (
                  <td key={c.head}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Axes({ rows, ticks }: { rows: Array<{ date: string }>; ticks: Array<{ y: number; label: string }> }) {
  const every = rows.length > 20 ? 5 : rows.length > 10 ? 2 : 1;
  const band = PLOT.w / Math.max(rows.length, 1);
  return (
    <>
      {ticks.map((t) => (
        <g key={t.label}>
          <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="var(--grid-line)" strokeWidth={1} />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize={13} fill="var(--muted-2)">
            {t.label}
          </text>
        </g>
      ))}
      {rows.map((r, i) =>
        i % every === 0 ? (
          <text key={r.date} x={PAD.l + i * band + band / 2} y={H - 6} textAnchor="middle" fontSize={13} fill="var(--muted-2)">
            {Number(r.date.slice(8, 10))}
          </text>
        ) : null,
      )}
    </>
  );
}

export async function MarketCharts({ board, rates }: { board: MarketView['board']; rates?: MarketRates | null }) {
  const t = await serverT();
  const lang: Lang = { t, il: intlLocale(await currentLocale()) };
  const { il } = lang;
  const rows = buildChartRows(board);
  const n = Math.max(rows.length, 1);
  const band = PLOT.w / n;
  const x = (i: number) => Math.round(PAD.l + i * band + band / 2);
  const yPct = (bp: number) => Math.round(PAD.t + PLOT.h - (Math.min(bp, 10000) / 10000) * PLOT.h);
  const ticksPct = [0, 5000, 10000].map((bp) => ({ y: yPct(bp), label: formatOccupancy(bp) }));
  const series = [
    { key: 'max', label: msg('Самый загруженный сосед'), stroke: 'var(--muted-2)', dash: '2 4', width: 1.5 },
    { key: 'min', label: msg('Самый свободный сосед'), stroke: 'var(--muted-2)', dash: '8 4', width: 1.5 },
    { key: 'market', label: msg('Рынок (среднее)'), stroke: 'var(--chart-2)', dash: undefined, width: 2.5 },
    { key: 'own', label: msg('Вы'), stroke: 'var(--chart-1)', dash: undefined, width: 3 },
  ] as const;


  return (
    <section className="market-charts" aria-label={t('Графики')} data-testid="market-charts">
      {rates && <PriceChart rates={rates} lang={lang} />}
      <Frame
        lang={lang}
        testId="market-chart-load"
        title={t('Загрузка по ночам')}
        note={t('Ваша загрузка по календарю, рынок и два соседа-крайних по внесённым данным. Это внесённые значения, а не измеренная загрузка.')}
        rows={rows}
        columns={[
          { head: t('Вы'), cell: (r) => pct(r.own, t) },
          { head: t('Рынок'), cell: (r) => pct(r.market, t) },
          { head: t('Самый свободный'), cell: (r) => pct(r.min, t) },
          { head: t('Самый загруженный'), cell: (r) => pct(r.max, t) },
        ]}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('Загрузка по ночам: вы, рынок и крайние соседи')} className="market-chart__svg">
          <Axes rows={rows} ticks={ticksPct} />
          {series.map((s) => (
            <path
              key={s.key}
              data-series={s.key}
              d={linePath(rows.map((r) => r[s.key]), yPct, x)}
              fill="none"
              stroke={s.stroke}
              strokeWidth={s.width}
              strokeDasharray={s.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {rows.map((r, i) =>
            r.own === null ? null : (
              <circle key={r.date} cx={x(i)} cy={yPct(r.own)} r={3} fill="var(--chart-1)">
                <title>
                  {t('{date}: вы {own}, рынок {market}', {
                    date: displayDate(r.date, 'short', il),
                    own: pct(r.own, t),
                    market: pct(r.market, t),
                  })}
                </title>
              </circle>
            ),
          )}
        </svg>
        <ul className="market-chart__legend" aria-label={t('Обозначения')}>
          {series
            .slice()
            .reverse()
            .map((s) => (
              <li key={s.key}>
                <svg width="28" height="8" aria-hidden="true">
                  <line x1="0" x2="28" y1="4" y2="4" stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
                </svg>
                {t(s.label)}
              </li>
            ))}
        </ul>
      </Frame>

      <CoverageChart rows={rows} lang={lang} />
      <ChangeChart rows={rows} compareDays={board.compareDays} lang={lang} />
    </section>
  );
}

/** «11–15 окт.» в одном месяце, «28 окт. – 3 нояб.» через границу месяца */
const span = (from: string, to: string, il: Lang['il']) =>
  from === to
    ? displayDate(from, 'short', il)
    : from.slice(0, 7) === to.slice(0, 7)
      ? `${Number(from.slice(8, 10))}–${displayDate(to, 'short', il)}`
      : `${displayDate(from, 'short', il)} – ${displayDate(to, 'short', il)}`;

/** Полнота словами: короткий период пересказывается отрезками, длинный пёстрый счётом ночей */
function coverageLead(rows: ChartRow[], { t, il }: Lang): string {
  const runs = coverageRuns(rows);
  const total = runs[0]?.total ?? 0;
  if (!runs.length) return '';
  if (runs.every((r) => r.withData === r.total))
    return t('На все ночи внесены данные всех соседей ({total} из {total}).', { total });
  if (runs.length <= 4)
    return `${runs
      .map(
        (r) =>
          `${span(r.from, r.to, il)}: ${r.withData === 0 ? t('нет данных') : t('{n} из {total} соседей', { n: r.withData, total: r.total })}`,
      )
      .join('; ')}.`;
  const count = (f: (r: ChartRow) => boolean) => rows.filter(f).length;
  return t('Данные всех соседей на {full} ночах из {nights}, части соседей на {part}, нет данных на {none}.', {
    full: count((r) => r.withData === r.total),
    nights: rows.length,
    part: count((r) => r.withData > 0 && r.withData < r.total),
    none: count((r) => r.withData === 0),
  });
}

const COVERAGE = [
  { key: 'full', label: msg('все соседи') },
  { key: 'part', label: msg('часть соседей') },
  { key: 'none', label: msg('нет данных') },
] as const;
type Coverage = (typeof COVERAGE)[number]['key'];
const coverageOf = (r: ChartRow): Coverage => (r.withData === 0 ? 'none' : r.withData >= r.total ? 'full' : 'part');

/** Ячейка полосы: заполнена целиком, наполовину или пустая пунктирная, чтобы состояние читалось и без цвета */
function CoverageCell({ x, y, w, h, state }: { x: number; y: number; w: number; h: number; state: Coverage }) {
  if (state === 'none')
    return <rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke="var(--muted-2)" strokeDasharray="3 3" />;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="var(--chart-1-soft)" />
      <rect x={x} y={state === 'full' ? y : y + h / 2} width={w} height={state === 'full' ? h : h / 2} rx={4} fill="var(--chart-1)" />
    </>
  );
}

const STRIP = { h: 64, top: 6, cell: 28 };

function CoverageChart({ rows, lang }: { rows: ChartRow[]; lang: Lang }) {
  const { t, il } = lang;
  const band = PLOT.w / Math.max(rows.length, 1);
  const cellW = Math.max(2, Math.min(40, band - 4));
  const every = rows.length > 20 ? 5 : rows.length > 10 ? 2 : 1;
  return (
    <Frame
      lang={lang}
      testId="market-chart-data"
      title={t('Полнота данных по соседям')}
      lead={coverageLead(rows, lang)}
      note={t('Чем меньше соседей внесено на ночь, тем меньше стоит доверять средней по рынку на эту ночь. Ночь без данных не значит, что отель пуст: просто нет замера.')}
      rows={rows}
      columns={[{ head: t('С данными'), cell: (r) => t('{n} из {total}', { n: r.withData, total: r.total }) }]}
    >
      <svg viewBox={`0 0 ${W} ${STRIP.h}`} width="100%" role="img" aria-label={t('Полнота данных по соседям на каждую ночь')} className="market-chart__svg">
        {rows.map((r, i) => {
          const x0 = PAD.l + i * band + (band - cellW) / 2;
          return (
            <g key={r.date} data-coverage={coverageOf(r)}>
              <CoverageCell x={x0} y={STRIP.top} w={cellW} h={STRIP.cell} state={coverageOf(r)} />
              <title>
                {`${displayDate(r.date, 'short', il)}: ${t('{n} из {total} соседей', { n: r.withData, total: r.total })}`}
              </title>
              {i % every === 0 && (
                <text x={x0 + cellW / 2} y={STRIP.top + STRIP.cell + 20} textAnchor="middle" fontSize={13} fill="var(--muted-2)">
                  {Number(r.date.slice(8, 10))}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ul className="market-chart__legend" aria-label={t('Обозначения')}>
        {COVERAGE.map((c) => (
          <li key={c.key}>
            <svg width="20" height="14" aria-hidden="true">
              <CoverageCell x={1} y={1} w={18} h={12} state={c.key} />
            </svg>
            {t(c.label)}
          </li>
        ))}
      </ul>
    </Frame>
  );
}

const compareWord = (days: number, t: Translate) =>
  days === 1
    ? t('со вчерашним замером')
    : days === 7
      ? t('с замером неделю назад')
      : t('с замером {n} дн. назад', { n: days });
const points = (bp: number) => formatPoints(Math.round(bp / 100) * 100);

function changeLead(rows: ChartRow[], t: Translate): string | undefined {
  const s = changeSummary(rows);
  if (!s) return undefined;
  const avg = Math.round(s.avgBp / 100) * 100;
  const word =
    avg > 0 ? t('соседи заполняются') : avg < 0 ? t('соседи освобождаются') : t('загрузка соседей не изменилась');
  return t('В среднем {points}: {word}. Ночей с ростом: {up}, с падением: {down}, всего со сравнением: {nights}.', {
    points: points(avg),
    word,
    up: s.up,
    down: s.down,
    nights: s.nights,
  });
}

/**
 * Изменение загрузки соседей к прошлому замеру. Шкала от фактических значений (ноль внизу, если всё в плюс), а не
 * симметричная: иначе половина графика пустая. Значение подписано над столбиком, пока столбики не слишком узкие.
 */
function ChangeChart({ rows, compareDays, lang }: { rows: ChartRow[]; compareDays: number; lang: Lang }) {
  const { t, il } = lang;
  const comparing = compareDays > 0;
  const band = PLOT.w / Math.max(rows.length, 1);
  const x = (i: number) => Math.round(PAD.l + i * band + band / 2);
  const barW = Math.min(24, Math.max(2, band - 2));
  const values = rows.flatMap((r) => (r.changeBp === null ? [] : [r.changeBp]));
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const room = Math.max(hi - lo, 500) * 0.22; // место под подпись значения
  const top = hi + (hi > 0 || lo === 0 ? room : 0);
  const bottom = lo - (lo < 0 ? room : 0);
  const y = (bp: number) => Math.round(PAD.t + ((top - bp) / (top - bottom)) * PLOT.h);
  const labelled = band >= 30;
  // подписи на столбиках уже называют значения; крайние отметки шкалы нужны, только когда подписей нет
  const ticks = [{ y: y(0), label: '0' }];
  if (!labelled && hi > 0) ticks.unshift({ y: y(hi), label: points(hi) });
  if (!labelled && lo < 0) ticks.push({ y: y(lo), label: points(lo) });
  return (
    <Frame
      lang={lang}
      testId="market-chart-change"
      title={t('Как меняется загрузка соседей')}
      lead={comparing ? changeLead(rows, t) : undefined}
      note={
        comparing
          ? t('Сравнение {compare}: на сколько в среднем выросла или упала загрузка соседей на каждую ночь. «+12 п.п.» значит, например, было 80 %, стало 92 %.', {
              compare: compareWord(compareDays, t),
            })
          : t('Включите «Изменение» в строке выше: сейчас сравнения нет.')
      }
      rows={rows}
      columns={[{ head: t('Изменение@@сравнение'), cell: (r) => (r.changeBp === null ? t('нет данных') : points(r.changeBp)) }]}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('Изменение загрузки соседей по ночам')} className="market-chart__svg">
        <Axes rows={rows} ticks={ticks} />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--muted-2)" strokeWidth={1.5} />
        {rows.map((r, i) => {
          if (!comparing || r.changeBp === null) return null;
          const y0 = y(0);
          const y1 = y(r.changeBp);
          const up = r.changeBp >= 0;
          return (
            <g key={r.date}>
              <rect
                x={x(i) - barW / 2}
                y={Math.min(y0, y1)}
                width={barW}
                height={Math.max(1, Math.abs(y1 - y0))}
                fill={up ? 'var(--chart-2)' : 'var(--danger)'}
              >
                <title>{`${displayDate(r.date, 'short', il)}: ${points(r.changeBp)}`}</title>
              </rect>
              {labelled && (
                <text x={x(i)} y={up ? y1 - 6 : y1 + 16} textAnchor="middle" fontSize={13} fill="var(--text-2)">
                  {points(r.changeBp).replace(' п.п.', '') /* kk-allow: отрезает единицу из вывода formatPoints домена */}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/**
 * Цены рынка по ночам: средняя и крайние цены соседей из внесённых данных. Ось начинается с нуля не всегда: цены
 * соседей лежат в узком коридоре, и от нуля линия была бы плоской; подписи оси это показывают прямо.
 */
function PriceChart({ rates, lang }: { rates: MarketRates; lang: Lang }) {
  const { t, il } = lang;
  const rows: PriceRow[] = buildPriceRows(rates);
  const known = rows.flatMap((r) => (r.min === null || r.max === null ? [] : [r.min, r.max]));
  const n = Math.max(rows.length, 1);
  const band = PLOT.w / n;
  const x = (i: number) => Math.round(PAD.l + i * band + band / 2);
  const lo = known.length ? Math.min(...known) : 0;
  const hi = known.length ? Math.max(...known) : 1;
  const pad = Math.max(Math.round((hi - lo) * 0.1), 100);
  const bottom = Math.max(0, lo - pad);
  const top = hi + pad;
  const y = (v: number) => Math.round(PAD.t + PLOT.h - ((v - bottom) / Math.max(top - bottom, 1)) * PLOT.h);
  const cur = rates.currency ?? 'KZT';
  const money = (v: number | null) => (v === null ? t('нет данных') : formatMoney(String(v), cur));
  const series = [
    { key: 'max', label: msg('Самая высокая цена соседа'), stroke: 'var(--muted-2)', dash: '2 4', width: 1.5 },
    { key: 'min', label: msg('Самая низкая цена соседа'), stroke: 'var(--muted-2)', dash: '8 4', width: 1.5 },
    { key: 'avg', label: msg('Средняя цена рынка'), stroke: 'var(--chart-2)', dash: undefined, width: 3 },
  ] as const;
  return (
    <Frame
      lang={lang}
      testId="market-chart-price"
      title={t('Цены рынка по ночам')}
      note={t('Цены соседей, которые вы внесли. Это внесённые значения, а не измеренные цены площадок.')}
      rows={rows}
      columns={[
        { head: t('Средняя'), cell: (r) => money(r.avg) },
        { head: t('Самая низкая'), cell: (r) => money(r.min) },
        { head: t('Самая высокая'), cell: (r) => money(r.max) },
        { head: t('Отелей с ценой'), cell: (r) => String(r.count) },
      ]}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('Цены рынка по ночам: средняя и крайние')} className="market-chart__svg">
        <Axes
          rows={rows}
          ticks={[bottom, Math.round((bottom + top) / 2), top].map((v) => ({ y: y(v), label: shortMoney(v, t) }))}
        />
        {series.map((s) => (
          <path
            key={s.key}
            data-series={s.key}
            d={linePath(rows.map((r) => r[s.key]), y, x)}
            fill="none"
            stroke={s.stroke}
            strokeWidth={s.width}
            strokeDasharray={s.dash}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {rows.map((r, i) =>
          r.avg === null ? null : (
            <circle key={r.date} cx={x(i)} cy={y(r.avg)} r={3} fill="var(--chart-2)">
              <title>{t('{date}: средняя {money}', { date: displayDate(r.date, 'short', il), money: money(r.avg) })}</title>
            </circle>
          ),
        )}
      </svg>
      <ul className="market-chart__legend" aria-label={t('Обозначения')}>
        {series
          .slice()
          .reverse()
          .map((s) => (
            <li key={s.key}>
              <svg width="28" height="8" aria-hidden="true">
                <line x1="0" x2="28" y1="4" y2="4" stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
              </svg>
              {t(s.label)}
            </li>
          ))}
      </ul>
    </Frame>
  );
}
