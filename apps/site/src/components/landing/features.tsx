import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Что умеет WETOP»: восемь разделов стойки. С 02.10.2026 это не восемь карточек-колонок с абзацем в каждой,
 * а восемь строк-пунктов в две колонки (`.card--compact`): иконка слева, заголовок и одна фраза справа.
 * Раздел просматривают, а не читают: порядок и состав прежние, короче стал текст и форма карточки.
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
        <ul className="card-grid card-grid--2">
          {features.items.map((item) => (
            <li key={item.title} className="card card--compact glass">
              <span className="icon-tile icon-tile--sm">
                <Icon name={item.icon} size={20} />
              </span>
              <div className="card__body">
                <h3 className="card__title">{typo(item.title)}</h3>
                <p className="card__text">{typo(item.text)}</p>
                {item.tags ? (
                  <ul className="tag-list">
                    {item.tags.map((tag) => (
                      <li key={tag} className="tag">
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
