import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { EmptyState, Table } from '../../components/ui';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { foodApi } from '../../lib/food-api';
import { completeFoodList } from '../../lib/food-data';
import type { FoodCustomer } from '../../lib/food-types';
import './food.css';
export async function FoodCustomers() {
  try {
    const customers = await completeFoodList<FoodCustomer>(foodApi.customers);
    return (
      <Page title="Гости" subtitle="Новый клиент добавляется при создании бронирования">
        {!customers.length ? (
          <EmptyState title="Клиенты появятся после первого бронирования" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Телефон</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{[c.firstName, c.lastName].filter(Boolean).join(' ')}</td>
                  <td>{c.phone ?? 'Не указан'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Гости">
        <LoadError testId="food-customers-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
