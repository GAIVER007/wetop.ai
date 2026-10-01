import { Icon } from '../icon';

/** Brand information does not depend on unpublished legal entity details. */
export function About() {
  return (
    <section id="about" className="section brand-about" aria-labelledby="about-title">
      <div className="container">
        <p className="eyebrow">О WETOP</p>
        <div className="brand-about__intro">
          <h2 id="about-title">
            Создаём пространство
            <br />
            для работы, а не рутины.
          </h2>
          <div>
            <p>
              WETOP — платформа управления сервисным бизнесом. Мы соединяем ежедневные операции,
              продажи и работу команды, чтобы информация не терялась между людьми и инструментами.
            </p>
            <p>
              Начинаем с Hospitality: хостелов, мини-отелей и апарт-отелей. Здесь WETOP связывает
              размещение, гостей, оплаты и отчёты в одном рабочем пространстве.
            </p>
          </div>
        </div>
        <dl className="brand-about__principles">
          <div>
            <dt>Контекст вместо переключений</dt>
            <dd>
              От брони — к гостю, размещению и счёту. Связанные данные помогают видеть всю историю.
            </dd>
          </div>
          <div>
            <dt>Понятные действия</dt>
            <dd>
              Рабочие экраны вокруг задач: кого встретить, где разместить, какую оплату проверить.
            </dd>
          </div>
          <div>
            <dt>Контроль за командой</dt>
            <dd>Доступ по ролям и журнал действий помогают разбираться в изменениях.</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function Control() {
  const items = [
    {
      icon: 'shield' as const,
      title: 'Роли и доступ',
      text: 'Приглашайте сотрудников с отдельными учётными записями. Доступ к разделам и действиям определяется назначенной ролью.',
    },
    {
      icon: 'article' as const,
      title: 'История действий',
      text: 'Проверяйте записи журнала, когда нужно понять, кто и когда внёс изменение. Разбирайте рабочие вопросы на основании событий.',
    },
    {
      icon: 'globe' as const,
      title: 'Работа в браузере',
      text: 'Открывайте рабочее пространство без установки приложения. Для работы с актуальными данными требуется интернет.',
    },
  ];
  return (
    <section id="control" className="section team-control" aria-labelledby="control-title">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Команда и ответственность</p>
          <h2 id="control-title" className="section-heading__title">
            Каждый знает свою задачу.
            <br />
            Вы видите общую картину.
          </h2>
        </div>
        <div className="team-control__grid">
          {items.map((item) => (
            <article key={item.title}>
              <Icon name={item.icon} size={28} />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
