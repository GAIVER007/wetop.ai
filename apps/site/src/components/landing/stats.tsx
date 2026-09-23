import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { typo } from '../typo';

/*
 * Полоса чисел под первым экраном. Числа — только те, что есть в продукте и названы на этой же странице
 * (словарь `stats`): каналы, способы оплаты, срезы шахматки и допуск сверки. Клиентов, лет и наград здесь нет.
 */
export function Stats() {
  const { stats } = getDictionary();
  return (
    <section className="stats" aria-label="Система в числах">
      <div className="container">
        <div className="stats__panel glass glass--quiet">
          {stats.items.map((item) => (
            <div key={item.label} className="stat">
              <span className="stat__icon">
                <Icon name={item.icon} size={20} />
              </span>
              <p className="stat__value">{item.value}</p>
              <p className="stat__label">{typo(item.label)}</p>
              <p className="stat__note">{typo(item.note)}</p>
            </div>
          ))}
          <blockquote className="stats__quote">
            <p>{typo(stats.quote)}</p>
            <cite>{stats.quoteSource}</cite>
          </blockquote>
        </div>
      </div>
    </section>
  );
}
