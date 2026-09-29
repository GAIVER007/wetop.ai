import { getDictionary } from '../../i18n';
import { loginLink, registerLink } from '../../lib/site';
import { Icon } from '../icon';
import { OperationsMockup } from '../operations-mockup';
import { typo } from '../typo';

/*
 * Первый экран: стеклянная панель, слева слово-знак металлом и текст, справа — общий операционный экран «Сегодня».
 * С 29.09.2026 первый экран говорит о платформе для сервисного бизнеса (ADR-104): шахматка и каналы — ниже,
 * в разделе Hospitality. Портрета человека здесь нет намеренно: показываем экран продукта, а не лицо.
 */
export function Hero() {
  const t = getDictionary();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container">
        <div className="hero__panel glass">
          <div className="hero__inner">
            <div className="hero__copy">
              <p className="hero__badge">
                <span className="hero__badge-dot" aria-hidden="true" />
                <span>{typo(t.hero.badge)}</span>
              </p>
              <h1 id="hero-title" className="hero__title">
                <span className="hero__word">{t.hero.word}</span>
                <span className="hero__title-line">{typo(t.hero.title)}</span>
              </h1>
              <p className="hero__lead">{typo(t.hero.lead)}</p>
              <div className="hero__actions">
                <a className="btn btn--primary btn--lg" href={registerLink().href} data-auth="register">
                  {t.nav.register}
                  <Icon name="arrowRight" size={18} />
                </a>
                <a className="btn btn--secondary btn--lg" href={loginLink().href} data-auth="login">
                  {t.nav.login}
                </a>
              </div>
              <p className="hero__note">{typo(t.hero.note)}</p>
              <ul className="hero__points">
                {t.hero.points.map((point) => (
                  <li key={point}>
                    <Icon name="check" size={18} />
                    <span>{typo(point)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="hero__visual">
              <p className="hero__available">
                <span className="hero__available-dot" aria-hidden="true" />
                <span>{t.hero.available}</span>
              </p>
              <OperationsMockup />
              <HeroSeal text={t.hero.seal} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * Круглый знак с надписью по кругу. `textLength` растягивает строку ровно на длину окружности (2πr при r=40),
 * поэтому надпись замыкается сама, какой бы длины ни была в словаре. Знак декоративный — скрыт от скринридера.
 */
function HeroSeal({ text }: { text: string }) {
  return (
    <span className="hero__seal" aria-hidden="true">
      <svg className="hero__seal-ring" viewBox="0 0 112 112" focusable="false">
        <defs>
          <path id="hero-seal-path" d="M56 16a40 40 0 1 1 0 80 40 40 0 1 1 0-80" fill="none" />
        </defs>
        <text>
          <textPath href="#hero-seal-path" textLength="251" lengthAdjust="spacing">
            {`${text} ✦`}
          </textPath>
        </text>
      </svg>
      <svg
        className="hero__seal-star"
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        focusable="false"
      >
        <path d="M12 3.5c.9 4.2 2.3 5.6 6.5 6.5-4.2.9-5.6 2.3-6.5 6.5-.9-4.2-2.3-5.6-6.5-6.5 4.2-.9 5.6-2.3 6.5-6.5Z" />
      </svg>
    </span>
  );
}
