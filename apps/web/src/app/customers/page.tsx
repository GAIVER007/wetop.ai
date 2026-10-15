import { requireVertical } from '../../lib/vertical-guard';
import { FoodCustomers } from '../food/customers';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi } from '../../lib/api';
import { BeautyCustomersTable } from './beauty-table';
import '../beauty/beauty.css';

/** Клиенты салона по макету ТЗ (09.10.2026): сегменты, визиты и средний чек считает API по DONE */
export default async function CustomersPage() {
  const me = await requireVertical(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE']);
  if (me.context?.vertical === 'FOOD_SERVICE') return <FoodCustomers />;
  try {
    const { items } = await beautyApi.customers();
    return (
      <Page
        className="beauty-page"
        title="Клиенты"
        subtitle="Клиенты этого бизнеса. Новый клиент добавляется при создании записи."
      >
        <BeautyCustomersTable items={items} />
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
