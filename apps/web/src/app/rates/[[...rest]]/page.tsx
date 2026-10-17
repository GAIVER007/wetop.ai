import { requireFeature } from '../../../lib/vertical-guard';
import { redirect } from 'next/navigation';

/**
 * Раздела «Тарифы и цены» больше нет (решение владельца 06.10.2026, план categories-price-2026-10-06): цена
 * категории правится в «Категориях номеров». Старые ссылки и закладки ведут туда же.
 */
export default async function RatesMoved() {
  // раздел направления по реестру функций (У1): по прямой ссылке чужое направление уходит на свою стартовую
  await requireFeature('/rates');
  redirect('/rooms/categories');
}
