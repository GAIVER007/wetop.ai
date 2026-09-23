import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { Screen } from '../screen';
import { typo } from '../typo';

/*
 * Витрина ключевых экранов: три карточки с номером, мини-экраном и метками — как «case studies»
 * на снимках направления. Мини-экран нарисован на SVG (components/screen.tsx), снимков системы здесь нет:
 * на них видны данные объекта.
 */
export function Showcase() {
  const { showcase } = getDictionary();
  return (
    <section id="showcase" className="section section--tight" aria-labelledby="showcase-title">
      <div className="container">
        <div className="showcase__head">
          <p className="eyebrow">{showcase.eyebrow}</p>
          <a className="link-arrow" href="/#features">
            {showcase.all}
            <Icon name="arrowRight" size={18} />
          </a>
        </div>
        <h2 id="showcase-title" className="section-heading__title">
          {typo(showcase.title)}
        </h2>
        <ul className="showcase__grid">
          {showcase.items.map((item) => (
            <li key={item.title} className="showcase-card glass">
              <div className="screen">
                <span className="screen__no">{item.no}</span>
                <Screen kind={item.screen} />
              </div>
              <div className="showcase-card__body">
                <h3 className="showcase-card__title">{typo(item.title)}</h3>
                <p className="showcase-card__text">{typo(item.text)}</p>
                <ul className="tag-list">
                  {item.tags.map((tag) => (
                    <li key={tag} className="tag">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
