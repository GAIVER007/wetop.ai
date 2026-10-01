import { getDictionary } from '../../i18n';
import { contactLinks, loginLink, registerLink } from '../../lib/site';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

export function CoreTasks() {
  const { core } = getDictionary().product;
  return (
    <section id="product" className="section" aria-labelledby="core-title">
      <div className="container">
        <SectionHeading
          id="core-title"
          eyebrow={core.eyebrow}
          title={core.title}
          lead={core.lead}
        />
        <ul className="core-grid">
          {core.items.map((item) => (
            <li key={item.title} className="core-card">
              <span className="icon-tile">
                <Icon name={item.icon} />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{typo(item.text)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function SalesEcosystem() {
  const section = getDictionary().product.integrations;
  const direct = getDictionary().product.direct;
  return (
    <section
      id="integrations"
      className="section split-section"
      aria-labelledby="integrations-title"
    >
      <div className="container sales-panel glass glass--strong">
        <div className="sales-panel__copy">
          <SectionHeading
            id="integrations-title"
            eyebrow={section.eyebrow}
            title={section.title}
            lead={section.lead}
          />
          <p className="section-note">
            <Icon name="shield" size={18} />
            {typo(section.note)}
          </p>
          <div className="sales-panel__direct">
            <span className="icon-tile"><Icon name="site" /></span>
            <div>
              <h3>{direct.title}</h3>
              <p>{typo(direct.lead)}</p>
              <ul className="mini-list">{direct.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
        </div>
        <div className="sales-panel__channels">
          <p className="sales-panel__label">Каналы онлайн-продаж</p>
          <ul className="integration-grid">
          {section.items.map((item) => (
            <li key={item.name}>
              <span>{item.mark}</span>
              <strong>{item.name}</strong>
            </li>
          ))}
          </ul>
          <p className="feature-band__note">{typo(direct.note)}</p>
        </div>
      </div>
    </section>
  );
}

export function DirectBooking() {
  const section = getDictionary().product.direct;
  return (
    <section className="section" aria-labelledby="direct-title">
      <div className="container feature-band glass">
        <div>
          <p className="eyebrow">{section.eyebrow}</p>
          <h2 id="direct-title">{section.title}</h2>
          <p>{typo(section.lead)}</p>
        </div>
        <div>
          <ul className="check-list">
            {section.items.map((item) => (
              <li key={item}>
                <Icon name="check" size={18} />
                {item}
              </li>
            ))}
          </ul>
          <p className="feature-band__note">{typo(section.note)}</p>
        </div>
      </div>
    </section>
  );
}

export function AiSeller() {
  const section = getDictionary().product.ai;
  return (
    <section className="section ai-section" aria-labelledby="ai-title">
      <div className="container ai-section__panel">
        <div className="ai-chat" aria-label="Пример диалога с AI-продавцом">
          <p className="ai-chat__label">{section.guest}</p>
          <p className="ai-chat__bubble">{section.guestText}</p>
          <p className="ai-chat__label ai-chat__label--ai">
            <Icon name="spark" size={16} />
            {section.answer}
          </p>
          <p className="ai-chat__bubble ai-chat__bubble--ai">{section.answerText}</p>
        </div>
        <div>
          <SectionHeading
            id="ai-title"
            eyebrow={section.eyebrow}
            title={section.title}
            lead={section.lead}
          />
          <ul className="mini-list">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="section-note">
            <Icon name="shield" size={18} />
            {section.note}
          </p>
        </div>
      </div>
    </section>
  );
}

export function Finance() {
  const section = getDictionary().product.finance;
  return (
    <section className="section" aria-labelledby="finance-title">
      <div className="container finance-panel glass glass--strong">
        <SectionHeading
          id="finance-title"
          eyebrow={section.eyebrow}
          title={section.title}
          lead={section.lead}
        />
        <div>
          <ul className="metric-grid">
            {section.metrics.map((metric) => (
              <li key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </li>
            ))}
          </ul>
          <p className="demo-label">{section.example}</p>
        </div>
      </div>
    </section>
  );
}

export function WhyWetop() {
  const section = getDictionary().product.why;
  return (
    <section className="section" aria-labelledby="why-title">
      <div className="container">
        <SectionHeading id="why-title" eyebrow={section.eyebrow} title={section.title} />
        <ul className="why-grid">
          {section.items.map((item) => (
            <li key={item.title}>
              <Icon name={item.icon} />
              <div>
                <h3>{item.title}</h3>
                <p>{typo(item.text)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Launch() {
  const t = getDictionary();
  const section = t.product.migration;
  return (
    <section id="start" className="section" aria-labelledby="migration-title">
      <div className="container launch-panel glass">
        <div className="launch-panel__intro">
          <div>
            <p className="eyebrow">{section.eyebrow}</p>
            <h2 id="migration-title">{section.title}</h2>
            <p>{typo(section.lead)}</p>
          </div>
          <div className="migration-panel__proof">
            <Icon name="migrate" />
            <strong>{section.proof}</strong>
            <p>{section.note}</p>
          </div>
        </div>
        <ol className="launch-steps">
          {t.start.steps.slice(0, 4).map((step, index) => (
            <li key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{step.title}</h3><p>{typo(step.text)}</p></div>
            </li>
          ))}
        </ol>
        <div className="launch-panel__action">
          <p>{typo(t.start.ctaText)}</p>
          <a className="btn btn--primary btn--lg" href={registerLink().href} data-auth="register">
            {t.nav.register}<Icon name="arrowRight" size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  const section = getDictionary().product.pricing;
  return (
    <section id="pricing" className="section" aria-labelledby="pricing-title">
      <div className="container pricing-wrap">
        <SectionHeading id="pricing-title" eyebrow={section.eyebrow} title={section.title} />
        <div className="pricing-card glass glass--strong">
          <div className="pricing-card__main">
            <p className="pricing-card__plan">{section.plan}</p>
            <p className="pricing-card__price">
              {section.price}
              <span>{section.period}</span>
            </p>
            <p>{section.scope}</p>
          </div>
          <ul className="check-list">
            {section.items.map((item) => (
              <li key={item}>
                <Icon name="check" size={18} />
                {item}
              </li>
            ))}
          </ul>
          <div className="pricing-card__action">
            <p>{section.overage}</p>
            <p className="pricing-card__trial">{section.trial}</p>
            <a className="btn btn--primary btn--lg" href={registerLink().href} data-auth="register">
              {getDictionary().nav.register}
              <Icon name="arrowRight" size={18} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const section = getDictionary().product.final;
  const contact = contactLinks()[0];
  return (
    <section className="section final-cta" aria-labelledby="final-title">
      <div className="container">
        <div className="final-cta__panel glass glass--strong">
          <p className="eyebrow">{section.eyebrow}</p>
          <h2 id="final-title">{section.title}</h2>
          <p>{typo(section.lead)}</p>
          <div className="final-cta__actions">
            <a className="btn btn--primary btn--lg" href={registerLink().href} data-auth="register">
              {getDictionary().nav.register}
              <Icon name="arrowRight" size={18} />
            </a>
            {contact ? (
              <a className="btn btn--secondary btn--lg" href={contact.href}>
                {section.contact}
              </a>
            ) : null}
            <a className="text-link" href={loginLink().href} data-auth="login">
              {getDictionary().nav.login}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
