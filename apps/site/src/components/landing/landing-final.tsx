import { Icon } from '../icon';
import { JsonLd, faqLd } from '../json-ld';
import { typo } from '../typo';

type Faq = { title: string; items: Array<{ q: string; a: string }> };
type Cta = {
  title: string;
  text: string;
  /** Подпись под кнопками: без срока и условий пробного доступа (ADR-147). */
  note: string;
  register: { href: string; label: string };
  secondary?: { href: string; label: string } | undefined;
  /** Необязательное фото справа: своя картинка страницы (KIE), без людей и текста. */
  photo?: { src: string; alt: string } | undefined;
  contacts?: string | undefined;
};

/*
 * Единый финал всех страниц сайта (поручение владельца 10.10.2026: «частые вопросы и подвал с
 * призывом в едином стиле, со своей информацией»): вопросы одной колонкой по центру, ниже плита
 * призыва с подписью без условий trial (ADR-147). Классы `.faq` и `.cta` переиспользуются,
 * чтобы их правила и спеки продолжали действовать.
 */
export function LandingFinal({
  faq,
  cta,
  id,
  sectionId,
}: {
  faq: Faq;
  cta: Cta;
  id?: string | undefined;
  sectionId?: string | undefined;
}) {
  return (
    <section id={sectionId} className="landing-final section" aria-labelledby="landing-faq-title">
      {faq.items.length > 0 ? <JsonLd data={faqLd(faq.items)} /> : null}
      <div className="container">
        <div className="landing-final__faq faq">
          <div className="section-heading section-heading--center">
            <h2 id="landing-faq-title" className="section-heading__title">
              {typo(faq.title)}
            </h2>
          </div>
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

        <div id={id} className="cta glass glass--strong landing-final__cta">
          <div className="cta__copy">
            <h2 className="cta__title">{typo(cta.title)}</h2>
            <p className="cta__text">{typo(cta.text)}</p>
            <div className="cta__actions">
              <a className="btn btn--primary btn--lg" href={cta.register.href} data-auth="register">
                {cta.register.label}
                <Icon name="arrowRight" size={18} />
              </a>
              {cta.secondary ? (
                <a className="btn btn--secondary btn--lg" href={cta.secondary.href}>
                  {cta.secondary.label}
                </a>
              ) : null}
            </div>
            <p className="landing-final__note">
              <Icon name="check" size={15} />
              {cta.note}
            </p>
            {cta.contacts ? <p className="landing-final__contacts">{cta.contacts}</p> : null}
          </div>
          {cta.photo ? (
            <span className="landing-final__photo">
              <img src={cta.photo.src} alt={cta.photo.alt} loading="lazy" width={592} height={432} />
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
