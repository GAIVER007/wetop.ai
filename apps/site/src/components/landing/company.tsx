import { getDictionary } from '../../i18n';
import { companyName, contactLinks } from '../../lib/site';
import { siteConfig } from '../../site.config';
import { typo } from '../typo';

/** «О компании» — только когда владелец вписал название в site.config.ts. */
export function Company() {
  const name = companyName();
  if (!name) return null;

  const t = getDictionary();
  const city = siteConfig.company.city.trim();
  const about = siteConfig.company.about.trim();
  const contacts = contactLinks();

  return (
    <section id="company" className="section section--band" aria-labelledby="company-title">
      <div className="container company">
        <div className="section-heading">
          <p className="eyebrow">{t.company.eyebrow}</p>
          <h2 id="company-title" className="section-heading__title">
            {name}
          </h2>
          {about ? <p className="section-heading__lead">{typo(about)}</p> : null}
        </div>
        {city || contacts.length > 0 ? (
          <dl className="company__facts">
            {city ? (
              <div>
                <dt>{t.company.city}</dt>
                <dd>{city}</dd>
              </div>
            ) : null}
            {contacts.map((contact) => (
              <div key={contact.href}>
                <dt>{contact.kind === 'email' ? t.company.email : t.company.phone}</dt>
                <dd>
                  <a href={contact.href}>{contact.label}</a>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
