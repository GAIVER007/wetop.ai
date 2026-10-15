import { Badge, PanelTitle } from '../../../components/ui';
import { PLATFORM_TIMEZONE } from '@pms/domain';
import { supportApi } from '../../../lib/api';
import { propertyClock } from '../../../lib/property-time';
import { actionClassLabel, actionLabel, actionStatus } from '../../../lib/support-actions';
import { unstable_rethrow } from 'next/navigation';

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const };
    },
  );

/**
 * Журнал действий бота в диалоге (S6): что предложил, подтвердил, выполнил или передал человеку. Только для оператора;
 * клиент этого не видит. Пустой журнал не рисуется: у большинства обращений действий нет.
 */
export async function ActionsJournal({ conversationId }: { conversationId: string }) {
  const loaded = await settle(supportApi.conversationActions(conversationId));
  if (loaded.ok && loaded.value.items.length === 0) return null;
  const clock = propertyClock(PLATFORM_TIMEZONE);
  return (
    <section aria-label="Действия агента" data-testid="agent-actions" className="stack stack--sm">
      <PanelTitle>Действия агента</PanelTitle>
      {!loaded.ok ? (
        <p className="settings-note">Не удалось узнать, какие действия делал агент.</p>
      ) : (
        <ul>
          {loaded.value.items.map((item) => {
            const status = actionStatus(item.status);
            return (
              <li key={item.id ?? `${item.action}-${item.createdAt}`}>
                <span>{item.createdAt ? clock.moment(item.createdAt) : ''}</span>{' '}
                <strong>{actionLabel(item.action)}</strong> ({actionClassLabel(item.actionClass)}){' '}
                <Badge tone={status.tone}>{status.label}</Badge>
                {item.result ? <span className="settings-note"> — {item.result}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
