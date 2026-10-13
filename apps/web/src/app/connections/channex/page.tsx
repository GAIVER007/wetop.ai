import { Page, BackCrumb } from '../../../components/page';
import { ChannelConnectionSetup } from '../../channels/connection-setup';
import { ChannelTabs } from '../../channels/tabs';
export default function ChannexSettingsPage() {
  return (
    <Page
      title="Подключение каналов"
      subtitle="Соединение, webhook и настройка обмена."
      crumbs={<BackCrumb href="/connections">Подключения</BackCrumb>}
    >
      <ChannelTabs current="connections" />
      <ChannelConnectionSetup />
    </Page>
  );
}
