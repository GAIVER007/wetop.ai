import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi } from '../../lib/api';
import { EmptyState, Table } from '../../components/ui';
import '../beauty/beauty.css';
export default async function CustomersPage() {
  try {
    const { items } = await beautyApi.customers();
    return (
      <Page
        className="beauty-page"
        title="Клиенты"
        subtitle="Клиенты этого бизнеса. Новый клиент добавляется при создании записи."
      >
        {items.length === 0 ? (
          <EmptyState title="Клиенты появятся после первой записи" />
        ) : (
          <Table className="beauty-customers-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{[c.firstName, c.lastName].filter(Boolean).join(' ')}</td>
                  <td>{c.phone ?? 'Не указан'}</td>
                  <td>{c.status === 'ACTIVE' ? 'Активен' : 'В архиве'}</td>
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
      <Page title="Клиенты">
        <LoadError testId="beauty-customers-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
