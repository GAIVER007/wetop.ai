import { getDictionary } from '../i18n';

/*
 * Иллюстрация общего операционного экрана «Сегодня» на HTML/CSS: боковое меню разделов, филиал, три плитки,
 * клиенты по времени, задачи, финансы недели и строка свежего события. Ни номеров, ни коек, ни каналов OTA —
 * первый экран говорит о платформе, а не о гостинице (ADR-104). Клиенты вымышленные (ADR-010).
 * Для скринридера — одна подпись.
 */
export function OperationsMockup() {
  const t = getDictionary().operations;
  return (
    <div className="mockup mockup--ops" role="img" aria-label={t.label}>
      <div className="mockup__window">
        <div className="mockup__toolbar">
          <span className="mockup__dots">
            <i />
            <i />
            <i />
          </span>
          <span className="mockup__title">{t.title}</span>
          <span className="ops__branch">{t.branch}</span>
        </div>

        <div className="ops__frame">
          <span className="ops__rail">
            {t.rail.map((section, index) => (
              <span key={section} className={index === 0 ? 'is-on' : undefined}>
                {section}
              </span>
            ))}
          </span>

          <div className="ops">
            <div className="ops__kpis">
              {t.kpis.map((kpi) => (
                <span key={kpi.label} className="ops__kpi">
                  <small>{kpi.label}</small>
                  <strong>{kpi.value}</strong>
                  <em className={kpi.tone ? `ops__trend ops__trend--${kpi.tone}` : 'ops__trend'}>
                    {kpi.note}
                  </em>
                </span>
              ))}
            </div>

            <div className="ops__cols">
              <div className="ops__block">
                <span className="ops__block-title">{t.clientsTitle}</span>
                {t.clients.map((client) => (
                  <span key={client.time} className="ops__line">
                    <b className="ops__time">{client.time}</b>
                    <span className="ops__who">
                      {client.name}
                      <small>{client.what}</small>
                    </span>
                    <span className={`ops__state ops__state--${client.tone}`}>{client.state}</span>
                  </span>
                ))}
              </div>
              <div className="ops__block">
                <span className="ops__block-title">{t.tasksTitle}</span>
                {t.tasks.map((task) => (
                  <span key={task.text} className={`ops__task${task.done ? ' is-done' : ''}`}>
                    <i aria-hidden="true" />
                    <span>
                      {task.text}
                      <small>{task.who}</small>
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="ops__finance">
              <span className="ops__block-title">{t.financeTitle}</span>
              <span className="ops__bars">
                {t.financeBars.map((height, index) => (
                  <i
                    key={index}
                    style={{ height: `${height}%` }}
                    className={index === t.financeBars.length - 1 ? 'is-today' : undefined}
                  />
                ))}
              </span>
              <span className="ops__finance-sum">
                <strong>{t.financeValue}</strong>
                <small>{t.financeNote}</small>
              </span>
            </div>

            <div className="ops__event">
              <span className="ops__event-dot" />
              <span className="ops__event-text">
                <strong>{t.event.title}</strong>
                <small>{t.event.text}</small>
              </span>
              <span className="ops__event-time">{t.event.time}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
