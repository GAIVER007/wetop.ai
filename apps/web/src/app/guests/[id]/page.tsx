import Link from 'next/link';
import { RecordTabs } from '../../../components/record-tabs';
import { notFoundOn404 } from '../../../lib/page-error';
import { api, guestsApi, messengerLinks } from '../../../lib/api';
import { hotelToday } from '../../../lib/hotel-api';
import { displayDate } from '../../../lib/display-date';
import { Page } from '../../../components/page';
import { EmptyState, SectionTitle, StatusBadge, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { GuestForms } from './guest-forms';
import { stayNow } from './stay-now';
import '../../directory.css';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};

/** Карточка гостя: профиль, документы (маска), история проживаний. */
export default async function GuestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [g, piiStorage] = await Promise.all([
    guestsApi.card(id).catch(notFoundOn404),
    api.piiStorage(),
  ]);
  const messengers = messengerLinks(g.phone);
  const today = hotelToday();
  const stays = [...g.stays].sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  return (
    <Page
      width="medium"
      crumbs={<Link href="/guests">← гости</Link>}
      title={`${g.lastName} ${g.firstName} ${g.middleName ?? ''}`.trim()}
    >
      {/* Полоса фактов, как на карточке брони (B3): где гость сейчас, связь, гражданство, проживаний */}
      <dl className="booking-head guest-head" data-testid="guest-head">
        <div>
          <dt>Сейчас</dt>
          <dd data-testid="guest-stay-now">{stayNow(stays, today)}</dd>
        </div>
        <div>
          <dt>Телефон</dt>
          <dd>
            {g.phone ?? <span className="muted">—</span>}
            {messengers && (
              <span className="booking-head__contacts">
                <a href={messengers.whatsapp} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
                <a href={messengers.telegram} target="_blank" rel="noreferrer">
                  Telegram
                </a>
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{g.email ?? <span className="muted">—</span>}</dd>
        </div>
        <div>
          <dt>Гражданство</dt>
          <dd>{g.citizenship ?? <span className="warn-text">—</span>}</dd>
        </div>
        <div>
          <dt>Проживаний</dt>
          <dd>{g.stays.length}</dd>
        </div>
      </dl>
      <RecordTabs
        label="Разделы карточки гостя"
        tabs={[
          {
            id: 'guest-profile',
            label: 'Информация',
            content: <GuestForms guest={g} piiStorage={piiStorage} />,
          },
          {
            id: 'guest-history',
            label: 'Проживания',
            content: (
              <>
                <SectionTitle id="guest-history">История проживаний</SectionTitle>
                {stays.length === 0 ? (
                  <EmptyState icon={<Icon name="booking" />} title="Проживаний пока нет">
                    Первое появится, когда гость будет заведён в бронь.
                  </EmptyState>
                ) : (
                  <Table className="dir-table dir-table--history" nowrap>
                    <thead>
                      <tr>
                        {['Бронь', 'Категория', 'Ячейка', 'Заезд', 'Выезд', 'Статус'].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stays.map((s) => (
                        <tr
                          key={`${s.confirmationNumber}-${s.arrivalDate}`}
                          data-testid="guest-stay-row"
                        >
                          <td>
                            <Link
                              className="dir-number"
                              href={`/reservations/${encodeURIComponent(s.confirmationNumber)}`}
                              aria-label={`Открыть бронь ${s.confirmationNumber}`}
                            >
                              {s.confirmationNumber}
                            </Link>
                          </td>
                          <td>{s.accommodationTypeName}</td>
                          <td className="mono">{s.unitCode ?? '—'}</td>
                          {/* §14: сырая дата — в datetime, человеку — «20 сент.» */}
                          <td>
                            <time dateTime={s.arrivalDate}>{displayDate(s.arrivalDate)}</time>
                          </td>
                          <td>
                            <time dateTime={s.departureDate}>{displayDate(s.departureDate)}</time>
                          </td>
                          <td>
                            <StatusBadge
                              status={s.status}
                              label={STATUS_RU[s.status] ?? s.status}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </>
            ),
          },
          {
            id: 'guest-accounts',
            label: 'Счета и услуги',
            content: (
              <div className="guest-account-links">
                {stays.map((stay) => (
                  <Link
                    className="panel"
                    key={`${stay.confirmationNumber}-${stay.arrivalDate}`}
                    href={`/reservations/${encodeURIComponent(stay.confirmationNumber)}#booking-finance`}
                  >
                    <strong>{stay.confirmationNumber}</strong>
                    <span className="muted">
                      <time dateTime={stay.arrivalDate}>{displayDate(stay.arrivalDate)}</time>
                      {' → '}
                      <time dateTime={stay.departureDate}>{displayDate(stay.departureDate)}</time>
                    </span>
                    <span>Счёт и дополнительные услуги</span>
                  </Link>
                ))}
                {!stays.length && (
                  <EmptyState title="Счетов пока нет">
                    Счёт открывается на проживание: здесь появятся счета по броням гостя.
                  </EmptyState>
                )}
              </div>
            ),
          },
        ]}
      />
    </Page>
  );
}
