import { requireFeature } from '../../lib/vertical-guard';
import { FoodCustomers } from '../food/customers';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi } from '../../lib/api';
import { BeautyCustomersTable } from './beauty-table';
import { deskShell } from '../../lib/desk-shell';
import { mayAccess } from '../../lib/navigation';
import '../beauty/beauty.css';

/** Клиенты салона по макету ТЗ (09.10.2026): сегменты, визиты и средний чек считает API по DONE */
export default async function CustomersPage() {
  const me = await requireFeature('/customers');
  if (me.context?.vertical === 'FOOD_SERVICE') return <FoodCustomers />;
  try {
    const [{ items }, shell] = await Promise.all([beautyApi.customers(), deskShell()]);
    return (
      <Page
        className="beauty-page"
        title="Клиенты"
        subtitle="Клиенты этого бизнеса и история их визитов."
      >
        <BeautyCustomersTable key={me.context?.businessId} items={items} businessId={me.context?.businessId ?? ''}
          canEdit={!shell.readOnly && mayAccess(shell.access, 'desk')}
          canImport={!shell.readOnly && mayAccess(shell.access, 'desk') && shell.access.role === 'OWNER'} />
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
