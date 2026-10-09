import Link from 'next/link';
import type { InventoryUnit, UnitCard } from '../../lib/api';
import { Icon } from '../../components/icon';
import { Tabs } from '../../components/tabs';
import { Badge } from '../../components/ui';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
import { unitNow } from '../../lib/unit-now';
import { housekeepingStatus } from '../../lib/status/housekeeping';
import { UnitActions } from '../units/[code]/unit-actions';
import { FundEditor } from './fund-editor';
import { HousekeepingBadge, UnitStateBadge, floorRoomText } from './unit-state';

/**
 * Панель места по снимку владельца 09.10: фото-блок, вкладки «Информация», «Койко-места», «Бронь / Гости»,
 * «История» и быстрые действия. Всё из `GET /units/:code` и списка мест; поля, которых в карточке нет
 * (дата создания, каналы места), не выдумываются. Фото появятся в срезе F3 (нужна модель, DATA_MODEL.md).
 */
function Row({ icon, label, children, testId }: {
  icon: 'inventory' | 'guests' | 'clock' | 'check' | 'dirty' | 'rates';
  label: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="unit-field">
      <dt>
        <Icon name={icon} width={16} height={16} aria-hidden="true" />
        {label}
      </dt>
      <dd data-testid={testId}>{children}</dd>
    </div>
  );
}

export function UnitPanel({
  unit,
  today,
  roomUnits,
}: {
  unit: UnitCard;
  today: string;
  /** Места той же комнаты, включая это */
  roomUnits: InventoryUnit[];
}) {
  const { current, next } = unitNow(unit.stays, today);
  const block = unit.blocks.find((b) => b.dateFrom <= today && today < b.dateTo) ?? null;
  const floorRoom = floorRoomText(unit);
  const place = [unit.buildingName && `Корпус ${unit.buildingName}`, floorRoom]
    .filter(Boolean)
    .join(', ');
  const info = (
    <div className="unit-tab">
      <dl className="unit-fields">
        <Row icon="inventory" label="Категория" testId="unit-category">
          {unit.accommodationTypeName}
        </Row>
        <Row icon="rates" label="Расположение" testId="unit-place">
          {place ? (
            <span className="inventory-place">
              {unit.buildingName && <span>Корпус {unit.buildingName}</span>}
              {floorRoom && <span className="inventory-state-note">{floorRoom}</span>}
            </span>
          ) : (
            '—'
          )}
        </Row>
        <Row icon="guests" label="Вместимость" testId="unit-capacity">
          {pluralRu(unit.capacity, ['гость', 'гостя', 'гостей'])}
        </Row>
        <Row icon="check" label="Статус продажи" testId="unit-state">
          <UnitStateBadge
            active={unit.active}
            block={block && { dateTo: block.dateTo, type: block.type, reason: block.reason }}
          />
        </Row>
        <Row icon="dirty" label="Состояние уборки" testId="unit-hk">
          <HousekeepingBadge status={unit.housekeepingStatus} />
        </Row>
      </dl>
      <h3 className="unit-subhead">Быстрые действия</h3>
      <div className="unit-quick">
        <FundEditor categories={[]} room={{ code: unit.code, roomNumber: unit.roomNumber }} />
        <Link
          className="btn btn--secondary"
          href={`/reservations/new?unit=${encodeURIComponent(unit.code)}`}
        >
          <Icon name="booking" />
          Создать бронь
        </Link>
        <Link
          className="btn btn--secondary"
          href={`/chessboard?category=${encodeURIComponent(unit.accommodationTypeCode)}`}
        >
          <Icon name="board" />
          Показать в календаре
        </Link>
        {/* обычная ссылка, не Link: мягкий переход снова попал бы в перехват и открыл панель */}
        <a className="btn btn--secondary" href={`/units/${encodeURIComponent(unit.code)}`}>
          Полная карточка
        </a>
      </div>
      <h3 className="unit-subhead">Уборка и блокировки</h3>
      <UnitActions unit={unit} today={today} />
    </div>
  );
  const beds = (
    <div className="unit-tab">
      <p className="sub">
        {unit.kind === 'BED'
          ? 'Койко-места этой комнаты'
          : `Места комнаты ${unit.roomNumber}`}
      </p>
      <ul className="unit-list">
        {roomUnits.map((u) => (
          <li key={u.code} aria-current={u.code === unit.code ? 'true' : undefined}>
            <Icon name={u.kind === 'BED' ? 'bed' : 'inventory'} width={16} height={16} />
            <strong>{u.code}</strong>
            {!u.active ? (
              <Badge>В архиве</Badge>
            ) : u.block ? (
              <Badge tone="danger">Недоступно</Badge>
            ) : (
              <Badge tone="ok">В продаже</Badge>
            )}
            <HousekeepingBadge status={u.housekeepingStatus} />
          </li>
        ))}
      </ul>
    </div>
  );
  const stayLine = (s: UnitCard['stays'][number]) => (
    <>
      <time dateTime={s.startDate}>{displayDate(s.startDate, 'numeric')}</time>
      {' → '}
      <time dateTime={s.endDate}>{displayDate(s.endDate, 'numeric')}</time>
      {`, ${s.guestLabel || 'гость'}`}
      <span className="inventory-state-note"> бронь {s.confirmationNumber}</span>
    </>
  );
  const guests = (
    <div className="unit-tab">
      <dl className="unit-fields">
        <Row icon="guests" label="Сейчас" testId="unit-now">
          {current
            ? `${current.status === 'CHECKED_IN' ? 'живёт' : 'ждём'} ${current.guestLabel || 'гость'}, выезд ${displayDate(current.endDate, 'numeric')}`
            : 'свободно'}
          {current && (
            <span className="inventory-state-note"> бронь {current.confirmationNumber}</span>
          )}
        </Row>
        <Row icon="clock" label="Следующее проживание" testId="unit-next">
          {next ? stayLine(next) : 'нет на 60 дней вперёд'}
        </Row>
      </dl>
    </div>
  );
  const history = (
    <div className="unit-tab">
      {unit.housekeepingHistory.length === 0 ? (
        <p className="sub">Смен статуса уборки пока не было.</p>
      ) : (
        <ul className="unit-list" aria-label="История уборки">
          {unit.housekeepingHistory.map((e) => (
            <li key={e.at}>
              <time dateTime={e.at}>{displayDate(e.at.slice(0, 10), 'numeric')}</time>
              {housekeepingStatus[e.from as keyof typeof housekeepingStatus]?.label ?? e.from}
              {' → '}
              {housekeepingStatus[e.to as keyof typeof housekeepingStatus]?.label ?? e.to}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <div className="unit-drawer unit-panel" data-testid="unit-drawer">
      <div className="unit-photo" role="img" aria-label="Фото места ещё не добавлены">
        <Icon name="bed" width={40} height={40} />
        <span>Фото ещё не добавлены</span>
      </div>
      <p className="sub unit-panel-sub">
        {unit.accommodationTypeName}
        {' · '}
        {unit.kind === 'BED' ? 'койко-место' : 'номер'}
      </p>
      <Tabs
        label="Разделы места"
        panels={[
          { id: 'info', label: 'Информация', content: info },
          { id: 'beds', label: 'Койко-места', content: beds, count: roomUnits.length },
          { id: 'guests', label: 'Бронь / Гости', content: guests },
          { id: 'history', label: 'История', content: history },
        ]}
      />
    </div>
  );
}
