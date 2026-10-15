import type { MarketingCopy } from '../../i18n/types';
import { Icon } from '../icon';
import { typo } from '../typo';

/*
 * «Маркетинг и ИИ» на лендингах направлений (11.10.2026, поручение владельца). Только то, что есть в продукте
 * (§19.9): у гостиниц ИИ-продавец, загрузка конкурентов, сайт с ИИ, отчёты; чего ещё нет, идёт карточкой
 * с пометкой «Скоро» и приглушённым фоном. Собран из блоков главной (`.card`, `.tag`), своего класса нет.
 */
export function MarketingBlock({
  copy,
  eyebrow,
  id,
}: {
  copy: MarketingCopy;
  eyebrow: string;
  soon: string;
  id: string;
}) {
  return (
    <section id={id} className="section section--tight" aria-labelledby={`${id}-title`}>
      <div className="section-heading section-heading--center">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={`${id}-title`} className="section-heading__title">
          {typo(copy.title)}
        </h2>
        <p className="section-heading__lead">{typo(copy.lead)}</p>
      </div>
      <ul className="card-grid card-grid--3">
        {copy.items.map((item) => (
          <li
            key={item.title}
            className={item.soon ? 'card glass glass--quiet' : 'card glass'}
            data-soon={item.soon ? '' : undefined}
          >
            <span className="icon-tile">
              <Icon name={item.icon} />
            </span>
            <h3 className="card__title">{typo(item.title)}</h3>
            <p className="card__text">{typo(item.text)}</p>
          </li>
        ))}
      </ul>
      {copy.note ? (
        <div className="section-heading section-heading--center">
          <p className="section-heading__lead">{typo(copy.note)}</p>
        </div>
      ) : null}
    </section>
  );
}
