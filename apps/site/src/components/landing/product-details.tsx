import { siteConfig } from '../../site.config';
import { productDetails, sellerSteps } from '../../i18n/product-details';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';

export function ProductDetails() {
  return (
    <section
      id="product-details"
      className="section product-details"
      aria-labelledby="product-details-title"
    >
      <div className="container">
        <SectionHeading
          id="product-details-title"
          eyebrow="Подробнее о продукте"
          title="Что именно вы сможете делать"
          lead="От планирования смены до финансового отчёта: задачи вашей команды, доступные инструменты и результат каждого этапа."
        />
        <div className="product-details__grid">
          {productDetails.map((item, i) => (
            <article className="product-details__card" key={item.title}>
              <div className="product-details__top">
                <span className="icon-tile">
                  <Icon name={item.icon} />
                </span>
                <span className="product-details__index">0{i + 1}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <ul>
                {item.actions.map((action) => (
                  <li key={action}>
                    <Icon name="check" size={16} />
                    {action}
                  </li>
                ))}
              </ul>
              <p className="product-details__result">{item.result}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
export function SellerDetails() {
  return (
    <section
      id="ai-sellers"
      className="section seller-details"
      aria-labelledby="seller-details-title"
    >
      <div className="container">
        <SectionHeading
          id="seller-details-title"
          eyebrow="ИИ-продавцы WETOP"
          title="Ваш бизнес. Ваши знания. Ваш ИИ-продавец."
          lead="Создавайте агентов с понятной задачей: объяснить услуги, ответить на вопросы об объекте и помочь клиенту с выбором. Настройки и знания остаются под вашим контролем."
        />
        <div className="seller-details__layout">
          <ol className="seller-details__steps">
            {sellerSteps.map((step, i) => (
              <li key={step.title}>
                <span className="seller-details__number">0{i + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <aside className="seller-details__preview" aria-label="Пример подготовки ИИ-продавца">
            <div className="seller-details__preview-head">
              <strong>
                WETOP<span>.AI</span>
              </strong>
              <span>Пример настройки</span>
            </div>
            <h3>Что должен знать агент</h3>
            <dl>
              <div>
                <dt>Ваше предложение</dt>
                <dd>Категории размещения, услуги и условия</dd>
              </div>
              <div>
                <dt>Правила объекта</dt>
                <dd>Заезд, выезд, отмена и способы связи</dd>
              </div>
              <div>
                <dt>Стиль общения</dt>
                <dd>Язык, тон и подробность ответов</dd>
              </div>
              <div>
                <dt>Проверка перед запуском</dt>
                <dd>Тестовые вопросы и уточнение знаний</dd>
              </div>
            </dl>
            <p className="seller-details__note">
              Агент начинает работать после настройки модели и подключения канала. Ответы нужно
              проверить на данных вашего бизнеса.
            </p>
            <a
              className="btn btn--primary"
              href={`${siteConfig.appUrl.replace(/\/+$/, '')}/ai-seller/agents`}
            >
              Открыть ИИ-продавцов <Icon name="arrowRight" size={18} />
            </a>
            <p className="seller-details__sign-in">Для управления агентами нужен вход в аккаунт.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
