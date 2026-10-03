import { getDictionary } from '../../i18n';
import { siteConfig } from '../../site.config';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Загрузка конкурентов» (ADR-141), фишка №1: четыре пункта и пример одной ночи. Раскладка блока «ИИ-продавцы»
 * (`.seller-details`): пункты слева, панель примера справа. Пример помечен примером, сбор ИИ-агентом назван
 * готовящимся: на главной только то, что уже работает.
 */
export function Market() {
  const { market } = getDictionary();
  const appUrl = siteConfig.appUrl.replace(/\/+$/, '');
  return (
    <section id="market" className="section section--band seller-details" aria-labelledby="market-title">
      <div className="container">
        <SectionHeading id="market-title" eyebrow={market.eyebrow} title={market.title} lead={market.lead} />
        <div className="seller-details__layout">
          <ol className="seller-details__steps">
            {market.points.map((point, index) => (
              <li key={point.title}>
                <span className="seller-details__number" aria-hidden="true">
                  0{index + 1}
                </span>
                <div>
                  <h3>{typo(point.title)}</h3>
                  <p>{typo(point.text)}</p>
                </div>
              </li>
            ))}
          </ol>
          <aside className="seller-details__preview" aria-label={market.preview.label}>
            <div className="seller-details__preview-head">
              <strong>
                WETOP<span>.AI</span>
              </strong>
              <span>{market.preview.hint}</span>
            </div>
            <h3>{typo(market.preview.title)}</h3>
            <dl>
              {market.preview.items.map((item) => (
                <div key={item.term}>
                  <dt>{typo(item.term)}</dt>
                  <dd>{item.text}</dd>
                </div>
              ))}
            </dl>
            <p className="seller-details__note">{typo(market.preview.note)}</p>
            <a className="btn btn--primary" href={`${appUrl}/market`}>
              {market.preview.open} <Icon name="arrowRight" size={18} />
            </a>
            <p className="seller-details__sign-in">{typo(market.preview.signIn)}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
