import Link from 'next/link';
import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Откуда приходят брони»: четыре входа (площадки через менеджер каналов, сайт объекта, стойка, ИИ-продавец)
 * и карточка со ссылкой на калькулятор комиссии. Карточка ИИ-продавца ведёт на свой блок ниже.
 */
export function Sales() {
  const { sales } = getDictionary();
  return (
    <section id="sales" className="section section--band" aria-labelledby="sales-title">
      <div className="container">
        <SectionHeading id="sales-title" eyebrow={sales.eyebrow} title={sales.title} lead={sales.lead} />
        <ul className="card-grid card-grid--4">
          {sales.items.map((item) => (
            <li key={item.title} className="card glass">
              <span className="icon-tile">
                <Icon name={item.icon} />
              </span>
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
              {item.link ? (
                <a className="link-arrow" href="#ai-sellers">
                  {item.link}
                  <Icon name="arrowRight" size={16} />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="card card--row glass glass--quiet">
          <div>
            <h3 className="card__title">{typo(sales.calculator.title)}</h3>
            <p className="card__text">{typo(sales.calculator.text)}</p>
          </div>
          <Link className="btn btn--secondary" href="/calculator/">
            {sales.calculator.link}
            <Icon name="arrowRight" size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
