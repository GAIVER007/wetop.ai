import { requireVertical } from '../../../../../lib/vertical-guard';
import { api, unitsApi } from '../../../../../lib/api';
import { hotelClock } from '../../../../../lib/hotel-api';
import { notFoundOn404 } from '../../../../../lib/page-error';
import { DockedPanel } from '../../../docked-panel';
import { channelMarks } from '../../../channel-marks';
import { UnitPanel } from '../../../unit-panel';

/**
 * Панель места (ADR-108, срез I2, ТЗ §13; вид по снимку владельца 09.10): вкладки, быстрые действия,
 * уборка и блокировки тем же блоком, что в полной карточке.
 */
export default async function UnitDrawerPage({ params }: { params: Promise<{ code: string }> }) {
  await requireVertical(['HOSPITALITY']);
  const { code } = await params;
  const unit = await unitsApi.card(decodeURIComponent(code)).catch(notFoundOn404);
  const clock = await hotelClock();
  const today = clock.today();
  const marks = await channelMarks();
  const roomUnits = await api
    .inventoryUnits()
    .then((all) => all.filter((u) => u.roomNumber === unit.roomNumber))
    .catch(() => []);
  const photos = await api
    .inventoryPhotos()
    .then((all) => all[unit.accommodationTypeCode] ?? [])
    .catch(() => []);
  return (
    <DockedPanel title={`${unit.kind === 'BED' ? 'Койко-место' : 'Номер'} ${unit.code}`}>
      <UnitPanel
        unit={unit}
        today={today}
        roomUnits={roomUnits}
        photos={photos}
        createdAt={clock.full(unit.createdAt)}
        updatedAt={clock.full(unit.updatedAt)}
        channels={marks.mapped.includes(unit.accommodationTypeCode) ? marks.channels : []}
      />
    </DockedPanel>
  );
}
