'use client';
import { RouteDrawer } from '../../../components/route-drawer';
import { ErrorState } from '../../../components/error-state';
import { msg } from '../../../i18n';

/** Сбой внутри панели места остаётся в панели: фонд под ней не пропадает */
export default function UnitDrawerError({
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
