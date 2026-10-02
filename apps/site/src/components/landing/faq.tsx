import { getDictionary } from '../../i18n';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/** «Вопросы и ответы»: нативные details, работают без JavaScript; вопросы видны сразу, ответ раскрывается. */
export function FAQ() {
  const { faq } = getDictionary();
  return (
    <section id="faq" className="section section--band faq" aria-labelledby="faq-title">
      <div className="container faq__layout">
        <SectionHeading id="faq-title" eyebrow={faq.eyebrow} title={faq.title} />
        <div className="faq__list">
          {faq.items.map((item) => (
            <details key={item.q}>
              <summary>
                <span>{typo(item.q)}</span>
                <span aria-hidden="true">+</span>
              </summary>
              <p>{typo(item.a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
