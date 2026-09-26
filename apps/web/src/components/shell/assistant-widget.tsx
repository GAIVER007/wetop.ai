import { assistantApi } from '../../lib/api';
import { assistantScriptProps } from '../../lib/assistant-widget';
import { widgetOwnerKey } from '../../lib/assistant-widget-owner';
import { sessionToken } from '../../lib/session';
import { AssistantWidgetScript } from './assistant-widget-script';
import './assistant-widget.css';

/**
 * Чат ИИ-помощника на каждом экране стойки (ТЗ ред. 1, П2; docs/assistant/README.md §1).
 *
 * Серверный кусок макета: подпись вошедшего берётся у API на сервере (`GET /assistant/identity` с сессией
 * человека) и кладётся в `data-identity`; в браузер уходит только она — ни ключа сессии, ни секрета. Без куки
 * сессии запроса нет вовсе: невошедшему атрибута `data-identity` нет (ТЗ П2), чат анонимный.
 *
 * Без `ASSISTANT_URL` тега нет — так на всех стендах, пока владелец не вписал адрес помощника (Q-180).
 */
export async function AssistantWidget() {
  const base = process.env.ASSISTANT_URL;
  if (!assistantScriptProps(base, null)) return null;

  const session = await sessionToken();
  const identity = session ? await assistantApi.identity() : null;
  const props = assistantScriptProps(base, identity?.token ?? null);
  if (!props) return null;

  return (
    <AssistantWidgetScript
      src={props.src}
      identity={props['data-identity'] ?? null}
      owner={widgetOwnerKey(session)}
    />
  );
}
