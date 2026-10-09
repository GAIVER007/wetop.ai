import { requireVertical } from '../../../../../lib/vertical-guard';
import { api, unitsApi } from '../../../../../lib/api';
import { hotelToday } from '../../../../../lib/hotel-api';
import { notFoundOn404 } from '../../../../../lib/page-error';
import { RouteDrawer } from '../../../../../components/route-drawer';
import { UnitPanel } from '../../../unit-panel';

/**
 * Панель места (ADR-108, срез I2, ТЗ §13; вид по снимку владельца 09.10): вкладки, быстрые действия,
 * уборка и блокировки тем же блоком, что в полной карточке.
 */
export default async function UnitDrawerPage({ params }: { params: Promise<{ code: string }> }) {
  await requireVertical(['HOSPITALITY']);
  const { code } = await params;
  const unit = await unitsApi.card(decodeURIComponent(code)).catch(notFoundOn404);
  const today = await hotelToday();
  const roomUnits = await api
    .inventoryUnits()
    .then((all) => all.filter((u) => u.roomNumber === unit.roomNumber))
    .catch(() => []);
  return (
    <RouteDrawer title={`${unit.kind === 'BED' ? 'Койко-место' : 'Номер'} ${unit.code}`}>
      <UnitPanel unit={unit} today={today} roomUnits={roomUnits} />
    </RouteDrawer>
  );
}
