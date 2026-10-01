import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';

export function Toolkit() {
  return (
    <section id="toolkit" className="section sales-paths" aria-labelledby="toolkit-title">
      <div className="container">
        <SectionHeading
          id="toolkit-title"
          eyebrow="Продажи и подключения"
          title="Разные пути к гостю. Один рабочий контекст."
          lead="Прямое обращение и бронь с площадки требуют разных настроек. WETOP помогает собрать их вокруг вашего объекта."
        />
        <div className="sales-paths__grid">
          <article>
            <Icon name="site" size={28} />
            <h3>Собственный сайт</h3>
            <p>
              Представьте размещение и условия объекта. Прямое бронирование подключается и
              проверяется отдельно для вашего сайта.
            </p>
            <a href="#start">
              Начать с объекта <Icon name="arrowRight" size={16} />
            </a>
          </article>
          <article>
            <Icon name="channels" size={28} />
            <h3>Площадки бронирования</h3>
            <p>
              Работайте с OTA через менеджер каналов. Сопоставьте категории и тарифы, проверьте
              поступление броней и обмен доступностью.
            </p>
            <p className="sales-paths__note">
              Состав площадок зависит от подключения. Регистрация не включает синхронизацию
              автоматически.
            </p>
          </article>
          <article>
            <Icon name="spark" size={28} />
            <h3>ИИ-продавец</h3>
            <p>
              Подготовьте агента, который объяснит предложение и условия вашего бизнеса. Сначала
              знания и тестовый диалог, затем подключение.
            </p>
            <a href="#ai-sellers">
              Как устроен агент <Icon name="arrowRight" size={16} />
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
