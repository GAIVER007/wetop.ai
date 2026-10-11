import { getDictionary } from '../../i18n';
import { contactLinks, registerLink, siteUrl } from '../../lib/site';
import { LandingFinal } from './landing-final';

/* Финал главной: единый блок вопросов и призыва (10.10.2026); контакты строкой из site.config.ts. */
export function FAQ() {
  const t = getDictionary();
  const email = contactLinks().find((contact) => contact.kind === 'email');
  const host = new URL(siteUrl()).host;
  return (
    <LandingFinal
      sectionId="faq"
      id="get-started"
      faq={{ title: t.faq.title, items: t.faq.items }}
      cta={{
        title: t.final.title,
        text: t.final.text,
        note: t.final.note,
        register: { href: registerLink().href, label: t.hero.primary },
        secondary: email ? { href: email.href, label: t.final.contact } : undefined,
        photo: { src: '/photos/building.jpg', alt: '' },
        contacts: email ? `${t.final.contactsLabel} ${email.label}  ${host}` : undefined,
      }}
    />
  );
}
