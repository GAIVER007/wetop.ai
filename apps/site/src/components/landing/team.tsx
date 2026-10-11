import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { typo } from '../typo';

/*
 * «Команда и контроль доступа» и «Запуск за четыре шага» в два столбца (по снимку владельца).
 * Левая колонка: три карточки команды; правая: четыре нумерованных шага со стрелками между ними.
 */
export function TeamAndStart() {
  const t = getDictionary();
  return (
    <section id="team" className="section team-start" aria-labelledby="team-title">
      <div className="container team-start__layout">
        <div>
          <div className="section-heading">
            <p className="eyebrow">{t.team.eyebrow}</p>
            <h2 id="team-title" className="section-heading__title">
              {typo(t.team.title)}
            </h2>
            <p className="section-heading__lead">{typo(t.team.lead)}</p>
          </div>
          <ul className="card-grid team-start__cards">
            {t.team.items.map((item) => (
              <li key={item.title} className="card card--compact glass">
                <span className="icon-tile icon-tile--sm">
                  <Icon name={item.icon} size={20} />
                </span>
                <div className="card__body">
                  <h3 className="card__title">{typo(item.title)}</h3>
                  <p className="card__text">{typo(item.text)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div id="start" aria-labelledby="start-title">
          <div className="section-heading">
            <p className="eyebrow">{t.start.eyebrow}</p>
            <h2 id="start-title" className="section-heading__title">
              {typo(t.start.title)}
            </h2>
            <p className="section-heading__lead">{typo(t.start.lead)}</p>
          </div>
          <ol className="steps steps--row">
            {t.start.steps.map((step, index) => (
              <li key={step.title} className="step glass">
                <span className="step__number" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="card__title">{typo(step.title)}</h3>
                <p className="card__text">{typo(step.text)}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
