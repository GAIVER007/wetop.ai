import { RouteDrawer } from '../../../../../components/route-drawer';
import { GuestPreview } from '../../../../guests/guest-preview';

/** Панель предпросмотра гостя поверх списка (G3): Escape и крестик возвращают в /guests с фильтрами */
export default async function GuestPreviewDrawer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RouteDrawer title="Гость">
      <GuestPreview id={id} />
    </RouteDrawer>
  );
}
