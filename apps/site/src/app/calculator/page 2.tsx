import type { Metadata } from 'next';
import Link from 'next/link';
import { CalculatorForm } from '../../components/calculator-form';
import { Icon } from '../../components/icon';
import { typo } from '../../components/typo';
import { getDictionary } from '../../i18n';
import { pageMetadata } from '../../lib/metadata';
import { registerLink } from '../../lib/site';

/*
 * Калькулятор «прямая бронь против OTA» (срез D3 плана прямых продаж, Q-235). Ставок по умолчанию нет: считает браузер
 * по цифрам человека. Страница собрана из блоков главной и одного нового, `.calc` (DESIGN.md §19.5).
 */
export function generateMetadata(): Metadata {
  const t = getDictionary().calculator;
  return pageMetadata({ path: '/calculator/', title: t.metaTitle, description: t.description });
}

export default function CalculatorPage() {
  const t = getDictionary();
  const c = t.calculator;
  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <p className="eyebrow">{t.segments.eyebrow}</p>
          <h1 className="page-header__title">{typo(c.title)}</h1>
          <p className="page-header__lead">{typo(c.lead)}</p>
        </header>
        <div className="card glass">
          <CalculatorForm t={c} />
        </div>
        <div className="cta glass glass--strong">
          <div className="cta__copy">
            <p className="cta__text">{typo(c.ctaText)}</p>
            <div className="cta__actions">
              <a className="btn btn--primary btn--lg" href={registerLink().href} data-auth="register">
                {t.nav.register}
                <Icon name="arrowRight" size={18} />
              </a>
              <Link className="link-arrow" href="/">
                {t.segments.home}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
