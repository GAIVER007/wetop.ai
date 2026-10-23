import { requireFeature } from '../../lib/vertical-guard';
import { FoodCustomers } from '../food/customers';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi } from '../../lib/api';
import { BeautyCustomersTable } from './beauty-table';
import { deskShell } from '../../lib/desk-shell';
import { mayBeautyAccess } from '../../lib/navigation';
import { BeautyCustomerTools } from './customer-tools';
import { ImportCustomers } from './import-customers';
import { CustomerSectionTabs } from './section-tabs';
import '../beauty/beauty.css';

/** Клиенты салона по макету ТЗ (09.10.2026): сегменты, визиты и средний чек считает API по DONE */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const me = await requireFeature('/customers');
  if (me.context?.vertical === 'FOOD_SERVICE') {
    const q = (await searchParams)?.q;
    return <FoodCustomers query={typeof q === 'string' ? q.slice(0, 100) : ''} />;
  }
  try {
    const [{ items }, shell] = await Promise.all([beautyApi.customers(), deskShell()]);
    const canCreate = !shell.readOnly
      && mayBeautyAccess(shell.access, 'customers', 'create', { legacy: 'desk' });
    const canUpdate = !shell.readOnly
      && mayBeautyAccess(shell.access, 'customers', 'update', { legacy: 'desk' });
    const canImport = canCreate && shell.access.role === 'OWNER';
    return (
      <Page
        className="beauty-page"
        title="Клиенты"
        subtitle="Клиенты этого бизнеса, их визиты и средний чек."
      >
        <CustomerSectionTabs access={shell.access} current="customers" />
        <BeautyCustomersTable
          key={me.context?.businessId}
          items={items}
          businessId={me.context?.businessId ?? ''}
          canCreate={canCreate}
          canEdit={canUpdate}
          scopeKey={shell.scopeKey ?? ''}
          tools={
            // Локальная проверка CSV доступна праву customers.create; журнальный импорт остаётся OWNER (SL4-M4B)
            <BeautyCustomerTools
              canEdit={canCreate}
              scopeKey={shell.scopeKey ?? ''}
              showCreate={false}
              importHistory={canCreate ? (
                <ImportCustomers businessId={me.context?.businessId ?? ''} canImport={canImport} />
              ) : undefined}
            />
          }
        />
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Клиенты">
        <LoadError testId="beauty-customers-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
