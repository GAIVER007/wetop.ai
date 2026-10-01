import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { typo } from '../typo';

/*
 * Карта разделов на первом экране: окно продукта с шестью областями платформы, каждая ведёт ссылкой на блок
 * страницы. Это схема, а не снимок системы: без имён, сумм и процентов (план 01.10.2026, утверждённый владельцем).
 * Внизу состояние направлений: Hospitality работает, Beauty следующее (ADR-104).
 */
export function ProductMap() {
  const { map } = getDictionary().hero;
  return (
    <div className="product-map">
      <div className="product-map__head">
        <span className="product-map__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <strong className="product-map__title">
          WETOP<span> / {map.title}</span>
        </strong>
        <span className="product-map__hint">{map.hint}</span>
      </div>
      <ul className="product-map__grid" aria-label={map.label}>
        {map.items.map((item) => (
          <li key={item.title}>
            <a className="product-map__tile" href={item.href}>
              <Icon name={item.icon} size={20} />
              <strong>{typo(item.title)}</strong>
              <span>{typo(item.text)}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="product-map__foot">
        <span className="vertical-status vertical-status--live">
          <span className="vertical-status__dot" aria-hidden="true" />
          {map.live}
        </span>
        <span className="vertical-status">
          <span className="vertical-status__dot" aria-hidden="true" />
          {map.next}
        </span>
      </div>
    </div>
  );
}
