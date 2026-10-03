import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { typo } from '../typo';

/*
 * Полоса фактов под первым экраном (02.10.2026): четыре коротких ответа на вопрос «что это даёт».
 * Раньше три таких факта висели под чертой на самом первом экране и добавляли ему седьмой уровень;
 * здесь они читаются одним взглядом и разделяют первый экран и «Направления».
 * Обещаний, цифр клиентов и процентов тут нет (DESIGN.md §19.9).
 */
export function Facts() {
  const { facts } = getDictionary();
  return (
    <section className="section section--tight facts" aria-label={facts.label}>
      <div className="container">
        <ul className="facts__grid">
          {facts.items.map((item) => (
            <li key={item.title} className="facts__item">
              <span className="facts__icon">
                <Icon name={item.icon} size={20} />
              </span>
              <h2 className="facts__title">{typo(item.title)}</h2>
              <p className="facts__text">{typo(item.text)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
