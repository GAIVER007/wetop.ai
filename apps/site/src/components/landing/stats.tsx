import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { typo } from '../typo';
import { ChessboardMockup } from '../chessboard-mockup';
import { SectionHeading } from '../section-heading';

/*
 * Полоса чисел под первым экраном. Числа — только те, что есть в продукте и названы на этой же странице
 * (словарь `stats`): каналы, способы оплаты, срезы шахматки и допуск сверки. Клиентов, лет и наград здесь нет.
 */
export function Stats() {
  const { stats } = getDictionary();
  return (
    <section className="section operations" aria-labelledby="operations-title">
      <div className="container">
        <SectionHeading
          id="operations-title"
          eyebrow={stats.eyebrow}
          title={stats.title}
          lead={stats.lead}
        />
        <div className="operations__grid">
          <div className="operations__summary glass">
            <div className="operations__stats">
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
            </div>
            <p className="demo-label">Демонстрационные данные интерфейса</p>
          </div>
          <div className="operations__board">
            <ChessboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
