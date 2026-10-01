import { getDictionary } from '../../i18n';
import { siteConfig } from '../../site.config';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «ИИ-продавцы»: четыре шага настройки и панель «Что должен знать агент». Пример не выдаётся за работающего
 * агента: в тексте прямо сказано, что это отдельное расширение после настройки модели и канала (ADR-083, ADR-127).
 */
export function AiSellers() {
  const { ai } = getDictionary();
  const appUrl = siteConfig.appUrl.replace(/\/+$/, '');
  return (
    <section id="ai-sellers" className="section seller-details" aria-labelledby="ai-sellers-title">
      <div className="container">
        <SectionHeading id="ai-sellers-title" eyebrow={ai.eyebrow} title={ai.title} lead={ai.lead} />
        <div className="seller-details__layout">
          <ol className="seller-details__steps">
            {ai.steps.map((step, index) => (
              <li key={step.title}>
                <span className="seller-details__number" aria-hidden="true">
                  0{index + 1}
                </span>
                <div>
                  <h3>{typo(step.title)}</h3>
                  <p>{typo(step.text)}</p>
                </div>
              </li>
            ))}
          </ol>
          <aside className="seller-details__preview" aria-label={ai.preview.label}>
            <div className="seller-details__preview-head">
              <strong>
                WETOP<span>.AI</span>
              </strong>
              <span>{ai.preview.hint}</span>
            </div>
            <h3>{typo(ai.preview.title)}</h3>
            <dl>
              {ai.preview.items.map((item) => (
                <div key={item.term}>
                  <dt>{typo(item.term)}</dt>
                  <dd>{typo(item.text)}</dd>
                </div>
              ))}
            </dl>
            <p className="seller-details__note">{typo(ai.preview.note)}</p>
            <a className="btn btn--primary" href={`${appUrl}/ai-seller/agents`}>
              {ai.preview.open} <Icon name="arrowRight" size={18} />
            </a>
            <p className="seller-details__sign-in">{typo(ai.preview.signIn)}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
