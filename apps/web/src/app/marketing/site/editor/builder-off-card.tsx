import { supportContacts } from '../../../../lib/support-contacts';
import { ConnectBuilder } from './connect-builder';

/**
 * Конструктор не подключён у филиала без сайта. Было (аудит 21.10.2026 п. 4): карточка с «Попросить подключить» в
 * поддержку. Стало (владелец 29.10.2026: «убери заглушку, открывай окно подключения и настройки»): кнопка
 * «Подключить» открывает окно; главный администратор WETOP подключает прямо в нём, остальным окно даёт написать в WETOP.
 */
export function BuilderOffCard({
  locationName,
  expired = false,
  canConnect,
  organizationId,
  locationId,
}: {
  locationName: string;
  expired?: boolean;
  canConnect: boolean;
  organizationId: string | null;
  locationId: string | null;
}) {
  const contacts = supportContacts(process.env, locationName);
  return (
    <ConnectBuilder
      locationName={locationName}
      expired={expired}
      canConnect={canConnect}
      organizationId={organizationId}
      locationId={locationId}
      supportHref={contacts?.whatsapp ?? '/help#support'}
    />
  );
}
