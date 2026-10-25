'use client';
import { RouteDrawer } from '../../components/route-drawer';
import { ErrorState } from '../../components/error-state';
import { msg } from '../../i18n';

/** Сбой внутри выезжающей карточки остаётся в карточке: страница под ней не пропадает */
export default function DrawerError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteDrawer title={msg('Не удалось загрузить данные')}>
      <ErrorState error={error} retry={retry} />
    </RouteDrawer>
  );
}
