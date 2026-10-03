import Link from 'next/link';
import { getDictionary } from '../../i18n';
import { contactLinks } from '../../lib/site';
import { ChessboardMockup } from '../chessboard-mockup';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Для кого» (03.10.2026, решение владельца): три типа объектов, с которыми система работает, рядом макет
 * шахматки, ниже приглашение салонам и студиям. Дорожной карты направлений («Первое направление: Hospitality»,
 * «Следующее направление», «подключить пока нельзя») на странице нет: она говорила посетителю, что продукт
 * недоделан, а салону, что ему сюда нельзя.
 *
 * Приглашение ведёт на почту, а не на регистрацию, и намеренно не обещает журнал записи, мастеров и расписание
 * услуг: в стойке этих функций ещё нет (DESIGN.md §19.9).
 */
export function Audience() {
  const { audience } = getDictionary();
  const email = contactLinks().find((contact) => contact.kind === 'email');
  return (
    <section id="audience" className="section section--band" aria-labelledby="audience-title">
      <div className="container">
        <div className="showcase__layout">
          <div>
            <SectionHeading
              id="audience-title"
              eyebrow={audience.eyebrow}
              title={audience.title}
              lead={audience.lead}
            />
            <ul className="showcase__cases">
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
          <div className="showcase">
            <ChessboardMockup />
            <p className="showcase__caption">{typo(audience.caption)}</p>
          </div>
        </div>
        <div className="invite card glass glass--quiet">
          <div>
            <h3 className="card__title">{audience.invite.title}</h3>
            <p className="card__text">{typo(audience.invite.text)}</p>
          </div>
          {email ? (
            <a className="btn btn--secondary" href={email.href}>
              {audience.invite.action}
              <Icon name="mail" size={18} />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
