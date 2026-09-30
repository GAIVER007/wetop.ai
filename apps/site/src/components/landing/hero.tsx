import { getDictionary } from '../../i18n';
import { loginLink, registerLink } from '../../lib/site';
import { Icon } from '../icon';
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
              <h1 id="hero-title" className="hero__title" aria-label={`WETOP — ${t.hero.title}`}>
                <span className="hero__brand" aria-hidden="true">WETOP</span>
                {' '}
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
            <PlatformCommandCenter />
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformCommandCenter() {
  const metrics = [
    ['Бизнесы', '3', 'в одной компании'],
    ['Филиалы', '8', 'единый обзор'],
    ['Клиенты', '124', 'сегодня'],
    ['Задачи', '6', 'требуют внимания'],
  ];
  return (
    <div className="hero__visual" aria-label="Визуальная модель центра управления WETOP">
      <div className="command-center glass glass--strong">
        <div className="command-center__topbar">
          <div>
            <span className="command-center__mark">W</span>
            <div><strong>Центр управления</strong><small>Визуальная модель платформы</small></div>
          </div>
          <span className="command-center__scope">Вся компания</span>
        </div>
        <div className="command-center__body">
          <aside className="command-center__rail" aria-hidden="true">
            <span className="is-active"><Icon name="grid" size={18} /></span>
            <span><Icon name="building" size={18} /></span>
            <span><Icon name="guest" size={18} /></span>
            <span><Icon name="receipt" size={18} /></span>
          </aside>
          <div className="command-center__workspace">
            <div className="command-center__heading">
              <div><small>Сегодня</small><strong>Бизнес под контролем</strong></div>
              <span>30 сентября</span>
            </div>
            <div className="command-center__metrics">
              {metrics.map(([label, value, note]) => (
                <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
              ))}
            </div>
            <div className="command-center__lower">
              <div className="command-center__verticals">
                <p>Направления бизнеса</p>
                <div><span className="command-center__vertical-icon"><Icon name="building" size={18} /></span><strong>Hospitality</strong><small>работает</small></div>
                <div><span className="command-center__vertical-icon"><Icon name="spark" size={18} /></span><strong>Beauty</strong><small>следующий vertical</small></div>
              </div>
              <div className="command-center__pulse">
                <p>Операционный ритм</p>
                <div className="command-center__bars" aria-hidden="true">
                  {[42, 68, 54, 84, 64, 92, 72].map((height, index) => (
                    <i key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <span>Продажи · команда · финансы</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="command-center__notice glass">
        <Icon name="shield" size={18} />
        <span><strong>Один вход</strong><small>Разные бизнесы и филиалы</small></span>
      </div>
    </div>
  );
}
