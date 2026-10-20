import { requireFeature } from '../../../lib/vertical-guard';
import { Page, BackCrumb } from '../../../components/page';
import { ChannelConnectionSetup } from '../../channels/connection-setup';
import { ChannelTabs } from '../../channels/tabs';
export default async function ChannexSettingsPage() {
  // гостиничный экран: салон и ресторан по прямому адресу уходят на свою стартовую (DS2 F1, как `/reports`)
  await requireFeature('/connections/channex');
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
