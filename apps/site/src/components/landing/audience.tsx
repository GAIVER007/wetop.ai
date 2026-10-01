import Link from 'next/link';
import { getDictionary } from '../../i18n';
import { ChessboardMockup } from '../chessboard-mockup';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Направления» (ADR-104): Hospitality работает, с шахматкой и тремя видами объектов, у каждого своя страница
 * `/for/<тип>/`; следующее направление отдельной карточкой с явной пометкой, что подключить его пока нельзя.
 */
export function Audience() {
  const { audience } = getDictionary();
  return (
    <section id="audience" className="section section--band" aria-labelledby="audience-title">
      <div className="container">
        <div className="vertical-live__layout">
          <div>
            <SectionHeading
              id="audience-title"
              eyebrow={audience.eyebrow}
              title={audience.title}
              lead={audience.lead}
            />
            <ul className="vertical-live__cases">
              {audience.items.map((item) => (
                <li key={item.title}>
                  <span className="icon-tile">
                    <Icon name={item.icon} />
                  </span>
                  <div>
                    <h3>{typo(item.title)}</h3>
                    <p>{typo(item.text)}</p>
                    <Link className="link-arrow" href={`/for/${item.segment}/`}>
                      {audience.more}
                      <Icon name="arrowRight" size={16} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="vertical-live">
            <p className="vertical-status vertical-status--live">
              <span className="vertical-status__dot" aria-hidden="true" />
              {audience.status}
            </p>
            <ChessboardMockup />
            <p className="vertical-live__caption">{typo(audience.caption)}</p>
          </div>
        </div>
        <div className="vertical-next card glass glass--quiet">
          <p className="vertical-status">
            <span className="vertical-status__dot" aria-hidden="true" />
            {audience.next.status}
          </p>
          <h3 className="card__title">{audience.next.title}</h3>
          <p className="card__text">{typo(audience.next.text)}</p>
        </div>
      </div>
    </section>
  );
}
