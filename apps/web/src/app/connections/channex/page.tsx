import Link from 'next/link';
import { Page, BackCrumb } from '../../../components/page';
import { ChannelConnectionSetup } from '../../channels/connection-setup';
export default function ChannexSettingsPage() {
  return (
    <Page
      title="Подключение каналов"
      subtitle="Соединение, webhook и настройка обмена."
      crumbs={<BackCrumb href="/connections">Подключения</BackCrumb>}
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
