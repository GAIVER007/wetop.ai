'use client';
import { useState, type KeyboardEvent } from 'react';

export function moveTab(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  count: number,
  select: (value: number) => void,
) {
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? count - 1
        : event.key === 'ArrowRight'
          ? (index + 1) % count
          : event.key === 'ArrowLeft'
            ? (index + count - 1) % count
            : null;
  if (next === null) return;
  event.preventDefault();
  select(next);
  const buttons =
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  buttons?.[next]?.focus();
}
const steps = [
  {
    label: 'Запрос',
    title: 'Каждое обращение — начало истории',
    text: 'Гость обращается напрямую или бронирует через подключённый канал. Команда видит источник и детали обращения.',
    result: 'Источник обращения',
    value: 'Сайт / Канал / Стойка',
    detail: 'Дальше — выбор дат и размещения',
  },
  {
    label: 'Бронь',
    title: 'Место и даты сразу в одной картине',
    text: 'Номер или койка появляются на шахматке. Администратор видит заезд, выезд и доступность на выбранный период.',
    result: 'Проживание',
    value: 'Номер 12 → 3 ночи',
    detail: 'Даты и статус в карточке брони',
  },
  {
    label: 'Гость',
    title: 'Человек, а не строка в таблице',
    text: 'Карточка гостя связывает контактные данные и историю проживаний. Не нужно искать одну и ту же информацию в разных списках.',
    result: 'Карточка гостя',
    value: 'Контакты + история',
    detail: 'Информация доступна по правам сотрудника',
  },
  {
    label: 'Оплата',
    title: 'Оплата связана с проживанием',
    text: 'Начисления и зарегистрированные оплаты находятся в счёте гостя. Видно, за что выставлена сумма и какой остаток нужно оплатить.',
    result: 'Счёт проживания',
    value: 'Начислено → оплачено',
    detail: 'Учёт оплат; подключение эквайринга — отдельная настройка',
  },
  {
    label: 'Отчёт',
    title: 'Из ежедневной работы — в понятные цифры',
    text: 'Загрузка, бронирования и финансовые показатели помогают оценить работу объекта. Подробности доступны в соответствующих разделах.',
    result: 'Результат работы',
    value: 'Загрузка / Продажи',
    detail: 'Показатели строятся на данных вашего объекта',
  },
];
export function Journey() {
  const [active, setActive] = useState(0);
  const item = steps[active]!;
  return (
    <section id="workflow" className="section journey" aria-labelledby="workflow-title">
      <div className="container">
        <p className="eyebrow">01 / Одна система</p>
        <h2 id="workflow-title">
          Не пять таблиц.
          <br />
          Одна история гостя.
        </h2>
        <p className="journey__lead">
          От первого обращения до отчёта. Посмотрите, как связаны этапы работы.
        </p>
        <div className="journey__tabs" role="tablist" aria-label="Путь брони">
          {steps.map((step, i) => (
            <button
              key={step.label}
              id={`journey-tab-${i}`}
              role="tab"
              aria-selected={i === active}
              aria-controls={`journey-panel-${i}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => moveTab(e, i, steps.length, setActive)}
            >
              <span aria-hidden="true">0{i + 1}</span>
              {step.label}
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <div
          key={active}
          className="journey__panel"
          id={`journey-panel-${active}`}
          role="tabpanel"
          aria-labelledby={`journey-tab-${active}`}
          tabIndex={0}
        >
          <div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </div>
          <div className="journey__result">
            <span>{item.result}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </div>
        </div>
      </div>
    </section>
  );
}
const questions = [
  [
    'Можно продавать номера и отдельные койки?',
    'Да. Номер и койко-место — отдельная единица размещения. Их можно объединять в категории и вести на одной шахматке.',
  ],
  [
    'Для какого бизнеса WETOP доступен сейчас?',
    'Текущее направление — Hospitality: хостелы, мини-отели и апарт-отели. Beauty — следующее направление, подключить его пока нельзя.',
  ],
  [
    'Что делает ИИ-продавец?',
    'Вы задаёте агенту информацию о бизнесе, знания и стиль общения, проверяете ответы и подключаете доступный канал. Для работы агента нужно завершить настройку модели и подключения.',
  ],
  [
    'Можно подключить каналы бронирования?',
    'Да, через встроенный менеджер каналов. Состав каналов, сопоставление категорий и готовность синхронизации проверяются при подключении вашего объекта.',
  ],
  [
    'Нужна ли установка на компьютер?',
    'Нет. Рабочее пространство открывается в браузере. Для команды настраиваются роли и права доступа.',
  ],
  [
    'Как начать и проверить систему?',
    'Создайте аккаунт, добавьте объект и настройте номерной фонд. Пробный период — 14 дней. Перенос данных и подключение каналов выполняются отдельно от регистрации.',
  ],
];
export function FAQ() {
  return (
    <section id="faq" className="section faq" aria-labelledby="faq-title">
      <div className="container faq__layout">
        <div>
          <p className="eyebrow">04 / Без недосказанности</p>
          <h2 id="faq-title">
            Хорошие вопросы.
            <br />
            Прямые ответы.
          </h2>
        </div>
        <div>
          {questions.map(([q, a]) => (
            <details key={q}>
              <summary>
                <span>{q}</span>
                <span aria-hidden="true">+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
