import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

export function Features() {
  const { features } = getDictionary();
  return (
    <section id="features" className="section" aria-labelledby="features-title">
      <div className="container">
        <SectionHeading
          id="features-title"
          eyebrow={features.eyebrow}
          title={features.title}
          lead={features.lead}
        />
        <ul className="card-grid card-grid--4">
          {features.items.map((item) => (
            <li key={item.title} className="card feature-card glass">
              <span className="icon-tile">
                <Icon name={item.icon} />
              </span>
              <h3 className="card__title">{typo(item.title)}</h3>
              <p className="card__text">{typo(item.text)}</p>
              {item.tags?.length ? (
                <ul className="tag-list">
                  {item.tags.map((tag) => (
                    <li key={tag} className="tag">
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
