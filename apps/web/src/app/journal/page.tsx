import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { Fragment } from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ControlNavigation } from '../../components/control-navigation';
import { RefreshButton } from '../../components/refresh-button';
import { hotelClock } from '../../lib/hotel-api';
import { dayTitle } from './journal-view';
import { getJsonPublic } from '../../lib/api';
import { pluralRu } from '../../lib/plural';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { Table, Input, Button, Field, EmptyState, Panel, cx } from '../../components/ui';
import { Icon } from '../../components/icon';
import '../directory.css';

interface AuditRow {
  id: string;
  at: string;
  entityType: string;
  entityId: string;
  action: string;
  subject: string | null;
  /** false означает, что audit trail сохранён, но сама бронь уже удалена */
  targetAvailable: boolean | null;
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
  // сотрудники и расширения организации (ADR-100, ADR-083): строки пишутся на организацию
  'membership.removed': 'сотрудник отключён',
  'membership.role.updated': 'роль сотрудника изменена',
  'extension.updated': 'расширение изменено',
};
const FILTERS: ReadonlyArray<readonly [type: string | null, label: string]> = [
  [null, 'все'],
  ['Reservation', 'брони'],
  ['InventoryUnit', 'ячейки'],
  ['Guest', 'гости'],
  ['Property', 'объект и каналы'],
  ['TrackedSite', 'сайт'],
  ['user', 'сотрудники'],
  ['organization', 'организация'],
];
/** Сколько строк просим у API: поиск и отбор идут по всей истории, наружу — не больше этого */
const LIMIT = 200;

