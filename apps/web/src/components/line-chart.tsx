import { lineGeometry } from '../lib/line-geometry';

const W = 640;
const H = 200;

export interface LineSeries {
  name: string;
  /** Значения в тех же единицах, что и ось; `null` рвёт линию */
  values: Array<number | null>;
  /** Вторая и следующие линии пунктиром: различие не держится на одном цвете */
  dashed?: boolean;
  /** Итог по периоду для списка под графиком, уже отформатированный */
  summary: string;
}

/**
 * Линейный график (RPT2.2c-3, DESIGN.md §8.2 `LineChart`): одна-две линии по точкам периода. Линии это геометрия
 * `lib/line-geometry.ts`; смысл держат список под графиком (имя линии и итог периода) и скрытая от глаз таблица значений
 * для программы чтения, а сам рисунок для неё скрыт. Первая линия цвета `--chart-1`, вторая `--chart-2` пунктиром.
 */
export function LineChart({
  series,
  labels,
  axisLabels,
  format,
  formatAxis,
  testId,
}: {
  series: LineSeries[];
  /** Подпись каждой точки словами (день, неделя, месяц): в таблицу значений и под ось */
  labels: string[];
  /** Короткие подписи под осью (по умолчанию те же `labels`): показываются начало, середина и конец */
  axisLabels?: string[];
  /** Число в таблице значений, уже в нужной единице */
  format: (value: number) => string;
  /** Короткое число на оси (по умолчанию `format`) */
  formatAxis?: (value: number) => string;
  testId: string;
}) {
  const geo = lineGeometry(
    series.map((s) => s.values),
    { width: W, height: H, pad: { top: 6, right: 6, bottom: 6, left: 6 } },
  );
  const short = axisLabels ?? labels;
  const mid = Math.floor((short.length - 1) / 2);
  const ends = short.length > 2 ? [0, mid, short.length - 1] : short.map((_, i) => i);
  return (
    <div className="line" data-testid={testId}>
      <div className="line__plot">
        <ul className="line__ticks" aria-hidden="true">
          {geo.ticks.map((t) => (
            <li key={t}>{(formatAxis ?? format)(t)}</li>
          ))}
        </ul>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {geo.ticks.map((t) => (
            <line
              key={t}
              className="line__grid"
              x1="0"
              x2={W}
              y1={H - 6 - ((H - 12) * t) / (geo.max || 1)}
              y2={H - 6 - ((H - 12) * t) / (geo.max || 1)}
            />
          ))}
          {geo.series.map((g, i) => (
            <g key={series[i]?.name} className={`line__series line__series--${i}`}>
              {g.segments.map((d) => (
                <path key={d} d={d} className={series[i]?.dashed ? 'is-dashed' : undefined} />
              ))}
              {g.segments.length === 0 &&
                g.dots.map((p) => (
                  <path key={p.index} d={`M${p.x},${p.y} L${p.x},${p.y}`} className="line__dot" />
                ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="line__x" aria-hidden="true">
        {ends.map((i) => (
          <span key={i}>{short[i]}</span>
        ))}
      </div>
      <ul className="line__legend">
        {series.map((s, i) => (
          <li key={s.name}>
            <i
              className={`line__swatch line__swatch--${i}${s.dashed ? ' is-dashed' : ''}`}
              aria-hidden="true"
            />
            <span>{s.name}</span>
            <strong>{s.summary}</strong>
          </li>
        ))}
      </ul>
      {/* Таблица значений для читалки обёрнута в div: у таблицы `height: 1px` из .sr-only не действует, и абсолютная
          таблица в 800+ px растягивала страницу «Аналитики» ниже экрана (desktop-compact, 09.10.2026) */}
      <div className="sr-only">
        <table>
          <caption>Значения по точкам графика</caption>
          <thead>
            <tr>
              <th scope="col">Точка графика</th>
              {series.map((s) => (
                <th key={s.name} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {series.map((s) => (
                  <td key={s.name}>
                    {s.values[i] == null ? 'нет данных' : format(s.values[i] as number)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
