import type { MenuStation, OrderItemView, OrderView } from './food-types';

/**
 * Позиции станции (DATA_MODEL §33.6): кухня видит только KITCHEN, бар только BAR; поданные уходят с экрана. Старый
 * ответ API без станции считается кухней, без статуса считается новой позицией. Общий для серверных страниц и экранов.
 */
export function stationLines(order: OrderView, station: MenuStation): OrderItemView[] {
  return order.items.filter(
    (i) => (i.station ?? 'KITCHEN') === station && (i.status ?? 'NEW') !== 'SERVED',
  );
}
