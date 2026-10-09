/**
 * Геометрия линейного графика (RPT2.2c-3, DESIGN.md §8.2 `LineChart`). Только координаты на экране: деньги сюда
 * приходят уже в целых единицах для рисования, расчёты ADR и RevPAR делает домен. Пропуск (`null`) рвёт линию.
 */
export interface Pad {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export interface LineSeriesGeometry {
  /** Куски линии в формате `M x,y L x,y …` */
  segments: string[];
  /** Все точки: для маркеров и одиночных значений */
  dots: Array<{ x: number; y: number; index: number }>;
}
export interface LineGeometry {
  max: number;
  ticks: number[];
  series: LineSeriesGeometry[];
  /** x центра подписи для каждого значения */
  xs: number[];
}

const DEFAULT_PAD: Pad = { top: 8, right: 8, bottom: 8, left: 8 };

/** Верх шкалы: 1, 2, 2.5, 5 или 10 от степени десяти, не меньше максимума; нулевой максимум даёт 1 */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

export function lineGeometry(
  data: Array<Array<number | null>>,
  box: { width: number; height: number; pad?: Pad },
): LineGeometry {
  const pad = box.pad ?? DEFAULT_PAD;
  const count = data.reduce((n, d) => Math.max(n, d.length), 0);
  const all = data.flat().filter((v): v is number => v !== null);
  const max = all.length === 0 ? 0 : niceMax(Math.max(...all));
  const scale = max || 1;
  const w = box.width - pad.left - pad.right;
  const h = box.height - pad.top - pad.bottom;
  const x = (i: number) => (count <= 1 ? pad.left + w / 2 : pad.left + (w * i) / (count - 1));
  const y = (v: number) => pad.top + h - (h * v) / scale;
  const f = (n: number) => String(Math.round(n * 100) / 100);
  const series = data.map((values): LineSeriesGeometry => {
    const segments: string[] = [];
    const dots: LineSeriesGeometry['dots'] = [];
    let cur: string[] = [];
    const flush = () => {
      if (cur.length > 1) segments.push(cur.join(' '));
      cur = [];
    };
    values.forEach((v, i) => {
      if (v === null) {
        flush();
        return;
      }
      dots.push({ x: x(i), y: y(v), index: i });
      cur.push(`${cur.length === 0 ? 'M' : 'L'}${f(x(i))},${f(y(v))}`);
    });
    flush();
    return { segments, dots };
  });
  const ticks = max === 0 ? [] : [0, 1, 2, 3, 4].map((k) => (max * k) / 4);
  return { max, ticks, series, xs: Array.from({ length: count }, (_, i) => x(i)) };
}
