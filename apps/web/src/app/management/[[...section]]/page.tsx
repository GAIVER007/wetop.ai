import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, chessboardApi } from '../../../lib/api';
import { hotelToday, validDate } from '../../../lib/hotel-api';
import { navigationItems } from '../../../lib/navigation';
import { Page } from '../../../components/page';
import { SectionCards } from '../../../components/section-cards';
import { Alert, Help, Button, Field, Input, Stat, Stats, Table } from '../../../components/ui';

export default async function ManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { section = [] } = await params;
  const path = `/management${section.length ? `/${section.join('/')}` : ''}`;
  const item = navigationItems.find((item) => item.href === path);
  if (!item) notFound();
  const sp = await searchParams;
  return (
    <Page
      title={item.label}
      crumbs={section.length ? <Link href="/management">Управление отелем</Link> : undefined}
    >
      {!section.length && <SectionCards items={item.children ?? []} />}
      {section[0] === 'statistics' && <Statistics date={sp.date ?? hotelToday()} />}
      {section[0] === 'analytics' && (
        <SectionCards
          items={navigationItems.filter((i) =>
            ['/management/statistics', '/channel-manager', '/analytics'].includes(i.href),
          )}
        />
      )}
      {section[0] === 'reports' && (
        <SectionCards
          items={[
            ...navigationItems.filter((i) =>
              ['/finance', '/channel-manager', '/journal', '/incidents'].includes(i.href),
            ),
            {
              href: '/management/statistics',
              label: 'Загрузка номерного фонда',
              icon: 'bed',
              description: 'Статистика по категориям на выбранный день.',
            },
          ]}
        />
      )}
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
  const [board, inventory] = await Promise.all([
    chessboardApi.board(date, date),
    api.inventorySummary(),
  ]);
  const summary = board.summary[date];
  const rows = Object.entries(board.byCategory[date] ?? {});
  return (
    <>
      <form method="get" className="row toolbar">
        <Field label="Дата">
          <Input type="date" name="date" defaultValue={date} required />
        </Field>
        <Button type="submit">Показать</Button>
      </form>
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
      <Table>
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
              <td colSpan={6}>Нет данных по категориям.</td>
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
