import { getDictionary } from '../../i18n';
import { loginLink, registerLink } from '../../lib/site';
import { Icon } from '../icon';
import { ChessboardMockup } from '../chessboard-mockup';
import { typo } from '../typo';

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
                <span className="hero__title-line">{typo(t.hero.title)}</span>
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
                <a className="btn btn--secondary btn--lg" href="#product">
                  Посмотреть возможности
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
              <a className="hero__login" href={loginLink().href} data-auth="login">
                {t.nav.login}
              </a>
            </div>
            <div className="hero__visual" aria-label="Демонстрационный интерфейс WETOP">
              <div className="hero-dashboard glass glass--strong">
                <div className="hero-dashboard__topline">
                  <span>Сегодня</span>
                  <span>Демонстрационные данные</span>
                </div>
                <div className="hero-dashboard__metrics">
                  {t.stats.items.map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hero-dashboard__board">
                <ChessboardMockup />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
