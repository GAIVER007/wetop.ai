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
  const debt = day.debtMinor !== '0';
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
      {/*
       * Четыре числа вместо шести: «из них не заселены» — не отдельный показатель, а хвост заезда,
       * поэтому он подписью внутри плитки. Плитки всегда белые; цветом выделено только то, что требует
       * действия — незакрытые заезды/выезды и долг.
       */}
      <Stats min={190}>
        <Stat
          label="Заезды"
          value={String(day.counts.arrivals)}
          testId="c-arrivals"
          hint={
            <>
              <span data-testid="c-tocheckin">{day.counts.toCheckIn}</span> ещё не заселены
            </>
          }
          hintTone={day.counts.toCheckIn > 0 ? 'warn' : undefined}
        />
        <Stat
          label="Выезды"
          value={String(day.counts.departures)}
          testId="c-departures"
          hint={
            <>
              <span data-testid="c-tocheckout">{day.counts.toCheckOut}</span> ещё не выселены
            </>
          }
          hintTone={day.counts.toCheckOut > 0 ? 'warn' : undefined}
        />
        <Stat label="Живут" value={String(day.counts.inHouse)} testId="c-inhouse" hint="в доме" />
        <Stat
          label="Долг уезжающих"
          value={
            <span className={debt ? 'danger-text' : undefined} data-testid="c-debt">
              {formatMinor(day.debtMinor)}
            </span>
          }
          hint={debt ? 'спросить при выезде' : 'все рассчитались'}
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
  const head = ['Гость', 'Ячейка', 'Категория', 'Проживание', 'Статус'];
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
              <td colSpan={head.length} className="muted">
                никого
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const m = messengerLinks(r.guestPhone);
            return (
              <tr key={r.itemId} data-testid={`row-${testId}`}>
                {/*
                 * Имя — ссылка на бронь: администратор ищет глазами гостя, а не номер. Сам номер
                 * второй строкой мелким моноширинным: он нужен, когда его диктуют по телефону.
                 */}
                <td>
                  <Link
                    href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}
                    className="bold"
                  >
                    {r.guestLabel || 'без имени'}
                  </Link>
                  {m && (
                    <>
                      {' '}
                      <a href={m.whatsapp} target="_blank" rel="noreferrer" className="small">
                        WA
                      </a>
                    </>
                  )}
                  <div className="cell-sub mono">{r.confirmationNumber}</div>
                </td>
                <td>
                  {r.unitCode ? (
                    <Link href={`/units/${encodeURIComponent(r.unitCode)}`} className="unit">
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
                    <div className="cell-sub warn-text">{r.blockedReason}</div>
                  )}
                  {showBlocked && r.guestsRecorded < r.adults && !r.blockedReason && (
                    <div className="cell-sub warn-text">
                      карточек {r.guestsRecorded} из {r.adults}
                    </div>
                  )}
                </td>
                {showDebt && (
                  <td className="num">
                    <span className={BigInt(r.balanceMinor) > 0n ? 'danger-text bold' : 'muted'}>
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
