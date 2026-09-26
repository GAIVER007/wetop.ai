import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { api, chessboardApi } from '../../../lib/api';
import { hotelToday, validDate } from '../../../lib/hotel-api';
import { navigationItems } from '../../../lib/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { displayDate } from '../../../lib/display-date';
import { Alert, Help, Button, Field, Stat, Stats, Table } from '../../../components/ui';
import { DateInput } from '../../../components/date-field';
import '../../directory.css';

export default async function ManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const { section = [] } = await params;
  // Хаба больше нет (15.09.2026, решение владельца): единственный раздел — статистика
  if (!section.length) redirect('/management/statistics');
  const path = `/management${section.length ? `/${section.join('/')}` : ''}`;
  const item = navigationItems.find((item) => item.href === path);
  if (!item) notFound();
  const sp = normalizeSearchParams(await searchParams);
  return (
    <Page title={item.label}>
      {section[0] === 'statistics' && <Statistics date={sp.date ?? (await hotelToday())} />}
    </Page>
  );
}
async function Statistics({ date }: { date: string }) {
  if (!validDate(date))
    return (
      <Alert boxed>
        Некорректная дата. <Link href="/management/statistics">Вернуться к сегодняшнему дню</Link>
      </Alert>
    );
  // D4 (план владельца 19.09): отказ шахматки или фонда не уносит экран — дата и форма остаются, вместо чисел
  // `LoadError` с повтором на ту же дату. Расчёт загрузки не менялся.
  const loaded = await Promise.all([chessboardApi.board(date, date), api.inventorySummary()]).then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => ({ ok: false as const, e }),
  );
  const form = (
    <form method="get" className="row row--lg toolbar directory-toolbar">
      <Field inline label="Дата">
        <DateInput key={`date-${date}`} name="date" defaultValue={date} required />
      </Field>
      <Button type="submit">Показать</Button>
    </form>
  );
  if (!loaded.ok)
    return (
      <>
        {form}
        <LoadError testId="statistics-error" {...loadErrorProps(loaded.e)} />
      </>
    );
  const [board, inventory] = loaded.r;
  const summary = board.summary[date];
  const rows = Object.entries(board.byCategory[date] ?? {});
  return (
    <>
      {form}
      {/* Один <span>: `.directory-meta` — flex со `space-between`, и дата с <time> уезжала на середину строки (21.09) */}
      <p className="directory-meta" data-testid="statistics-meta">
        <span>
          Загрузка на <time dateTime={date}>{displayDate(date, 'numeric')}</time> по размещениям в
          шахматке
        </span>
      </p>
      {summary ? (
        <Stats>
          <Stat label="Занято единиц" value={summary.occupied} hint="по размещениям в шахматке" />
          <Stat label="Свободно единиц" value={summary.free} />
          <Stat label="Заблокировано" value={summary.blocked} />
          <Stat
            label="Без назначенного места"
            value={board.unassigned.length}
            hint="проживаний, отдельно от загрузки"
          />
        </Stats>
      ) : (
        <Alert boxed>Нет сводки на выбранную дату.</Alert>
      )}
      <Table className="dir-table dir-table--statistics" data-testid="statistics-table">
        <thead>
          <tr>
            <th>Категория</th>
            <th className="num">Всего</th>
            <th className="num">Занято</th>
            <th className="num">Свободно</th>
            <th className="num">Блок</th>
            <th>Загрузка</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([code, r]) => (
            <tr key={code}>
              <td>{inventory.byCategory.find((c) => c.code === code)?.name ?? code}</td>
              <td className="num">{r.units}</td>
              <td className="num">{r.occupied}</td>
              <td className="num">{r.free}</td>
              <td className="num">{r.blocked}</td>
              <td>
                <div className="occupancy-meter">
                  <meter
                    min="0"
                    max={r.units || 1}
                    value={r.occupied}
                    aria-label={`Занято ${r.occupied} из ${r.units}`}
                  />
                  <span>{r.units ? Math.round((r.occupied / r.units) * 100) : 0}%</span>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6} className="empty-state">
                На эту дату шахматка не дала сводки по категориям: категории и состав приходят из
                Exely при импорте фонда, загрузка считается по нему.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      <Help title="Расчёт загрузки">
        Загрузка = занятые единицы / весь фонд категории, включая блокировки. Номер считается одной
        единицей, койка — одной. Неназначенные проживания не занимают ячейки шахматки.
      </Help>
      <Link className="btn btn--secondary" href={`/chessboard?from=${date}&to=${date}`}>
        Открыть размещение на этот день
      </Link>
    </>
  );
}
