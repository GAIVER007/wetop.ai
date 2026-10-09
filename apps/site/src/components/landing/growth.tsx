import Link from 'next/link';
import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Продажи и ИИ» (LAND2, ТЗ §7): одна секция вместо прежних трёх (Sales, AiSellers, Market).
 * Три модуля роста со статусом словами, по фактической готовности, слова «пилот» на странице нет
 * (решение владельца 09.10.2026). Якоря #ai-sellers и #market остаются на модулях для старых ссылок.
 */
export function Growth() {
  const { growth } = getDictionary();
  return (
    <section id="sales" className="section section--band growth" aria-labelledby="growth-title">
      <div className="container">
        <SectionHeading
          id="growth-title"
          eyebrow={growth.eyebrow}
          title={growth.title}
          lead={growth.lead}
        />
        <ul className="card-grid card-grid--3 growth__modules">
          {growth.modules.map((module) => (
            <li key={module.id} id={module.id === 'marketing' ? undefined : module.id} className="card glass">
              <div className="growth__head">
                <span className="icon-tile">
                  <Icon name={module.icon} />
                </span>
                <span className="growth__status">{module.status}</span>
              </div>
              <h3 className="card__title">{typo(module.title)}</h3>
              <p className="card__text">{typo(module.text)}</p>
              <ul className="growth__points">
                {module.points.map((point) => (
                  <li key={point}>
                    <Icon name="check" size={16} />
                    {point}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="growth__note">{typo(growth.note)}</p>

        <div className="growth__sources glass glass--quiet">
          <div className="growth__sources-heading">
            <h3 className="card__title">{typo(growth.sources.title)}</h3>
            <p className="card__text">{typo(growth.sources.lead)}</p>
          </div>
          <ul className="growth__sources-grid">
            {growth.sources.items.map((item) => (
              <li key={item.title}>
                <Icon name={item.icon} size={20} />
                <div>
                  <strong>{typo(item.title)}</strong>
                  <span>{typo(item.text)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card card--row glass glass--quiet">
          <div>
            <h3 className="card__title">{typo(growth.calculator.title)}</h3>
            <p className="card__text">{typo(growth.calculator.text)}</p>
          </div>
          <Link className="btn btn--secondary" href="/calculator/">
            {growth.calculator.link}
            <Icon name="arrowRight" size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
