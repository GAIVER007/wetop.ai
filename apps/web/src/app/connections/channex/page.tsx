import { requireFeature } from '../../../lib/vertical-guard';
import { Page, BackCrumb } from '../../../components/page';
import { ChannelConnectionSetup } from '../../channels/connection-setup';
import { ChannelTabs } from '../../channels/tabs';
import { serverT } from '../../../i18n/server';
export default async function ChannexSettingsPage() {
  // гостиничный экран: салон и ресторан по прямому адресу уходят на свою стартовую (DS2 F1, как `/reports`)
  await requireFeature('/connections/channex');
  const t = await serverT();
  return (
    <Page
      title={t('Подключение каналов')}
      subtitle={t('Соединение, webhook и настройка обмена.')}
      crumbs={<BackCrumb href="/connections">{t('Подключения')}</BackCrumb>}
    >
      <ChannelTabs current="connections" />
      <ChannelConnectionSetup />
    </Page>
  );
}
