import { getDictionary } from '../../i18n';
import { registerLink } from '../../lib/site';
import { Icon } from '../icon';
import { typo } from '../typo';

export function Hero() {
  const t = getDictionary();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero__inner">
        <div className="hero__copy">
          <p className="hero__status">
            <span className="hero__status-dot" aria-hidden="true" />
            {t.hero.status}
          </p>
          <p className="hero__brand">
            WETOP<span>.AI</span>
          </p>
          <h1 id="hero-title" className="hero__title">
            {typo(t.hero.title)} <span className="hero__accent">{typo(t.hero.titleAccent)}</span>
          </h1>
          <p className="hero__lead">{typo(t.hero.lead)}</p>
          <div className="hero__actions">
            <a className="btn btn--primary btn--lg" href={registerLink().href} data-auth="register">
              {t.nav.register}
              <Icon name="arrowRight" size={18} />
            </a>
            <a className="btn btn--secondary btn--lg" href="#features">
              Смотреть возможности
              <Icon name="arrowDown" size={18} />
            </a>
          </div>
          <p className="hero__note">{typo(t.hero.note)}</p>
        </div>
        <div className="hero__visual">
          <div
            className="workspace-preview"
            role="img"
            aria-label="Схема рабочего пространства WETOP: ежедневные задачи, бронирования, гости, оплаты и отчёты. Иллюстрация возможностей, не реальные данные."
          >
            <div className="workspace-preview__head">
              <strong>
                W<span> / Рабочее пространство</span>
              </strong>
              <span>Обзор продукта</span>
            </div>
            <div className="workspace-preview__body">
              <p className="eyebrow">Ваша команда. Один контекст.</p>
              <h2>
                Всё начинается
                <br />с рабочего дня
              </h2>
              <div className="workspace-preview__flow">
                <div>
                  <Icon name="grid" />
                  <strong>Размещение</strong>
                  <span>Брони и доступность</span>
                </div>
                <div>
                  <Icon name="guest" />
                  <strong>Гости</strong>
                  <span>Контакты и история</span>
                </div>
                <div>
                  <Icon name="receipt" />
                  <strong>Оплаты</strong>
                  <span>Начисления и остатки</span>
                </div>
              </div>
              <div className="workspace-preview__activity">
                <p>
                  <Icon name="check" size={18} />
                  <span>Проверьте заезды и выезды</span>
                  <span>Смена</span>
                </p>
                <p>
                  <Icon name="check" size={18} />
                  <span>Откройте детали бронирования</span>
                  <span>Контекст</span>
                </p>
                <p>
                  <Icon name="check" size={18} />
                  <span>Посмотрите результаты объекта</span>
                  <span>Отчёты</span>
                </p>
              </div>
            </div>
            <div className="workspace-preview__foot">
              <Icon name="shield" size={16} />
              Доступ по ролям<span>Hospitality</span>
            </div>
          </div>
          <p className="hero__preview-label">
            Иллюстрация возможностей. Не данные действующего объекта.
          </p>
        </div>
      </div>
      <div className="container">
        <ul className="hero__capabilities">
          <li>Операции</li>
          <li>Продажи</li>
          <li>Команда</li>
          <li>Финансы</li>
          <li>Аналитика</li>
          <li>ИИ-продавцы</li>
        </ul>
      </div>
    </section>
  );
}
