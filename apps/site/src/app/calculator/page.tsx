import type { Metadata } from 'next';
import { CalculatorForm } from '../../components/calculator-form';
import { LandingFinal } from '../../components/landing/landing-final';
import { typo } from '../../components/typo';
import { getDictionary } from '../../i18n';
import { pageMetadata } from '../../lib/metadata';
import { registerLink } from '../../lib/site';

/*
 * Калькулятор «прямая бронь против OTA» (срез D3 плана прямых продаж, Q-235). Ставок по умолчанию нет: считает браузер
 * по цифрам человека. С 10.10.2026 поля и результат рядом (`.calc`, DESIGN.md §19.5), внизу общий финал сайта.
 */
export function generateMetadata(): Metadata {
  const t = getDictionary().calculator;
  return pageMetadata({ path: '/calculator/', title: t.metaTitle, description: t.description });
}

export default function CalculatorPage() {
  const t = getDictionary();
  const c = t.calculator;
  const register = registerLink(undefined, 'HOSPITALITY').href;
  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <p className="eyebrow">{c.badge}</p>
          <h1 className="page-header__title">{typo(c.title)}</h1>
          <p className="page-header__lead">{typo(c.lead)}</p>
        </header>
        <div className="card glass">
          <CalculatorForm t={c} />
        </div>
        <LandingFinal
          faq={{ title: c.faqTitle, items: c.faq }}
          cta={{
            title: t.segments.ctaTitle,
            text: c.ctaText,
            note: t.final.note,
            register: { href: register, label: t.nav.register },
            secondary: { href: '/for/hotels/', label: t.hotel.badge },
            photo: { src: '/photos/hotel.jpg', alt: '' },
          }}
        />
      </div>
    </div>
  );
}
