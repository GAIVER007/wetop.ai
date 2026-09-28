import Link from 'next/link';
import { countGuestNights, summarizeGuestStays } from '@pms/domain';
import { RecordTabs } from '../../../components/record-tabs';
import { notFoundOn404 } from '../../../lib/page-error';
import { api, guestsApi, messengerLinks, type GuestCard } from '../../../lib/api';
import { hotelToday, reservationStatusWords, sourceNames } from '../../../lib/hotel-api';
import { deskShell } from '../../../lib/desk-shell';
import { displayDate } from '../../../lib/display-date';
import { formatMoney } from '../../../lib/money';
import { pluralRu } from '../../../lib/plural';
import { Page } from '../../../components/page';
import { AmountChip } from '../../../components/amount-chip';
import { EmptyState, SectionTitle, StatusBadge, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { GuestForms } from './guest-forms';
import '../../directory.css';
import '../guests.css';

type Stay = GuestCard['stays'][number];

/** На «Обзоре» — три свежих проживания (включая будущее); вся история — вкладкой «Проживания» */
const OVERVIEW_STAYS = 3;

const due = (minor: string | null): minor is string => minor !== null && BigInt(minor) > 0n;

/** «12 авг. → 15 авг. 2026»: год один раз в конце, если совпадает (DESIGN.md §14, стрелка «с… по…») */
function StayPeriod({ stay }: { stay: Pick<Stay, 'arrivalDate' | 'departureDate'> }) {
  const sameYear = stay.arrivalDate.slice(0, 4) === stay.departureDate.slice(0, 4);
  return (
    <span className="stay-period">
      <time dateTime={stay.arrivalDate}>
        {displayDate(stay.arrivalDate)}
        {sameYear ? '' : ` ${stay.arrivalDate.slice(0, 4)}`}
      </time>
      {' → '}
      <time dateTime={stay.departureDate}>
        {displayDate(stay.departureDate)} {stay.departureDate.slice(0, 4)}
      </time>
    </span>
  );
}

/**
 * История проживаний (ТЗ §21): когда, где, откуда бронь, сколько по счёту и чем кончилось. Статус —
 * слово о брони: строка истории и есть одна бронь, здесь это честно (в отличие от строки гостя).
 * Сумма — начислено по счёту проживания (Folio, ТЗ §24); остаток — подписью «к оплате».
 */
function StaysTable({ stays }: { stays: Stay[] }) {
  return (
    <Table className="dir-table dir-table--history" nowrap>
      <thead>
        <tr>
          <th>Проживание</th>
          <th>Место</th>
          <th>Источник</th>
          <th className="num">Сумма</th>
          <th>Статус</th>
        </tr>
      </thead>
      <tbody>
        {stays.map((s) => (
          <tr key={`${s.confirmationNumber}-${s.arrivalDate}`} data-testid="guest-stay-row">
            <td>
              <Link
                className="dir-period"
                href={`/reservations/${encodeURIComponent(s.confirmationNumber)}`}
              >
                <StayPeriod stay={s} />
              </Link>
              <span className="dir-sub mono">{s.confirmationNumber}</span>
            </td>
            <td>
              {s.unitCode ? (
                <span className="dir-unit">
                  <Icon name="bed" />
                  {s.unitCode}
                </span>
              ) : (
                <span className="muted">—</span>
              )}
              <span className="dir-sub">{s.accommodationTypeName}</span>
            </td>
            <td>{s.channel || sourceNames[s.source] || s.source}</td>
            <td className="num">
              {s.chargedMinor !== null && BigInt(s.chargedMinor) > 0n ? (
                formatMoney(s.chargedMinor, s.currency)
              ) : (
                <span className="muted">—</span>
              )}
              {due(s.balanceMinor) && (
                <span className="dir-sub">к оплате {formatMoney(s.balanceMinor, s.currency)}</span>
              )}
            </td>
            <td>
              <StatusBadge
                status={s.status}
                label={reservationStatusWords[s.status] ?? s.status}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/**
 * Карточка гостя «Гости v2», G4 (ТЗ §18–§21): человек, где он сейчас, что впереди и вся его история.
 * Вкладки: «Обзор» (текущее и следующее проживание, последние визиты), «Проживания» (вся история),
 * «Данные гостя» (профиль и документы — прежняя форма) и «Счета и услуги». Документы и финансовый
 * свод перестраивает G5; здесь их логика не тронута.
 */
export default async function GuestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [g, piiStorage, today, { readOnly }] = await Promise.all([
    guestsApi.card(id).catch(notFoundOn404),
    api.piiStorage(),
    hotelToday(),
    deskShell(),
  ]);
  const messengers = messengerLinks(g.phone);
  const stays = [...g.stays].sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  // «сейчас» и «следующий» выбираются тем же правилом, что список и предпросмотр (@pms/domain)
  const summary = summarizeGuestStays(stays, today);
  const nights = countGuestNights(stays);
  const current = summary.current
    ? stays.find(
        (s) =>
          s.status === 'CHECKED_IN' &&
          s.confirmationNumber === summary.current!.confirmationNumber &&
          s.departureDate === summary.current!.departureDate,
      )
    : undefined;
  const next = summary.next
    ? stays.find(
        (s) =>
          s.confirmationNumber === summary.next!.confirmationNumber &&
          s.arrivalDate === summary.next!.arrivalDate,
      )
    : undefined;
  const reservationHref = (s: Stay) => `/reservations/${encodeURIComponent(s.confirmationNumber)}`;

  const overview = (
    <>
      {current && (
        <>
          <SectionTitle first>Текущее проживание</SectionTitle>
          <div className="panel guest-stay-card" data-testid="guest-stay-current">
            <p className="guest-stay-card__when">
              <StayPeriod stay={current} />
            </p>
            <p className="guest-stay-card__where">
              {current.unitCode && (
                <span className="dir-unit">
                  <Icon name="bed" />
                  {current.unitCode}
                </span>
              )}
              <span className="dir-sub">{current.accommodationTypeName}</span>
            </p>
            {/* долг — остаток по счёту этого проживания; без долга строка места не занимает */}
            {due(current.balanceMinor) && (
              <AmountChip tone="due" minor={current.balanceMinor} currency={current.currency} />
            )}
            <Link className="btn btn--secondary btn--sm" href={reservationHref(current)}>
              Открыть бронь
            </Link>
          </div>
        </>
      )}
      {next && (
        <>
          <SectionTitle first={!current}>Следующий визит</SectionTitle>
          <div className="panel guest-stay-card" data-testid="guest-stay-next">
            <p className="guest-stay-card__when">
              <StayPeriod stay={next} />
            </p>
            <p className="guest-stay-card__where">
              {next.unitCode && (
                <span className="dir-unit">
                  <Icon name="bed" />
                  {next.unitCode}
                </span>
              )}
              <span className="dir-sub">{next.accommodationTypeName}</span>
            </p>
            {/* у будущей брони важно, подтверждена ли она; долг здесь не показывается (Q-202) */}
            <StatusBadge
              status={next.status}
              label={reservationStatusWords[next.status] ?? next.status}
            />
            <Link className="btn btn--secondary btn--sm" href={reservationHref(next)}>
              Открыть бронь
            </Link>
          </div>
        </>
      )}
      <SectionTitle first={!current && !next}>История проживаний</SectionTitle>
      {stays.length === 0 ? (
        <EmptyState icon={<Icon name="booking" />} title="Проживаний пока нет">
          Первое появится, когда гость будет заведён в бронь.
        </EmptyState>
      ) : (
        <>
          <StaysTable stays={stays.slice(0, OVERVIEW_STAYS)} />
          {stays.length > OVERVIEW_STAYS && (
            <p className="guest-overview-more">
              {/* ссылка на вкладку: RecordTabs переключает её без перехода */}
              <a href="#guest-stays">Все проживания ({stays.length})</a>
            </p>
          )}
        </>
      )}
      {g.notes && (
        <>
          <SectionTitle>Заметки</SectionTitle>
          <p className="guest-notes" data-testid="guest-notes">
            {g.notes}
          </p>
        </>
      )}
    </>
  );

  return (
    <Page
      width="medium"
      crumbs={<Link href="/guests">← гости</Link>}
      title={`${g.lastName} ${g.firstName} ${g.middleName ?? ''}`.trim()}
      actions={
        // «Только чтение» (ADR-102): действия, которых нельзя, не рисуются — как «Новая бронь» на «Бронях»
        readOnly ? undefined : (
          <>
            {/* обычная ссылка-якорь: смена адреса после # переключает вкладку (RecordTabs слушает hashchange) */}
            <a className="btn btn--secondary" href="#guest-profile">
              Редактировать
            </a>
            {/* предзаполнение гостя в форме брони — ступень G6 */}
            <Link className="btn" href="/reservations/new">
              <Icon name="plus" />
              Новая бронь
            </Link>
          </>
        )
      }
    >
      {/* Полоса фактов (ТЗ §19): связь, гражданство и сколько раз гость был у нас */}
      <dl className="booking-head guest-head" data-testid="guest-head">
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
          <dt>Визиты</dt>
          <dd data-testid="guest-visits">
            {pluralRu(summary.staysCount, ['визит', 'визита', 'визитов'])} ·{' '}
            {pluralRu(nights, ['ночь', 'ночи', 'ночей'])}
          </dd>
        </div>
      </dl>
      <RecordTabs
        label="Разделы карточки гостя"
        tabs={[
          { id: 'guest-overview', label: 'Обзор', content: overview },
          {
            id: 'guest-stays',
            label: 'Проживания',
            content:
              stays.length === 0 ? (
                <EmptyState icon={<Icon name="booking" />} title="Проживаний пока нет">
                  Первое появится, когда гость будет заведён в бронь.
                </EmptyState>
              ) : (
                <StaysTable stays={stays} />
              ),
          },
          {
            id: 'guest-profile',
            label: 'Данные гостя',
            content: <GuestForms guest={g} piiStorage={piiStorage} />,
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
