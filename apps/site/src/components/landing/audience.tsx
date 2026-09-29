import Link from 'next/link';
import { getDictionary } from '../../i18n';
import { ChessboardMockup } from '../chessboard-mockup';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Направления» (29.09.2026, ADR-104): Hospitality — работающее направление, с шахматкой и тремя видами объектов;
 * следующее направление — отдельной карточкой с явной пометкой, что подключить его пока нельзя.
 */
export function Audience() {
  const { audience } = getDictionary();
  return (
    <section id="audience" className="section" aria-labelledby="audience-title">
      <div className="container">
        <SectionHeading
          id="audience-title"
          eyebrow={audience.eyebrow}
          title={audience.title}
          lead={audience.lead}
        />
        <div className="vertical-live">
          <p className="vertical-status vertical-status--live">
            <span className="vertical-status__dot" aria-hidden="true" />
            {audience.status}
          </p>
          <ChessboardMockup />
        </div>
        <ul className="card-grid card-grid--3">
          {audience.items.map((item) => (
            <li key={item.title} className="card audience-card glass">
              <span className="icon-tile">
                <Icon name={item.icon} />
              </span>
              <h3 className="card__title">{typo(item.title)}</h3>
              <p className="card__text">{typo(item.text)}</p>
              <Link className="link-arrow" href={`/for/${item.segment}/`}>
                {audience.more}
                <Icon name="arrowRight" size={16} />
              </Link>
            </li>
          ))}
        </ul>
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
