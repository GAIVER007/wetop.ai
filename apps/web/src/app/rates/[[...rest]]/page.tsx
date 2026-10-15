import { redirect } from 'next/navigation';

/**
 * Раздела «Тарифы и цены» больше нет (решение владельца 06.10.2026, план categories-price-2026-10-06): цена
 * категории правится в «Категориях номеров». Старые ссылки и закладки ведут туда же.
 */
export default function RatesMoved() {
  redirect('/rooms/categories');
}
