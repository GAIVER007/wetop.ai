import { deskShell } from '../../lib/desk-shell';
import Link from 'next/link';
import { Page } from '../../components/page';
export default async function HelpPage() {
  if ((await deskShell()).vertical === 'FOOD_SERVICE') return <Page title="Помощь" subtitle="Рабочее место ресторана"><ol><li><Link href="/dining-areas">Добавьте залы, столы и периоды обслуживания</Link>.</li><li><Link href="/floor-plan">Создайте бронь или посадите гостя без брони</Link>.</li><li>Назначьте стол, подтвердите бронь, посадите гостей и завершите обслуживание.</li></ol><p>Время показывается в часовом поясе филиала. Доступ сотрудников настраивается в <Link href="/staff">«Сотрудники и доступ»</Link>.</p></Page>;
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
          <Link href="/calendar">Создайте запись в календаре</Link>. Время показывается в часовом
          поясе филиала.
        </li>
      </ol>
      <p>
        Мастер оказывает услуги клиентам. Доступ сотрудников к WETOP настраивается отдельно в
        разделе <Link href="/staff">«Сотрудники и доступ»</Link>.
      </p>
      <p>
        Если направление находится в режиме чтения, данные доступны, а изменения закрыты. Обратитесь
        к владельцу организации.
      </p>
    </Page>
  );
}
