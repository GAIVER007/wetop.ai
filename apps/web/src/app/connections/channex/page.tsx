import Link from 'next/link';
import { Page } from '../../../components/page';
import { ChannelConnectionSetup } from '../../channels/connection-setup';
export default function ChannexSettingsPage() {
  return (
    <Page
      title="Подключение каналов"
      subtitle="Соединение, webhook и настройка обмена."
      crumbs={<Link href="/connections">Подключения</Link>}
    >
      <nav className="settings-tabs" aria-label="Настройка каналов">
        <Link href="/channels">Статистика продаж</Link>
        <Link href="/channels/mapping">Сопоставление категорий и тарифов</Link>
        <Link href="/channels/sync">Очередь обмена</Link>
        <Link href="/channels/events">События</Link>
      </nav>
      <ChannelConnectionSetup />
    </Page>
  );
}
