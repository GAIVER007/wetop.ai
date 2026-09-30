import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

export function Audience() {
  const { audience } = getDictionary();
  return (
    <section id="audience" className="section" aria-labelledby="audience-title">
      <div className="container">
        <SectionHeading
          id="audience-title"
          eyebrow={audience.eyebrow}
          title={audience.title}
          lead={audience.lead}
        />
        <ul className="audience-strip glass">
          {audience.items.map((item) => (
            <li key={item.title} className="audience-strip__item">
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
