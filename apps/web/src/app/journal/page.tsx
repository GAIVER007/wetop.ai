import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { almatyStamp } from '../../lib/almaty';
import { getJsonPublic } from '../../lib/api';
import { Page } from '../../components/page';
import { Table, Input, Button } from '../../components/ui';

interface AuditRow {
  id: string;
  at: string;
  entityType: string;
  entityId: string;
  action: string;
  subject: string | null;
  /** Имя вошедшего; null — система: импорт, сторож, скрипт сверки (ADR-023, ADR-046) */
  author: string | null;
}
const ACTION_RU: Record<string, string> = {
  'reservation.create': 'бронь создана',
  'reservation.changeDates': 'даты изменены',
  'reservation.cancel': 'бронь отменена',
  'reservation.assign': 'ячейка назначена / переселение',
  'reservation.checkIn': 'заселение',
  'reservation.checkOut': 'выезд',
  'reservation.noShow': 'незаезд',
  'channex.booking.new': 'бронь из канала',
  'channex.booking.modified': 'бронь из канала изменена',
  'channex.booking.cancelled': 'бронь из канала отменена',
  'channex.setup': 'Channex: объект и категории',
  'channex.fullSync': 'Channex: полная выгрузка',
  'rates.bulk': 'цены / ограничения изменены',
  'unit.block': 'ячейка заблокирована',
  'unit.unblock': 'блокировка снята',
  'unit.housekeeping': 'статус уборки',
  'guest.update': 'карточка гостя изменена',
  'guest.document.add': 'документ гостя добавлен',
  'guest.document.delete': 'документ гостя удалён',
  'reservations.import': 'импорт броней из Exely',
  'analytics.site.create': 'сайт со счётчиком добавлен',
  'analytics.site.update': 'сайт со счётчиком изменён',
  'analytics.site.delete': 'сайт со счётчиком удалён',
  'exely.sync': 'синхронизация с Exely',
  'user.login': 'вход в систему',
  'user.logout': 'выход из системы',
  'user.password.changed': 'пароль изменён',
  'user.invited': 'сотрудник приглашён',
  'user.created': 'сотрудник добавлен',
  'user.blocked': 'сотрудник заблокирован',
  'user.unblocked': 'сотрудник разблокирован',
};
const FILTERS: ReadonlyArray<readonly [type: string | null, label: string]> = [
  [null, 'все'],
  ['Reservation', 'брони'],
  ['InventoryUnit', 'ячейки'],
  ['Guest', 'гости'],
  ['Property', 'объект и каналы'],
  ['TrackedSite', 'сайт'],
  ['user', 'сотрудники'],
];

/** Журнал действий администратора и интеграций (SECURITY §6). Без ПД. */
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { type, q, system } = normalizeSearchParams(await searchParams);
  const showSystem = system === '1';
  // Поиск и фильтр — в API по всей истории: синхронизация Exely пишет строку каждые 5 минут, и 200 последних
  // строк покрывали меньше суток — «История» брони была пустой (волна 3)
  const query = new URLSearchParams({
    limit: '200',
    ...(type ? { entityType: type } : {}),
    ...(q?.trim() ? { q: q.trim() } : {}),
    ...(showSystem ? { system: '1' } : {}),
  });
  const rows = await getJsonPublic<AuditRow[]>(`/audit?${query}`);
  return (
    <Page
      title="Журнал действий"
      actions={FILTERS.map(([t, label]) => (
        <Link
          key={label}
          href={`/journal?${new URLSearchParams({ ...(t ? { type: t } : {}), ...(q ? { q } : {}), ...(showSystem ? { system: '1' } : {}) })}`}
          className={(t ?? undefined) === type ? 'bold' : undefined}
        >
          {label}
        </Link>
      ))}
    >
      <form method="get" className="directory-toolbar">
        <Input
          name="q"
          aria-label="Поиск в журнале"
          placeholder="Номер брони"
          defaultValue={q ?? ''}
        />
        <input name="type" type="hidden" value={type ?? ''} />
        <label className="check">
          <input type="checkbox" name="system" value="1" defaultChecked={showSystem} /> служебные
          (синхронизация Exely)
        </label>
        <Button tone="secondary">Найти</Button>
        <span className="muted small">
          {q?.trim() ? 'Поиск по всей истории' : 'Последние операции'} · до 200 строк
        </span>
      </form>
      <Table size="sm" nowrap data-testid="journal-table">
        <thead>
          <tr>
            {['Когда (Алматы)', 'Кто', 'Действие', 'Объект', 'Что'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-testid="journal-row">
              <td>{almatyStamp(r.at)}</td>
              <td>{r.author ?? <span className="muted-2">система</span>}</td>
              <td>{ACTION_RU[r.action] ?? r.action}</td>
              <td>{r.entityType}</td>
              <td>
                {r.subject && r.entityType === 'Reservation' ? (
                  <Link href={`/reservations/${encodeURIComponent(r.subject)}`}>{r.subject}</Link>
                ) : (
                  (r.subject ?? <span className="muted-2">{r.entityId.slice(0, 8)}…</span>)
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-state">
                Нет операций по выбранным условиям
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Page>
  );
}
