import { requireFeature } from '../../lib/vertical-guard';
import './fund.css';
import Link from 'next/link';
import { api, inventoryEditorApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { countLabel, msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import { AddMenu } from './add-menu';
import { channelMarks } from './channel-marks';
import { InventoryCatalog } from './inventory-catalog';
import { InventorySummaryLine } from './summary-tiles';
import './inventory.css';
import { deskShell } from '../../lib/desk-shell';
import { mayAccess } from '../../lib/navigation';

/** Состав фонда из API; занятость и команды остаются в календаре и карточке места. */
export default async function InventoryPage() {
  await requireFeature('/inventory');
  const [t, locale] = await Promise.all([serverT(), currentLocale()]);
  const [summary, units, categories, occupancy, marks, shell] = await Promise.all([
    api.inventorySummary(),
    api.inventoryUnits(),
    inventoryEditorApi.categories(),
    api.inventoryOccupancy().catch(() => []),
    channelMarks(),
    deskShell(),
  ]);
  const canEditCatalog = mayAccess(shell.access, 'property') && !shell.readOnly;
  const canHousekeeping = mayAccess(shell.access, 'desk') && !shell.readOnly;
  return (
    <Page
      title={t('Номерной фонд')}
      subtitle={
        summary.totalUnits
          ? `${summary.property.name}, ${countLabel(locale, t, summary.totalUnits, [msg('место'), msg('места'), msg('мест')])}`
          : summary.property.name
      }
      actions={
        <>
          {canEditCatalog && <AddMenu categories={categories} />}
          <Link href="/rooms/categories" className="btn btn--secondary">
            <Icon name="rates" />
            {t('Категории')}
          </Link>
          <Link href="/chessboard" className="btn btn--secondary">
            <Icon name="board" />
            {t('Календарь')}
          </Link>
        </>
      }
    >
      {!summary.totalUnits && (
        <section className="fund-empty">
          <h2>{t('Создайте свой номерной фонд')}</h2>
          <ol>
            <li>{t('Добавьте категорию')}</li>
            <li>{t('Создайте номера или койки')}</li>
            <li>{t('Настройте тарифы')}</li>
          </ol>
        </section>
      )}
      <InventorySummaryLine units={units} />
      <InventoryCatalog
        units={units}
        categories={summary.byCategory}
        editorCategories={categories}
        occupancy={occupancy}
        channels={marks.channels}
        channelCategories={marks.mapped}
        canEditCatalog={canEditCatalog}
        canHousekeeping={canHousekeeping}
      />
    </Page>
  );
}
