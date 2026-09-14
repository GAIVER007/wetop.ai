import { getDictionary } from '../../i18n';
import { loginLink, trialLink } from '../../lib/site';
import { ChessboardMockup } from '../chessboard-mockup';
import { Icon } from '../icon';
import { typo } from '../typo';

export function Hero() {
  const t = getDictionary();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero__inner">
        <div className="hero__copy">
          <p className="hero__badge">
            <span className="hero__badge-dot" aria-hidden="true" />
            <span>{typo(t.hero.badge)}</span>
          </p>
          <h1 id="hero-title" className="hero__title">
            {typo(t.hero.title)}
          </h1>
          <p className="hero__lead">{typo(t.hero.lead)}</p>
          <div className="hero__actions">
            <a className="btn btn--primary btn--lg" href={trialLink().href}>
              {t.nav.trial}
              <Icon name="arrowRight" size={18} />
            </a>
            <a className="btn btn--secondary btn--lg" href={loginLink().href}>
              {t.nav.login}
            </a>
          </div>
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
          <ChessboardMockup />
        </div>
      </div>
    </section>
  );
}
