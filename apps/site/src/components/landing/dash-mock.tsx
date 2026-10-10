import { getDictionary } from '../../i18n';

/*
 * Дашборд-мокап «Сегодня» (LAND2 v2): сайдбар, четыре метрики, ближайшие заезды, график недели.
 * Общий для главной и лендинга «Для гостиниц»; только вымышленные данные, подпись примера ставит
 * страница рядом (§19.9). Высота столбика графика считается из данных (slop-allow в разметке).
 */
export function DashMock() {
  const { dash } = getDictionary().hero;
  const max = Math.max(...dash.chartValues);
  const peak = dash.chartValues.indexOf(max);
  return (
          <div className="dash" aria-hidden="false">
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
                  <h2>{dash.title}</h2>
                  <p>{dash.date}</p>
                </div>
                <span className="dash__scope">{dash.scope}</span>
              </div>
              <div className="dash__metrics">
                {dash.metrics.map((metric) => (
                  <div className="dash__metric" key={metric.name}>
                    <span className="dash__metric-name">{metric.name}</span>
                    <strong>{metric.value}</strong>
                    <span className="dash__delta">{metric.delta}</span>
                  </div>
                ))}
              </div>
              <div className="dash__columns">
                <div className="dash__arrivals">
                  <h3>{dash.arrivalsTitle}</h3>
                  {dash.arrivals.map((row) => (
                    <div className="dash__arrival" key={row.name}>
                      <span className="dash__time">{row.time}</span>
                      <strong>{row.name}</strong>
                      <span className="dash__detail">{row.detail}</span>
                      <span className="dash__guests">{row.guests}</span>
                    </div>
                  ))}
                  <span className="dash__more">{dash.showAll}</span>
                </div>
                <div className="dash__chart">
                  <h3>{dash.chartTitle}</h3>
                  <div className="dash__bars" role="img" aria-label={dash.chartTitle}>
                    {dash.chartValues.map((value, i) => (
                      <div className="dash__bar-col" key={dash.chartDays[i]}>
                        {i === peak ? <span className="dash__bar-tip">{dash.chartPeak}</span> : null}
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
