import { getDictionary } from '../../i18n';
import { registerLink } from '../../lib/site';
import { Icon } from '../icon';
import { typo } from '../typo';
import { ProductMap } from './product-map';

/*
 * Первый экран: что это и для кого. Слева заголовок (позиционирование ADR-104), лид и две кнопки;
 * справа карта разделов (`product-map.tsx`): шесть областей платформы ссылками на блоки страницы.
 * Имён, сумм и процентов здесь нет (plans/site-home-clear-blocks-2026-10-01.md).
 * Факты «что это даёт» с 02.10.2026 стоят полосой ниже (`facts.tsx`): семь уровней в одной колонке не читались.
 */
export function Hero() {
  const t = getDictionary();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container">
        <div className="hero__panel glass glass--strong">
          <div className="hero__inner">
            <div className="hero__copy">
              <p className="hero__status">
                <span className="hero__status-dot" aria-hidden="true" />
                {t.hero.status}
              </p>
              <p className="hero__brand">
                WETOP<span>.AI</span>
              </p>
              <h1 id="hero-title" className="hero__title">
                {typo(t.hero.title)}{' '}
                <span className="hero__accent">{typo(t.hero.titleAccent)}</span>
              </h1>
              <p className="hero__lead">{typo(t.hero.lead)}</p>
              <div className="hero__actions">
                <a
                  className="btn btn--primary btn--lg"
                  href={registerLink().href}
                  data-auth="register"
                >
                  {t.nav.register}
                  <Icon name="arrowRight" size={18} />
                </a>
                <a className="btn btn--secondary" href="#features">
                  {t.hero.secondary}
                  <Icon name="arrowDown" size={18} />
                </a>
              </div>
              <p className="hero__note">{typo(t.hero.note)}</p>
            </div>
            <div className="hero__visual">
              <ProductMap />
              <p className="hero__preview-label">{typo(t.hero.map.caption)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
