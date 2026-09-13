import Link from 'next/link';
import { RecordTabs } from '../../../components/record-tabs';
import { notFoundOn404 } from '../../../lib/page-error';
import { guestsApi } from '../../../lib/api';
import { Page } from '../../../components/page';
import { SectionTitle, StatusBadge, Table } from '../../../components/ui';
import { GuestForms } from './guest-forms';

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
  const g = await guestsApi.card(id).catch(notFoundOn404);
  return (
    <Page
      width="medium"
      crumbs={<Link href="/guests">← гости</Link>}
      title={`${g.lastName} ${g.firstName} ${g.middleName ?? ''}`.trim()}
    >
      <div className="guest-summary">
        <div className="guest-avatar" aria-hidden="true">
          {g.firstName.slice(0, 1)}
          {g.lastName.slice(0, 1)}
        </div>
        <div>
          <strong>{g.phone ?? 'Телефон не указан'}</strong>
          <p>{g.email ?? 'Email не указан'}</p>
        </div>
        <div className="guest-summary-fact">
          <span>Проживаний в истории</span>
          <strong>{g.stays.length}</strong>
        </div>
        <div className="guest-summary-fact">
          <span>Гражданство</span>
          <strong>{g.citizenship ?? 'Не заполнено'}</strong>
        </div>
      </div>
      <RecordTabs
        label="Разделы карточки гостя"
        tabs={[
          {
            id: 'guest-profile',
            label: 'Информация',
            content: (
              <>
                <GuestForms guest={g} />
              </>
            ),
          },
          {
            id: 'guest-history',
            label: 'Проживания',
            content: (
              <>
                <SectionTitle id="guest-history">История проживаний</SectionTitle>
                <Table>
                  <thead>
                    <tr>
                      {['Бронь', 'Категория', 'Ячейка', 'Заезд', 'Выезд', 'Статус'].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.stays.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted">
                          нет
                        </td>
                      </tr>
                    )}
                    {g.stays.map((s) => (
                      <tr key={`${s.confirmationNumber}-${s.arrivalDate}`}>
                        <td>
                          <Link href={`/reservations/${encodeURIComponent(s.confirmationNumber)}`}>
                            {s.confirmationNumber}
                          </Link>
                        </td>
                        <td>{s.accommodationTypeName}</td>
                        <td className="mono">{s.unitCode ?? '—'}</td>
                        <td>{s.arrivalDate}</td>
                        <td>{s.departureDate}</td>
                        <td>
                          <StatusBadge status={s.status} label={STATUS_RU[s.status] ?? s.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            ),
          },
          {
            id: 'guest-accounts',
            label: 'Счета и услуги',
            content: (
              <div className="guest-account-links">
                {g.stays.map((stay) => (
                  <Link
                    className="panel"
                    key={`${stay.confirmationNumber}-${stay.arrivalDate}`}
                    href={`/reservations/${encodeURIComponent(stay.confirmationNumber)}#booking-finance`}
                  >
                    <strong>{stay.confirmationNumber}</strong>
                    <span className="muted">
                      {stay.arrivalDate} → {stay.departureDate}
                    </span>
                    <span>Счёт и дополнительные услуги →</span>
                  </Link>
                ))}
                {!g.stays.length && (
                  <div className="empty-state">
                    <h3>Счетов пока нет</h3>
                    <p>Здесь появятся счета по проживаниям гостя.</p>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </Page>
  );
}
