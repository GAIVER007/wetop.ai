import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Возможности» (LAND2, ТЗ §6): шесть задач ежедневной работы сеткой 3×2 на компьютере и 2×3 на
 * телефоне (CSS `.card-grid--3`). У карточки одна иконка, название и до двух строк текста.
 */
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
        <ul className="card-grid card-grid--3 features__grid">
          {features.items.map((item) => (
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
    </section>
  );
}
