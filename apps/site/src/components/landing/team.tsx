import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/** «Команда и доступ»: три роли (ADR-107), журнал действий, работа в браузере и защита данных гостей. */
export function Team() {
  const { team } = getDictionary();
  return (
    <section id="team" className="section section--band" aria-labelledby="team-title">
      <div className="container">
        <SectionHeading id="team-title" eyebrow={team.eyebrow} title={team.title} lead={team.lead} />
        <ul className="card-grid card-grid--3">
          {team.items.map((item) => (
            <li key={item.title} className="card glass">
              <span className="icon-tile">
                <Icon name={item.icon} />
              </span>
              <h3 className="card__title">{typo(item.title)}</h3>
              <p className="card__text">{typo(item.text)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
