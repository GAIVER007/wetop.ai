import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Команда и безопасность» (LAND2, ТЗ §8): три пункта (роли ADR-107, филиалы ADR-104, журнал) и
 * компактный пример списка сотрудников. Имена вымышленные, абсолютных обещаний безопасности нет.
 */
export function Team() {
  const { team } = getDictionary();
  return (
    <section id="team" className="section section--band" aria-labelledby="team-title">
      <div className="container team__layout">
        <div>
          <SectionHeading id="team-title" eyebrow={team.eyebrow} title={team.title} lead={team.lead} />
          <ul className="team__items">
            {team.items.map((item) => (
              <li key={item.title} className="team__item">
                <span className="icon-tile icon-tile--sm">
                  <Icon name={item.icon} size={20} />
                </span>
                <div>
                  <h3 className="card__title">{typo(item.title)}</h3>
                  <p className="card__text">{typo(item.text)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <figure className="team__preview glass" aria-label={team.preview.label}>
          <figcaption className="team__preview-head">
            <strong>{team.preview.title}</strong>
            <span>{getDictionary().intro.previewLabel}</span>
          </figcaption>
          <ul className="team__roster">
            {team.preview.rows.map((row) => (
              <li key={row.name}>
                <span className="team__avatar" aria-hidden="true">
                  <Icon name="guest" size={16} />
                </span>
                <span className="team__name">{row.name}</span>
                <span className="team__role">{row.role}</span>
              </li>
            ))}
          </ul>
        </figure>
      </div>
    </section>
  );
}
