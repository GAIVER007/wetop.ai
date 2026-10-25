'use client';
import type { UnitCard } from '../../../lib/api';
import { Fact, Grid, Panel } from '../../../components/ui';
import { displayDate } from '../../../lib/display-date';
import { countLabel, msg } from '../../../i18n';
import { useLocale, useT } from '../../../i18n/locale-provider';
import { unitNow } from '../../../lib/unit-now';
import { HousekeepingBadge, UnitStateBadge, buildingText, floorRoomText } from '../../inventory/unit-state';

type Stay = UnitCard['stays'][number];

function StayLine({ stay, living }: { stay: Stay; living: boolean }) {
  const t = useT();
  const who = stay.guestLabel || t('гость');
  return (
    <span className="unit-stay-line">
      <span>
        {t(living ? msg('живёт {guest}, выезд') : msg('ждём {guest}, выезд'), { guest: who })}{' '}
        <time dateTime={stay.endDate}>{displayDate(stay.endDate, 'numeric')}</time>
      </span>
      <span className="inventory-state-note">{t('бронь {n}', { n: stay.confirmationNumber })}</span>
    </span>
  );
}

/**
 * Факты места для панели и карточки (ADR-108, срез I2, ТЗ §13): что это, где, на сколько гостей, в продаже ли,
 * убрано ли, кто сейчас и кто следующий (в окне карточки — 60 дней). Всё — из `GET /units/:code`,
 * отдельных запросов нет.
 */
export function UnitFacts({ unit, today }: { unit: UnitCard; today: string }) {
  const t = useT();
  const locale = useLocale();
  const { current, next } = unitNow(unit.stays, today);
  const block = unit.blocks.find((b) => b.dateFrom <= today && today < b.dateTo) ?? null;
  const floorRoom = floorRoomText(unit, t);
  return (
    <Panel data-testid="unit-facts" className="unit-facts">
      <Grid min={150}>
        <Fact label={t('Категория')} value={unit.accommodationTypeName} testId="unit-category" />
        <Fact
          label={t('Расположение')}
          testId="unit-place"
          value={
            unit.buildingName || floorRoom ? (
              <span className="inventory-place">
                {unit.buildingName && <span>{buildingText(unit.buildingName, t)}</span>}
                {floorRoom && <span className="inventory-state-note">{floorRoom}</span>}
              </span>
            ) : (
              '—'
            )
          }
        />
        <Fact
          label={t('Вместимость')}
          testId="unit-capacity"
          value={countLabel(locale, t, unit.capacity, [msg('гость'), msg('гостя'), msg('гостей')])}
        />
        <Fact
          label={t('Состояние')}
          testId="unit-state"
          value={
            <UnitStateBadge
              active={unit.active}
              block={block && { dateTo: block.dateTo, type: block.type, reason: block.reason }}
            />
          }
        />
        <Fact
          label={t('Уборка')}
          testId="unit-hk"
          value={<HousekeepingBadge status={unit.housekeepingStatus} />}
        />
        <Fact
          label={t('Сейчас')}
          testId="unit-now"
          value={
            current ? (
              <StayLine stay={current} living={current.status === 'CHECKED_IN'} />
            ) : (
              t('свободно')
            )
          }
        />
        <Fact
          label={t('Следующее проживание')}
          testId="unit-next"
          value={
            next ? (
              <span className="unit-stay-line">
                <span>
                  <time dateTime={next.startDate}>{displayDate(next.startDate, 'numeric')}</time>
                  {' → '}
                  <time dateTime={next.endDate}>{displayDate(next.endDate, 'numeric')}</time>
                  {`, ${next.guestLabel || t('гость')}`}
                </span>
                <span className="inventory-state-note">{t('бронь {n}', { n: next.confirmationNumber })}</span>
              </span>
            ) : (
              // карточка читает проживания на 60 дней вперёд (UnitsService.card) — дальше не видно
              t('нет на 60 дней вперёд')
            )
          }
        />
      </Grid>
    </Panel>
  );
}
