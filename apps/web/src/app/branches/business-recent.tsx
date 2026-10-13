import { unstable_rethrow } from 'next/navigation';
import { getJsonPublic } from '../../lib/api';
import { Icon } from '../../components/icon';
export async function BusinessRecent({
  businesses,
}: {
  businesses: Array<{ id: string; name: string }>;
}) {
  try {
    const rows = await getJsonPublic<
      Array<{ id: string; entityId: string; action: string; at: string }>
    >('/audit?entityType=business&limit=3');
    const visible = rows.filter((row) =>
      businesses.some((business) => business.id === row.entityId),
    );
    if (!visible.length) return <p className="org-chart-empty">Изменений карточек пока нет.</p>;
    return (
      <ul className="org-recent">
        {visible.map((row) => (
          <li key={row.id}>
            <span>
              <Icon name="edit" />
            </span>
            <div>
              <strong>
                {row.action === 'business.card_updated' ? 'Изменена карточка' : 'Обновлён бизнес'}
              </strong>
              <small>{businesses.find((business) => business.id === row.entityId)?.name}</small>
            </div>
            <time dateTime={row.at}>
              {new Date(row.at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              })}
            </time>
          </li>
        ))}
      </ul>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <div className="org-chart-empty">
        <p>Журнал сейчас недоступен.</p>
        <a href="/journal">
          Открыть журнал <Icon name="arrow" />
        </a>
      </div>
    );
  }
}