/**
 * Журнал действий администратора и интеграций (SECURITY §6). Без ПД.
 * D4 (план владельца 19.09): выборка названа словами, разделы — чипами как в «Бронях», отказ API не уносит
 * экран (форма и раздел остаются, вместо строк `LoadError`), пустой результат называет условие и путь к «все»,
 * время в `<time>`, на телефоне строка складывается в карточку. Сам запрос к API и его пределы не менялись.
 */
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { type, q, system } = normalizeSearchParams(await searchParams);
  const showSystem = system === '1';
  const needle = q?.trim() ?? '';
  // Поиск и фильтр — в API по всей истории: синхронизация Exely пишет строку каждые 5 минут, и 200 последних
  // строк покрывали меньше суток — «История» брони была пустой (волна 3)
  const query = new URLSearchParams({
    limit: String(LIMIT),
    ...(type ? { entityType: type } : {}),
    ...(needle ? { q: needle } : {}),
    ...(showSystem ? { system: '1' } : {}),
  });
  const href = (next: { type?: string | null; q?: string; system?: boolean }) => {
    const t = next.type === undefined ? type : next.type;
    const s = next.q === undefined ? needle : next.q;
    const sys = next.system === undefined ? showSystem : next.system;
    const u = new URLSearchParams({
      ...(t ? { type: t } : {}),
      ...(s ? { q: s } : {}),
      ...(sys ? { system: '1' } : {}),
    });
    const str = u.toString();
    return str ? `/journal?${str}` : '/journal';
  };
  const sectionLabel = FILTERS.find(([t]) => (t ?? undefined) === type)?.[1];
  const conditions = [
    needle ? `по запросу «${needle}»` : '',
    type ? `раздел «${sectionLabel ?? type}»` : '',
    showSystem ? 'со служебными' : '',
  ].filter(Boolean);
  return (
    <Page
      title="Журнал действий"
      subtitle="Кто и когда изменял данные гостиницы."
      actions={<RefreshButton />}
    >
      <ControlNavigation current="journal" />
      <form method="get" className="control-toolbar control-journal-search">
        <Field label="Поиск в журнале">
          <Input
            key={`q-${needle}`}
            name="q"
            aria-label="Поиск в журнале"
            placeholder="Номер брони"
            defaultValue={needle}
          />
        </Field>
        <input name="type" type="hidden" value={type ?? ''} />
        <label className="check">
          <input
            key={`system-${showSystem}`}
            type="checkbox"
            name="system"
            value="1"
            defaultChecked={showSystem}
          />{' '}
          Служебные события
        </label>
        <Button tone="secondary">Найти</Button>
        {(needle || type || showSystem) && (
          <Link href="/journal" className="btn btn--ghost">
            Сбросить фильтры
          </Link>
        )}
      </form>
      <nav className="chips" aria-label="Раздел журнала">
        {FILTERS.map(([t, label]) => (
          <Link
            key={label}
            href={href({ type: t })}
            className={cx((t ?? undefined) === type && 'is-active')}
            aria-current={(t ?? undefined) === type ? 'true' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Suspense
        key={query.toString()}
        fallback={
          <Panel role="status" data-testid="journal-loading">
            Загружаем журнал действий…
          </Panel>
        }
      >
        <JournalEntries
          query={query.toString()}
          conditions={conditions}
          filtered={!!needle || !!type}
          searching={!!needle}
        />
      </Suspense>
    </Page>
  );
}

const ENTITY_RU: Record<string, string> = {
  Reservation: 'Бронь',
  InventoryUnit: 'Номер / койка',
  Guest: 'Гость',
  Property: 'Гостиница',
  TrackedSite: 'Сайт',
  user: 'Сотрудник',
};

async function JournalEntries({
  query,
  conditions,
  filtered,
  searching,
}: {
  query: string;
  conditions: string[];
  filtered: boolean;
  searching: boolean;
}) {
  // день «сегодня» считает сервер по часам объекта: страница серверная, расхождения гидрации нет
  const clock = await hotelClock();
  const today = clock.today();
  const loaded = await getJsonPublic<AuditRow[]>(`/audit?${query}`).then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => ({ ok: false as const, e }),
  );
  const rows = loaded.ok ? loaded.r : null;
  const meta = rows
    ? `${rows.length >= LIMIT ? `Последние ${LIMIT} операций` : filtered ? pluralRu(rows.length, ['операция', 'операции', 'операций']) : `Последние ${pluralRu(rows.length, ['операция', 'операции', 'операций'])}`}${conditions.length ? `, ${conditions.join(', ')}` : ''}${searching ? ' (поиск по всей истории)' : ''}`
    : null;
  return (
    <div className="control-page">
      {meta && (
        <p className="directory-meta" data-testid="journal-meta">
          {meta}
        </p>
      )}
      {!loaded.ok && <LoadError testId="journal-error" {...loadErrorProps(loaded.e)} />}
      {rows && rows.length > 0 && (
        <Table
          size="sm"
          nowrap
          className="dir-table dir-table--journal control-table"
          data-testid="journal-table"
        >
          <thead>
            <tr>
              {['Когда', 'Кто', 'Что сделали', 'Объект'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              // день пишем один раз на группу: до 21.09 полная дата с годом стояла в каждой строке и
              // делала «Когда» самой широкой колонкой экрана
              const newDay = i === 0 || clock.date(r.at) !== clock.date(rows[i - 1]!.at);
              return (
                <Fragment key={r.id}>
                  {newDay && (
                    <tr className="journal-day">
                      <th colSpan={4} scope="colgroup" data-testid="journal-day">
                        {dayTitle(r.at, today, clock)}
                      </th>
                    </tr>
                  )}
                  <tr data-testid="journal-row">
                    <td className="journal-time">
                      <time dateTime={r.at}>{clock.clock(r.at)}</time>
                    </td>
                    <td>{r.author ?? <span className="muted-2">система</span>}</td>
                    <td>{ACTION_RU[r.action] ?? r.action}</td>
                    <td>
                      <span className="muted-2">{ENTITY_RU[r.entityType] ?? r.entityType}</span>
                      {r.subject && ' '}
                      {r.subject &&
                        (r.entityType === 'Reservation' && r.targetAvailable !== false ? (
                          <Link href={`/reservations/${encodeURIComponent(r.subject)}`}>
                            {r.subject}
                          </Link>
                        ) : (
                          r.subject
                        ))}
                      {r.entityType === 'Reservation' && r.subject && r.targetAvailable === false && (
                        <span className="muted-2"> (удалена)</span>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      )}
      {rows?.length === 0 && (
        <EmptyState
          icon={<Icon name="journal" />}
          title={conditions.length ? 'По этим условиям операций нет' : 'Операций пока нет'}
          data-testid="journal-empty"
          actions={
            conditions.length ? (
              <Link href="/journal" className="btn btn--secondary">
                Показать последние операции
              </Link>
            ) : undefined
          }
        >
          {conditions.length
            ? `Ничего не нашлось ${conditions.join(', ')}. Поиск идёт по всей истории, а не только по показанным строкам.`
            : 'Журнал заполняется действиями стойки и интеграций — заселение, оплата, брони из каналов.'}
        </EmptyState>
      )}
    </div>
  );
}
