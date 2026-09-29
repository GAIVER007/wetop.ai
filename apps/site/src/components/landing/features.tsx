'use client';
import { useState } from 'react';
import { moveTab } from './product-story';
const modules = [
  {
    name: 'Брони и гости',
    kicker: 'Всё для ежедневной работы',
    title: 'Встречайте гостей. Не переключайте таблицы.',
    text: 'Шахматка, бронирования и карточки гостей связаны между собой. От свободного места до истории проживания — понятный путь для администратора.',
    points: [
      'Номера и койки на одном экране',
      'Заезды, выезды и статусы бронирований',
      'Карточка гостя и история проживаний',
    ],
    screen: 'Рабочий день',
    rows: [
      ['Номер 12', 'Заезд сегодня'],
      ['Койка 05', 'Проживает'],
      ['Номер 14', 'Выезд сегодня'],
    ],
    foot: 'Откройте бронь, чтобы увидеть детали',
  },
  {
    name: 'Номерной фонд',
    kicker: 'Структура вашего объекта',
    title: 'Каждому месту — своё место в системе.',
    text: 'Создавайте категории, номера и койки. Проверяйте доступность на нужные даты и управляйте состоянием размещения.',
    points: [
      'Категории и вместимость',
      'Проверка доступности на весь срок',
      'Уборка и блокировки размещения',
    ],
    screen: 'Категории размещения',
    rows: [
      ['Стандарт', 'Отдельные номера'],
      ['Общая комната', 'Койко-места'],
      ['Состояние', 'Уборка и доступность'],
    ],
    foot: 'Фонд настраивается под ваш объект',
  },
  {
    name: 'Каналы и тарифы',
    kicker: 'Продажи под контролем',
    title: 'Видите, откуда приходит каждая бронь.',
    text: 'Тарифы и подключённые каналы — в рабочем пространстве объекта. Менеджер каналов помогает контролировать подключения и поступающие бронирования.',
    points: ['Тарифы по категориям', 'Каналы через Channex', 'Брони, отмены и суммы по источникам'],
    screen: 'Источники бронирований',
    rows: [
      ['Прямые продажи', 'Сайт и стойка'],
      ['Booking.com', 'Через Channex'],
      ['Другие OTA', 'После подключения'],
    ],
    foot: 'Набор каналов зависит от настроек подключения',
  },
  {
    name: 'Финансы',
    kicker: 'Понятно, за что и сколько',
    title: 'За каждой суммой — конкретное проживание.',
    text: 'Учитывайте начисления и оплаты в счёте гостя. Переходите от общей статистики к деталям, когда нужно разобраться в показателе.',
    points: [
      'Начисления и зарегистрированные оплаты',
      'Остаток по счёту проживания',
      'Статистика и отчёты объекта',
    ],
    screen: 'Счёт проживания',
    rows: [
      ['Проживание', 'Начисление'],
      ['Оплата гостя', 'Зарегистрирована'],
      ['Остаток', 'К оплате'],
    ],
    foot: 'Пример структуры счёта, не реальные суммы',
  },
  {
    name: 'ИИ-продавцы',
    kicker: 'Помощник с вашим характером',
    title: 'Научите агента говорить о вашем бизнесе.',
    text: 'Создайте своего ИИ-продавца: задайте информацию об объекте, добавьте знания, выберите стиль общения и проверьте ответы перед подключением.',
    points: [
      'Знания вашего бизнеса',
      'Настройка общения и тестовый диалог',
      'Подключение после проверки агента',
    ],
    screen: 'Ваш ИИ-продавец',
    rows: [
      ['Знания', 'Услуги, условия, правила'],
      ['Общение', 'Язык и стиль ответов'],
      ['Проверка', 'Тестовый диалог'],
    ],
    foot: 'Для запуска требуется настройка модели и канала',
  },
];
export function Features() {
  const [active, setActive] = useState(0);
  const item = modules[active]!;
  return (
    <section id="features" className="section explorer" aria-labelledby="features-title">
      <div className="container">
        <p className="eyebrow">02 / Возможности</p>
        <h2 id="features-title">
          Меньше рутины.
          <br />
          Больше управления.
        </h2>
        <p className="explorer__lead">Выберите задачу — посмотрите, как её решает WETOP.</p>
        <div className="explorer__tabs" role="tablist" aria-label="Возможности WETOP">
          {modules.map((m, i) => (
            <button
              key={m.name}
              id={`feature-tab-${i}`}
              role="tab"
              aria-controls={`feature-panel-${i}`}
              aria-selected={active === i}
              tabIndex={active === i ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => moveTab(e, i, modules.length, setActive)}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div
          key={active}
          className="explorer__panel"
          role="tabpanel"
          id={`feature-panel-${active}`}
          aria-labelledby={`feature-tab-${active}`}
          tabIndex={0}
        >
          <div className="explorer__copy">
            <p className="explorer__kicker">{item.kicker}</p>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <ul>
              {item.points.map((point) => (
                <li key={point}>
                  <span aria-hidden="true">↗</span>
                  {point}
                </li>
              ))}
            </ul>
            <a className="explorer__link" href="#start">
              Начать с вашего объекта <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className="explorer__screen">
            <div className="explorer__screen-head">
              <span>W / {item.screen}</span>
              <small>Пример интерфейса</small>
            </div>
            <div className="explorer__screen-body">
              <p className="explorer__screen-label">{item.name}</p>
              {item.rows.map(([label, value], i) => (
                <div className="explorer__row" key={label}>
                  <span className="explorer__number">0{i + 1}</span>
                  <strong>{label}</strong>
                  <span>{value}</span>
                </div>
              ))}
              <div className="explorer__screen-note">{item.foot}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
