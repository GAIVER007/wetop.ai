import Link from 'next/link';
import { deskApi, formatMinor, messengerLinks, type DeskRow } from '../../lib/api';
import { Page } from '../../components/page';
import { Button, Input, SectionTitle, Stat, Stats, StatusBadge, Table } from '../../components/ui';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'ждём',
  CHECKED_IN: 'живёт',
  CHECKED_OUT: 'выселен',
};

/** Рабочий день стойки: что делать сегодня (SPEC §6). Первое, что открывает администратор утром. */
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const day = await deskApi.today(sp.date);
  return (
    <Page
      title={`Сегодня, ${day.date}`}
      actions={
        <form method="get" className="row">
          <Input type="date" name="date" defaultValue={day.date} />
          <Button type="submit" tone="secondary">
            Показать
          </Button>
        </form>
      }
    >
      <Stats min={140}>
        <Stat label="Заезды" value={String(day.counts.arrivals)} testId="c-arrivals" />
        <Stat
          label="Из них не заселены"
          value={String(day.counts.toCheckIn)}
          testId="c-tocheckin"
        />
        <Stat label="Выезды" value={String(day.counts.departures)} testId="c-departures" />
        <Stat
          label="Из них не выселены"
          value={String(day.counts.toCheckOut)}
          testId="c-tocheckout"
        />
        <Stat label="Живут" value={String(day.counts.inHouse)} testId="c-inhouse" />
        <Stat
          label="Долг уезжающих"
          value={formatMinor(day.debtMinor)}
          testId="c-debt"
          tone={day.debtMinor !== '0' ? 'alarm' : undefined}
        />
      </Stats>

      <Group title="Заезжают" rows={day.arrivals} testId="arrivals" showBlocked />
      <Group title="Выезжают" rows={day.departures} testId="departures" showDebt />
      <Group title="Живут" rows={day.inHouse} testId="inhouse" />
    </Page>
  );
}

function Group({
  title,
  rows,
  testId,
  showBlocked,
  showDebt,
}: {
  title: string;
  rows: DeskRow[];
  testId: string;
  showBlocked?: boolean;
  showDebt?: boolean;
}) {
  const head = ['Гость', 'Бронь', 'Ячейка', 'Категория', 'Проживание', 'Статус'];
  if (showDebt) head.push('Счёт');
  return (
    <>
      <SectionTitle>
        {title} — {rows.length}
      </SectionTitle>
      <Table data-testid={`group-${testId}`}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className={h === 'Счёт' ? 'num' : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                никого
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const m = messengerLinks(r.guestPhone);
            return (
              <tr key={r.itemId} data-testid={`row-${testId}`}>
                <td>
                  {r.guestLabel || '—'}
                  {m && (
                    <>
                      {' '}
                      <a href={m.whatsapp} target="_blank" rel="noreferrer" className="small">
                        WA
                      </a>
                    </>
                  )}
                </td>
                <td>
                  <Link href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}>
                    {r.confirmationNumber}
                  </Link>
                </td>
                <td>
                  {r.unitCode ? (
                    <Link href={`/units/${encodeURIComponent(r.unitCode)}`} className="mono">
                      {r.unitCode}
                    </Link>
                  ) : (
                    <span className="warn-text">нет</span>
                  )}
                </td>
                <td>{r.accommodationTypeName}</td>
                <td className="nowrap">
                  {r.arrivalDate} → {r.departureDate}
                </td>
                <td>
                  <StatusBadge status={r.status} label={STATUS_RU[r.status] ?? r.status} />
                  {showBlocked && r.blockedReason && (
                    <span className="warn-text"> · {r.blockedReason}</span>
                  )}
                  {showBlocked && r.guestsRecorded < r.adults && !r.blockedReason && (
                    <span className="warn-text">
                      {' '}
                      · карточек {r.guestsRecorded} из {r.adults}
                    </span>
                  )}
                </td>
                {showDebt && (
                  <td className="num">
                    <span className={BigInt(r.balanceMinor) > 0n ? 'danger-text' : 'ok-text'}>
                      {formatMinor(r.balanceMinor)}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
