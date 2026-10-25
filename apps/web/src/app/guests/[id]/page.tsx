import { requireFeature } from '../../../lib/vertical-guard';
import Link from 'next/link';
import { citizenshipLabel, countGuestNights, summarizeGuestStays } from '@pms/domain';
import { Tabs } from '../../../components/tabs';
import { notFoundOn404 } from '../../../lib/page-error';
import { api, guestsApi, messengerLinks, type GuestCard } from '../../../lib/api';
import { hotelToday, sourceNames } from '../../../lib/hotel-api';
import { deskShell } from '../../../lib/desk-shell';
import { displayDate } from '../../../lib/display-date';
import { formatMoney } from '../../../lib/money';
import { countLabel, intlLocale, msg } from '../../../i18n';
import { currentLocale, serverT } from '../../../i18n/server';
import { nightsLabel, type Lang } from '../../chessboard/lang';
import { Page, BackCrumb } from '../../../components/page';
import { AmountChip } from '../../../components/amount-chip';
import { EmptyState, SectionTitle, StatusBadge, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { GuestDocuments, GuestProfileForm } from './guest-forms';
import { guestDisplayName } from '../guest-stay';
import { financeState } from '../../reservations/finance-state';
import '../../directory.css';
import '../guests.css';
import { formatPhone } from '../../../lib/phone';

type Stay = GuestCard['stays'][number];

/** На «Обзоре» — три свежих проживания (включая будущее); вся история — вкладкой «Проживания» */
const OVERVIEW_STAYS = 3;

const due = (minor: string | null): minor is string => minor !== null && BigInt(minor) > 0n;

/** «12 авг. → 15 авг. 2026»: год один раз в конце, если совпадает (DESIGN.md §14, стрелка «с… по…») */
function StayPeriod({ stay, lang }: { stay: Pick<Stay, 'arrivalDate' | 'departureDate'>; lang: Lang }) {
  const locale = intlLocale(lang.locale);
  const sameYear = stay.arrivalDate.slice(0, 4) === stay.departureDate.slice(0, 4);
  return (
    <span className="stay-period">
      <time dateTime={stay.arrivalDate}>
        {displayDate(stay.arrivalDate, 'short', locale)}
        {sameYear ? '' : ` ${stay.arrivalDate.slice(0, 4)}`}
      </time>
      {' → '}
      <time dateTime={stay.departureDate}>
        {displayDate(stay.departureDate, 'short', locale)} {stay.departureDate.slice(0, 4)}
      </time>
    </span>
  );
}

/**
 * История проживаний (ТЗ §21): когда, где, откуда бронь, сколько по счёту и чем кончилось. Статус —
 * слово о брони: строка истории и есть одна бронь, здесь это честно (в отличие от строки гостя).
 * Сумма — начислено по счёту проживания (Folio, ТЗ §24); остаток — подписью «к оплате».
 */
function StaysTable({ stays, lang }: { stays: Stay[]; lang: Lang }) {
  const { t } = lang;
  return (
    <Table className="dir-table dir-table--history" nowrap>
      <thead>
        <tr>
          <th>{t('Проживание')}</th>
          <th>{t('Место')}</th>
          <th>{t('Источник')}</th>
          <th className="num">{t('Сумма')}</th>
          <th>{t('Статус')}</th>
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
                <StayPeriod stay={s} lang={lang} />
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
            <td>{s.channel || t(sourceNames[s.source] || s.source)}</td>
            <td className="num">
              {s.chargedMinor !== null && BigInt(s.chargedMinor) > 0n ? (
                formatMoney(s.chargedMinor, s.currency)
              ) : (
                <span className="muted">—</span>
              )}
              {due(s.balanceMinor) && (
                <span className="dir-sub">{t('к оплате {sum}', { sum: formatMoney(s.balanceMinor, s.currency) })}</span>
              )}
            </td>
            <td>
              <StatusBadge kind="hospitality" value={s.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Слово о деньгах проживания — те же состояния, что колонка «Финансы» на «Бронях» (ADR-106) */
function StayFinance({ stay, lang: { t } }: { stay: Stay; lang: Lang }) {
  const state = financeState({
    hasFolios: stay.chargedMinor !== null,
    chargedMinor: stay.chargedMinor ?? '0',
    paidMinor: stay.paidMinor ?? '0',
    refundedMinor: stay.refundedMinor ?? '0',
    balanceMinor: stay.balanceMinor ?? '0',
  });
  switch (state.kind) {
    case 'unpaid':
      return <span className="warn-text">{t('не оплачено')}</span>;
    case 'due':
      return <AmountChip tone="due" minor={state.minor} currency={stay.currency} />;
    case 'refund-due':
      return (
        <AmountChip tone="refund" label={t('к возврату')} minor={state.minor} currency={stay.currency} />
      );
    case 'refunded':
      return <span className="muted">{t('возвращено')}</span>;
    case 'paid':
      return <span className="dir-paid">{t('оплачено')}</span>;
    default:
      return <span className="muted">—</span>;
  }
}

/**
 * Финансы гостя (G5, ТЗ §24): свод по счетам его проживаний и разбивка по проживаниям. Своих
 * «денег гостя» нет — источник правды Folio каждой брони, сюда приходит только их сумма. Свод
 * считается по валюте: у Luxx она одна, но складывать тенге с долларами было бы неправдой.
 */
function GuestFinance({ stays, lang }: { stays: Stay[]; lang: Lang }) {
  const { t } = lang;
  const billed = stays.filter((s) => s.chargedMinor !== null);
  if (billed.length === 0)
    return (
      <EmptyState icon={<Icon name="booking" />} title={t('Счетов пока нет')}>
        {t('Счёт открывается на проживание: здесь появятся счета по броням гостя.')}
      </EmptyState>
    );
  const totals = new Map<
    string,
    { charged: bigint; paid: bigint; refunded: bigint; balance: bigint }
  >();
  for (const s of billed) {
    const sum = totals.get(s.currency) ?? { charged: 0n, paid: 0n, refunded: 0n, balance: 0n };
    sum.charged += BigInt(s.chargedMinor!);
    sum.paid += BigInt(s.paidMinor ?? '0');
    sum.refunded += BigInt(s.refundedMinor ?? '0');
    sum.balance += BigInt(s.balanceMinor ?? '0');
    totals.set(s.currency, sum);
  }
  return (
    <>
      {[...totals].map(([currency, sum]) => (
        <dl
          key={currency}
          className="booking-head guest-finance-summary"
          data-testid="guest-finance-summary"
        >
          <div>
            <dt>{t('Начислено')}</dt>
            <dd>{formatMoney(sum.charged, currency)}</dd>
          </div>
          <div>
            <dt>{t('Оплачено')}</dt>
            <dd>{formatMoney(sum.paid, currency)}</dd>
          </div>
          {sum.refunded > 0n && (
            <div>
              <dt>{t('Возвращено')}</dt>
              <dd>{formatMoney(sum.refunded, currency)}</dd>
            </div>
          )}
          <div>
            <dt>{t('Остаток')}</dt>
            <dd>
              {sum.balance > 0n ? (
                <AmountChip tone="due" minor={sum.balance} currency={currency} />
              ) : sum.balance < 0n ? (
                <AmountChip
                  tone="refund"
                  label={t('к возврату')}
                  minor={-sum.balance}
                  currency={currency}
                />
              ) : (
                <span className="dir-paid">{t('оплачено')}</span>
              )}
            </dd>
          </div>
        </dl>
      ))}
      {/* Q-202: что из остатка — долг, решает владелец; до ответа честно называем состав суммы */}
      <p className="sub guest-finance-note">
        {t('Сумма по счетам всех проживаний гостя, включая будущие брони. Оплата и возвраты — в счёте брони.')}
      </p>
      <SectionTitle>{t('По проживаниям')}</SectionTitle>
      <Table className="dir-table dir-table--guest-finance" nowrap>
        <thead>
          <tr>
            <th>{t('Проживание')}</th>
            <th>{t('Статус')}</th>
            <th className="num">{t('Начислено')}</th>
            <th className="num">{t('Оплачено')}</th>
            <th>{t('Финансы')}</th>
          </tr>
        </thead>
        <tbody>
          {billed.map((s) => (
            <tr key={`${s.confirmationNumber}-${s.arrivalDate}`} data-testid="guest-finance-row">
              <td>
                <Link
                  className="dir-period"
                  href={`/reservations/${encodeURIComponent(s.confirmationNumber)}#booking-finance`}
                >
                  <StayPeriod stay={s} lang={lang} />
                </Link>
                <span className="dir-sub mono">{s.confirmationNumber}</span>
              </td>
              <td>
                <StatusBadge kind="hospitality" value={s.status} />
              </td>
              <td className="num">{formatMoney(s.chargedMinor!, s.currency)}</td>
              <td className="num">{formatMoney(s.paidMinor ?? '0', s.currency)}</td>
              <td>
                <StayFinance stay={s} lang={lang} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

/**
 * Карточка гостя «Гости v2», G4 (ТЗ §18–§21): человек, где он сейчас, что впереди и вся его история.
 * Вкладки (§18): «Обзор» (текущее и следующее проживание, последние визиты), «Проживания» (вся
 * история), «Документы» и «Финансы» (G5, §22–§24) и «Данные гостя» — профиль для правки.
 */
export default async function GuestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature('/guests');
  const t = await serverT();
  const locale = await currentLocale();
  const lang: Lang = { t, locale };
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
          <SectionTitle first>{t('Текущее проживание')}</SectionTitle>
          <div className="panel guest-stay-card" data-testid="guest-stay-current">
            <p className="guest-stay-card__when">
              <StayPeriod stay={current} lang={lang} />
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
              {t('Открыть бронь')}
            </Link>
          </div>
        </>
      )}
      {next && (
        <>
          <SectionTitle first={!current}>{t('Следующий визит')}</SectionTitle>
          <div className="panel guest-stay-card" data-testid="guest-stay-next">
            <p className="guest-stay-card__when">
              <StayPeriod stay={next} lang={lang} />
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
            <StatusBadge kind="hospitality" value={next.status} />
            <Link className="btn btn--secondary btn--sm" href={reservationHref(next)}>
              {t('Открыть бронь')}
            </Link>
          </div>
        </>
      )}
      <SectionTitle first={!current && !next}>{t('История проживаний')}</SectionTitle>
      {stays.length === 0 ? (
        <EmptyState icon={<Icon name="booking" />} title={t('Проживаний пока нет')}>
          {t('Первое появится, когда гость будет заведён в бронь.')}
        </EmptyState>
      ) : (
        <>
          <StaysTable stays={stays.slice(0, OVERVIEW_STAYS)} lang={lang} />
          {stays.length > OVERVIEW_STAYS && (
            <p className="guest-overview-more">
              {/* ссылка на вкладку: вкладки (Tabs) переключают её без перехода */}
              <a href="#guest-stays">{t('Все проживания ({n})', { n: stays.length })}</a>
            </p>
          )}
        </>
      )}
      {g.notes && (
        <>
          <SectionTitle>{t('Заметки')}</SectionTitle>
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
      crumbs={<BackCrumb href="/guests">{t('Гости и бронирования')}</BackCrumb>}
      title={guestDisplayName(g)}
      actions={
        // «Только чтение» (ADR-102): действия, которых нельзя, не рисуются — как «Новая бронь» на «Бронях»
        readOnly ? undefined : (
          <>
            {/* обычная ссылка-якорь: смена адреса после # переключает вкладку (Tabs слушает hashchange) */}
            <a className="btn btn--secondary" href="#guest-profile">
              {t('Редактировать')}
            </a>
            {/* G6 (ТЗ §33): форма брони сразу с этим гостем — второго гостя бронь не заведёт */}
            <Link className="btn" href={`/reservations/new?guest=${encodeURIComponent(g.id)}`}>
              <Icon name="plus" />
              {t('Новая бронь')}
            </Link>
          </>
        )
      }
    >
      {/* Полоса фактов (ТЗ §19): связь, гражданство и сколько раз гость был у нас */}
      <dl className="booking-head guest-head" data-testid="guest-head">
        <div>
          <dt>{t('Телефон')}</dt>
          <dd>
            {g.phone ? formatPhone(g.phone) : <span className="muted">—</span>}
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
          <dt>{t('Гражданство')}</dt>
          <dd>{citizenshipLabel(g.citizenship) ?? <span className="warn-text">—</span>}</dd>
        </div>
        <div>
          <dt>{t('Визиты')}</dt>
          <dd data-testid="guest-visits">
            {countLabel(locale, t, summary.staysCount, [msg('визит'), 'визита', msg('визитов')]) /* kk-allow: форма склонения */} ·{' '}
            {nightsLabel(lang, nights)}
          </dd>
        </div>
      </dl>
      <Tabs
        label={t('Разделы карточки гостя')}
        panels={[
          { id: 'guest-overview', label: t('Обзор'), content: overview },
          {
            id: 'guest-stays',
            label: t('Проживания'),
            content:
              stays.length === 0 ? (
                <EmptyState icon={<Icon name="booking" />} title={t('Проживаний пока нет')}>
                  {t('Первое появится, когда гость будет заведён в бронь.')}
                </EmptyState>
              ) : (
                <StaysTable stays={stays} lang={lang} />
              ),
          },
          {
            id: 'guest-documents',
            label: t('Документы'),
            content: (
              <GuestDocuments guest={g} piiStorage={piiStorage} readOnly={readOnly} today={today} />
            ),
          },
          { id: 'guest-finance', label: t('Финансы'), content: <GuestFinance stays={stays} lang={lang} /> },
          {
            id: 'guest-profile',
            label: t('Данные гостя'),
            content: <GuestProfileForm guest={g} piiStorage={piiStorage} readOnly={readOnly} />,
          },
        ]}
      />
    </Page>
  );
}
