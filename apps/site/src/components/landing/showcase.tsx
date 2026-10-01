import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { ChessboardMockup } from '../chessboard-mockup';
import { typo } from '../typo';

export function Showcase() {
  const { showcase } = getDictionary();
  return (
    <section id="product" className="section section--tight" aria-labelledby="features">
      <div id="showcase" className="container">
        <div className="showcase__head">
          <p className="eyebrow">{showcase.eyebrow}</p>
          <a className="link-arrow" href="/#features">
            {showcase.all}
            <Icon name="arrowRight" size={18} />
          </a>
        </div>
        <h2 id="features" className="section-heading__title">
          {typo(showcase.title)}
        </h2>
        <ol className="product-tour">
          {showcase.items.map((item) => (
            <li key={item.title} className="product-tour__item">
              <div className="product-tour__copy">
                <span className="product-tour__number">{item.no}</span>
                <h3 className="showcase-card__title">{typo(item.title)}</h3>
                <p className="showcase-card__text">{typo(item.text)}</p>
                <ul className="tag-list">
                  {item.tags.map((tag) => (
                    <li key={tag} className="tag">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="product-tour__visual glass glass--strong">
                {item.screen === 'today' ? <TodayScreen /> : null}
                {item.screen === 'board' ? <ChessboardMockup /> : null}
                {item.screen === 'reservations' ? <ReservationsScreen /> : null}
                <span className="demo-label">Демонстрационные данные интерфейса</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function TodayScreen() {
  const items = [
    ['Заезды', '12', '4 ожидают'],
    ['Выезды', '8', 'до 12:00'],
    ['Проживают', '47', 'на объекте'],
    ['Свободно', '18', 'единиц'],
  ];
  return (
    <div className="today-screen" aria-hidden="true">
      <div className="ui-toolbar"><strong>Сегодня</strong><span>28 сентября</span></div>
      <div className="today-screen__metrics">
        {items.map(([label, value, note]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}
      </div>
      <div className="today-screen__timeline">
        <span>09:00</span><i /><b>Заезд · Номер 12</b><em>ожидается</em>
        <span>11:30</span><i /><b>Выезд · Апартамент 4</b><em>к оплате</em>
        <span>14:00</span><i /><b>Заезд · Койка 7</b><em>Booking.com</em>
      </div>
    </div>
  );
}

function ReservationsScreen() {
  const rows = [
    ['WT-1048', 'Демо-гость 01', '3–6 окт.', 'Booking.com', 'Подтверждена'],
    ['WT-1049', 'Демо-гость 02', '4–8 окт.', 'Сайт', 'Ожидает'],
    ['WT-1050', 'Демо-гость 03', '5–7 окт.', 'Стойка', 'Заселён'],
  ];
  return (
    <div className="reservations-screen" aria-hidden="true">
      <div className="ui-toolbar"><strong>Брони</strong><span>Все источники</span></div>
      <div className="reservation-table">
        <div className="reservation-table__head"><span>Бронь</span><span>Гость</span><span>Даты</span><span>Источник</span><span>Статус</span></div>
        {rows.map((row) => <div key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
      </div>
    </div>
  );
}
