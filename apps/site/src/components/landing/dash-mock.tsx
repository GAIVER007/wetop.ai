import type { Dictionary } from '../../i18n/types';

type Dash = Dictionary['hero']['dash'];
export type DashView = Dash['views'][number];

/*
 * Дашборд-мокап «Сегодня» (LAND2 v2): сайдбар, четыре метрики, список дня, график недели.
 * Общий для главной (экран выбирает переключатель направлений, `HeroDash`) и лендинга «Для гостиниц»
 * (всегда гостиничный экран). Без состояния: рисуется и на сервере, и в клиентском переключателе.
 * Только вымышленные данные, подпись примера ставит страница рядом (§19.9).
 */
export function DashMock({ dash, view }: { dash: Dash; view: DashView }) {
  const max = Math.max(...view.chartValues);
  const peak = view.chartValues.indexOf(max);
  return (
    <div className="dash">
      <div className="dash__sidebar" aria-hidden="true">
        <span className="dash__brand">
          <span className="dash__logo">W</span> WETOP.AI
        </span>
        <div className="dash__nav">
          {dash.nav.map((name, i) => (
            <span key={name} className={i === 0 ? 'dash__selected' : undefined}>
              {name}
            </span>
          ))}
        </div>
      </div>
      <div className="dash__main">
        <div className="dash__heading">
          <div>
            <p className="dash__title">{dash.title}</p>
            <p>{dash.date}</p>
          </div>
          <span className="dash__scope">{dash.scope}</span>
        </div>
        <div className="dash__metrics">
          {view.metrics.map((metric) => (
            <div className="dash__metric" key={metric.name}>
              <span className="dash__metric-name">{metric.name}</span>
              <strong>{metric.value}</strong>
              <span className="dash__delta">{metric.delta}</span>
            </div>
          ))}
        </div>
        <div className="dash__columns">
          <div className="dash__arrivals">
            <p className="dash__subtitle">{view.listTitle}</p>
            {view.rows.map((row) => (
              <div className="dash__arrival" key={row.time}>
                <span className="dash__time">{row.time}</span>
                <strong>{row.name}</strong>
                <span className="dash__detail">{row.detail}</span>
                <span className="dash__guests">{row.extra}</span>
              </div>
            ))}
            <span className="dash__more">{dash.showAll}</span>
          </div>
          <div className="dash__chart">
            <p className="dash__subtitle">{view.chartTitle}</p>
            <div className="dash__bars" role="img" aria-label={view.chartTitle}>
              {view.chartValues.map((value, i) => (
                <div className="dash__bar-col" key={dash.chartDays[i]}>
                  {i === peak ? <span className="dash__bar-tip">{`${max}\u00a0%`}</span> : null}
                  <span
                    className={`dash__bar${i === peak ? ' dash__bar--peak' : ''}`}
                    // slop-allow: inline-style высота столбика считается из данных графика
                    style={{ height: `${value}%` }}
                  />
                  <span className="dash__day">{dash.chartDays[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
