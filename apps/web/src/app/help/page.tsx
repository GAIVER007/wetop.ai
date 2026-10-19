import { deskShell } from '../../lib/desk-shell';
import Link from 'next/link';
import { Page } from '../../components/page';
import { hotelApi } from '../../lib/hotel-api';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { SupportBlock } from './support-block';

/** Название филиала для начала сообщения в поддержку; оба запроса уже сделал макет (`cache`), новых рейсов нет */
async function branchName(vertical: string): Promise<string | null> {
  if (vertical === 'HOSPITALITY') return (await hotelApi.settings().catch(() => null))?.property.name ?? null;
  return (await selectedWorkspaceBranch().catch(() => null))?.name ?? null;
}

/** Первые шаги по направлению филиала: у каждого свои разделы, справка другого направления сбивает (F5 плана DS2) */
export default async function HelpPage() {
  const { vertical, scopeKey } = await deskShell();
  if (!scopeKey) return (
    <Page title="Помощь" subtitle="Выберите филиал">
      <p>Выберите филиал, чтобы открыть инструкции для его направления.</p>
      <Link href="/branches">Выбрать филиал</Link>
      <p>Данные можно просматривать в режиме чтения. Вход и выход доступны через меню профиля.</p>
      <SupportBlock />
    </Page>
  );
  const support = <SupportBlock branch={await branchName(vertical)} />;
  const access = (
    <p>
      Время показывается в часовом поясе филиала. Доступ сотрудников к WETOP настраивается в разделе{' '}
      <Link href="/team">«Сотрудники и доступ»</Link>.
    </p>
  );
  if (vertical === 'FOOD_SERVICE')
    return (
      <Page title="Помощь" subtitle="Начало работы в ресторане">
        <ol>
          <li>
            <Link href="/dining-areas">Добавьте залы, столы и периоды обслуживания</Link>.
          </li>
          <li>
            <Link href="/menu">Заполните меню</Link>: категории, блюда и цены.
          </li>
          <li>
            <Link href="/floor-plan">Создайте бронь или посадите гостей без брони</Link>, затем откройте
            заказ на стол.
          </li>
        </ol>
        {access}
        {support}
      </Page>
    );
  if (vertical === 'BEAUTY')
    return (
      <Page title="Помощь" subtitle="Начало работы в салоне">
        <ol>
          <li>
            <Link href="/services">Добавьте услугу</Link> и включите её в нужном филиале.
          </li>
          <li>
            <Link href="/employees">Добавьте мастера</Link>, назначьте услуги, филиалы и рабочие часы.
          </li>
          <li>
            <Link href="/calendar">Создайте запись в календаре</Link>.
          </li>
        </ol>
        {access}
        <p>
          Если направление находится в режиме чтения, данные доступны, а изменения закрыты.
          Обратитесь к владельцу организации.
        </p>
        {support}
      </Page>
    );
  return (
    <Page title="Помощь" subtitle="Начало работы в гостинице">
      <ol>
        <li>
          <Link href="/rooms/categories">Проверьте категории номеров</Link>: состав, вместимость и цену.
        </li>
        <li>
          <Link href="/inventory">Проверьте номерной фонд</Link>: номера и койки, которые продаются.
        </li>
        <li>
          <Link href="/reservations/new">Создайте первую бронь</Link> и найдите её в{' '}
          <Link href="/chessboard">календаре</Link>.
        </li>
        <li>
          <Link href="/channels">Подключите каналы продаж</Link>, чтобы брони с площадок приходили
          сами.
        </li>
      </ol>
      {access}
      {support}
    </Page>
  );
}
