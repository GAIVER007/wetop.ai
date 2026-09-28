import type { UnitCard } from '../../../lib/api';
import { Fact, Grid, Panel } from '../../../components/ui';
import { displayDate } from '../../../lib/display-date';
import { pluralRu } from '../../../lib/plural';
import { unitNow } from '../../../lib/unit-now';
import { HousekeepingBadge, UnitStateBadge, floorRoomText } from '../../inventory/unit-state';

type Stay = UnitCard['stays'][number];

function StayLine({ stay, living }: { stay: Stay; living: boolean }) {
  const who = stay.guestLabel || 'гость';
  return (
    <span className="unit-stay-line">
      <span>
        {living ? `живёт ${who}` : `ждём ${who}`}, выезд{' '}
        <time dateTime={stay.endDate}>{displayDate(stay.endDate, 'numeric')}</time>
      </span>
      <span className="inventory-state-note">бронь {stay.confirmationNumber}</span>
    </span>
  );
}

/**
 * Факты места для панели и карточки (ADR-107, срез I2, ТЗ §13): что это, где, на сколько гостей, в продаже ли,
 * убрано ли, кто сейчас и кто следующий (в окне карточки — 60 дней). Всё — из `GET /units/:code`,
 * отдельных запросов нет.
 */
export function UnitFacts({ unit, today }: { unit: UnitCard; today: string }) {
  const { current, next } = unitNow(unit.stays, today);
  const block = unit.blocks.find((b) => b.dateFrom <= today && today < b.dateTo) ?? null;
  const floorRoom = floorRoomText(unit);
  return (
    <Panel data-testid="unit-facts" className="unit-facts">
      <Grid min={150}>
        <Fact label="Категория" value={unit.accommodationTypeName} testId="unit-category" />
        <Fact
          label="Расположение"
          testId="unit-place"
          value={
            unit.buildingName || floorRoom ? (
              <span className="inventory-place">
                {unit.buildingName && <span>Корпус {unit.buildingName}</span>}
                {floorRoom && <span className="inventory-state-note">{floorRoom}</span>}
              </span>
            ) : (
              '—'
            )
          }
        />
        <Fact
          label="Вместимость"
          testId="unit-capacity"
          value={pluralRu(unit.capacity, ['гость', 'гостя', 'гостей'])}
        />
        <Fact
          label="Состояние"
          testId="unit-state"
          value={
            <UnitStateBadge
              active={unit.active}
              block={block && { dateTo: block.dateTo, type: block.type, reason: block.reason }}
            />
          }
        />
        <Fact
          label="Уборка"
          testId="unit-hk"
          value={<HousekeepingBadge status={unit.housekeepingStatus} />}
        />
        <Fact
          label="Сейчас"
          testId="unit-now"
          value={
            current ? (
              <StayLine stay={current} living={current.status === 'CHECKED_IN'} />
            ) : (
              'свободно'
            )
          }
        />
        <Fact
          label="Следующее проживание"
          testId="unit-next"
          value={
            next ? (
              <span className="unit-stay-line">
                <span>
                  <time dateTime={next.startDate}>{displayDate(next.startDate, 'numeric')}</time>
                  {' → '}
                  <time dateTime={next.endDate}>{displayDate(next.endDate, 'numeric')}</time>
                  {`, ${next.guestLabel || 'гость'}`}
                </span>
                <span className="inventory-state-note">бронь {next.confirmationNumber}</span>
              </span>
            ) : (
              // карточка читает проживания на 60 дней вперёд (UnitsService.card) — дальше не видно
              'нет на 60 дней вперёд'
            )
          }
        />
      </Grid>
    </Panel>
  );
}
