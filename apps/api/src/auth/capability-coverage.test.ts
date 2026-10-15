import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { BUSINESS_CAPABILITY } from './capability.decorator';
import { RatesController } from '../rates/rates.controller';
import { RatePlansController, ReservationsController } from '../reservations/reservations.controller';
import { GuestsController, PiiStorageController } from '../guests/guests.controller';
import { UnitsController } from '../units/units.controller';
import { InventoryController } from '../inventory/inventory.controller';
import { ChessboardController } from '../chessboard/chessboard.controller';
import { ChannelsController } from '../channels/channels.controller';

/**
 * CORE-01 (U1): страж покрытия капабилити. route-access.test.ts следит только за `@Access`,
 * и снятие `@RequiresBusinessCapability` с гостиничного контроллера прошло бы незамеченным:
 * ресторанный или салонный scope получил бы 404 вместо честного 403, а организационный scope
 * тихо работал бы по раннему Property. Этот тест закрепляет, какие гостиничные контроллеры
 * обязаны нести капабилити и какую именно.
 */
describe('капабилити гостиничных контроллеров закреплены', () => {
  const EXPECTED: Array<[string, { new (...args: never[]): unknown }, string]> = [
    ['rates', RatesController, 'hospitality.rates'],
    ['reservations', ReservationsController, 'hospitality.reservations'],
    ['rate-plans', RatePlansController, 'hospitality.reservations'],
    ['guests', GuestsController, 'hospitality.reservations'],
    ['pii-storage', PiiStorageController, 'hospitality.reservations'],
    ['units', UnitsController, 'hospitality.inventory'],
    ['inventory', InventoryController, 'hospitality.inventory'],
    ['chessboard', ChessboardController, 'hospitality.reservations'],
    ['channels', ChannelsController, 'hospitality.channels'],
  ];
  it('каждый контроллер несёт свою вертикальную капабилити', () => {
    const actual = EXPECTED.map(([name, controller]) => [
      name,
      Reflect.getMetadata(BUSINESS_CAPABILITY, controller) ?? null,
    ]);
    expect(actual).toEqual(EXPECTED.map(([name, , capability]) => [name, capability]));
  });
});
