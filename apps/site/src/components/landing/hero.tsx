import { getDictionary } from '../../i18n';
import { registerLink } from '../../lib/site';
import { Icon } from '../icon';
import { OperationsMockup } from '../operations-mockup';
import { typo } from '../typo';

/*
 * Первый экран (29.09.2026, вечер; владелец: «сделай лучше, профессиональней, понятней»). Главная мысль — сам
 * заголовок, его вторая половина металлом (приём ADR-070); одна плашка «регистрация открыта», без дубля
 * слова-знака и круглой печати. Справа — общий операционный экран с боковым меню разделов: по нему сразу видно,
 * что внутри (ADR-104). Портрета человека здесь нет намеренно: показываем экран продукта, а не лицо.
 */
export function Hero() {
  const t = getDictionary();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container">
        <div className="hero__panel glass">
          <div className="hero__inner">
            <div className="hero__copy">
              <p className="hero__status">
                <span className="hero__status-dot" aria-hidden="true" />
                {t.hero.status}
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
                <a className="btn btn--secondary btn--lg" href="#features">
                  Смотреть возможности <Icon name="arrowRight" size={18} />
                </a>
              </div>
              <p className="hero__note">{typo(t.hero.note)}</p>
              <ul className="hero__points">
                {t.hero.points.map((point) => (
                  <li key={point.text}>
                    <span className="hero__point-icon">
                      <Icon name={point.icon} size={16} />
                    </span>
                    <span>{typo(point.text)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="hero__visual">
              <p className="hero__preview-label">
                WETOP / Рабочее пространство <span>Пример интерфейса</span>
              </p>
              <OperationsMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
