import Link from 'next/link';
import { Page } from '../../components/page';
export default function HelpPage() {
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
