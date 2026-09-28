import Link from 'next/link';
import { unitsApi } from '../../../../../lib/api';
import { hotelToday } from '../../../../../lib/hotel-api';
import { notFoundOn404 } from '../../../../../lib/page-error';
import { RouteDrawer } from '../../../../../components/route-drawer';
import { Icon } from '../../../../../components/icon';
import { Row } from '../../../../../components/ui';
import { UnitFacts } from '../../../../units/[code]/unit-facts';
import { UnitActions } from '../../../../units/[code]/unit-actions';
import { FundEditor } from '../../../fund-editor';

/**
 * Панель места (ADR-108, срез I2, ТЗ §13): факты, «сейчас» и следующее проживание, быстрые действия —
 * шахматка, переименование комнаты, уборка и блокировки тем же блоком, что в полной карточке.
 */
export default async function UnitDrawerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const unit = await unitsApi.card(decodeURIComponent(code)).catch(notFoundOn404);
  const today = await hotelToday();
  return (
    <RouteDrawer title={`${unit.kind === 'BED' ? 'Койко-место' : 'Номер'} ${unit.code}`}>
      <div className="unit-drawer" data-testid="unit-drawer">
        <UnitFacts unit={unit} today={today} />
        <Row className="unit-drawer__links">
          <Link
            className="btn btn--secondary"
            href={`/chessboard?category=${encodeURIComponent(unit.accommodationTypeCode)}`}
          >
            <Icon name="board" />
            Показать на шахматке
          </Link>
          <FundEditor categories={[]} room={{ code: unit.code, roomNumber: unit.roomNumber }} />
          {/* обычная ссылка, не Link: мягкий переход снова попал бы в перехват и открыл панель */}
          <a className="btn btn--secondary" href={`/units/${encodeURIComponent(unit.code)}`}>
            Полная карточка
          </a>
        </Row>
        <UnitActions unit={unit} today={today} />
      </div>
    </RouteDrawer>
  );
}
