import { unstable_rethrow } from 'next/navigation';
import { Badge, Panel, SectionTitle, Table } from '../../../components/ui';
import { hotelClock } from '../../../lib/hotel-api';
import { sellerConnected } from '../../../lib/ai-seller';
import { businessAgentsApi, sellerApi, type SellerStatus, type TelegramStatusView } from '../../../lib/api';

type Tone = 'ok' | 'warn' | 'danger' | 'neutral';
interface Row {
  key: string;
  name: string;
  tone: Tone;
  state: string;
  detail: string;
}

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const };
    },
  );

const TELEGRAM_STATE: Record<TelegramStatusView['state'], { tone: Tone; state: string }> = {
  CONNECTED: { tone: 'ok', state: 'Подключён' },
  CONNECTING: { tone: 'warn', state: 'Подключается' },
  CONFIGURED: { tone: 'warn', state: 'Настроен, не проверен' },
  ERROR: { tone: 'danger', state: 'Ошибка' },
  NOT_CONNECTED: { tone: 'neutral', state: 'Не подключён' },
};

/**
 * Сводка каналов продавца (S2.8): одно состояние на канал и куда смотреть, вместо четырёх раскрывашек вслепую. Данные
 * те же, что у форм ниже; чего не удалось узнать, то так и названо, а не «не подключён».
 */
export async function ChannelsTable({ status }: { status: SellerStatus }) {
  if (!sellerConnected(status)) return null;
  const [clock, embed, whatsapp, telegram] = await Promise.all([
    hotelClock(),
    settle(sellerApi.embed()),
    settle(sellerApi.whatsapp()),
    settle(businessAgentsApi.telegram('working')),
  ]);
  const rows: Row[] = [];
  if (!embed.ok) rows.push({ key: 'site', name: 'Чат на сайте', tone: 'neutral', state: 'Не удалось узнать', detail: 'Обновите страницу.' });
  else if (!embed.value.snippet)
    rows.push({ key: 'site', name: 'Чат на сайте', tone: 'neutral', state: 'Адрес не задан', detail: 'Публичный адрес продавца вписывает владелец.' });
  else if ((embed.value.hosts ?? []).length === 0)
    rows.push({ key: 'site', name: 'Чат на сайте', tone: 'warn', state: 'Нет сайта', detail: 'Заведите сайт с доменом в «Настройках сайта».' });
  else rows.push({ key: 'site', name: 'Чат на сайте', tone: 'ok', state: 'Готов', detail: `Домены: ${(embed.value.hosts ?? []).join(', ')}` });

  if (!whatsapp.ok) rows.push({ key: 'whatsapp', name: 'WhatsApp', tone: 'neutral', state: 'Не удалось узнать', detail: 'Обновите страницу.' });
  else if (whatsapp.value.set)
    rows.push({ key: 'whatsapp', name: 'WhatsApp', tone: 'ok', state: 'Подключён', detail: `Номер: ${whatsapp.value.phoneNumberId ?? 'задан'}` });
  else rows.push({ key: 'whatsapp', name: 'WhatsApp', tone: 'neutral', state: 'Не подключён', detail: 'Подключается номером и ключом ниже.' });

  if (!telegram.ok) rows.push({ key: 'telegram', name: 'Telegram', tone: 'neutral', state: 'Не удалось узнать', detail: 'Обновите страницу.' });
  else {
    const t = telegram.value;
    const word = TELEGRAM_STATE[t.state];
    const last = t.lastReceivedAt ? `Последнее сообщение: ${clock.moment(t.lastReceivedAt)}` : t.error ? t.error : 'Сообщений ещё не было';
    rows.push({ key: 'telegram', name: 'Telegram', tone: word.tone, state: word.state, detail: t.username ? `@${t.username}. ${last}` : last });
  }

  return (
    <Panel aria-labelledby="seller-channels-title" data-testid="seller-channels">
      <SectionTitle first id="seller-channels-title">
        Каналы связи
      </SectionTitle>
      <Table size="sm" aria-label="Состояние каналов продавца" data-testid="seller-channels-table">
        <thead>
          <tr>
            <th scope="col">Канал</th>
            <th scope="col">Состояние</th>
            <th scope="col">Подробности</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} data-testid={`seller-channel-${r.key}`}>
              <th scope="row">{r.name}</th>
              <td>
                <Badge tone={r.tone}>{r.state}</Badge>
              </td>
              <td>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="settings-note">Настройка каждого канала ниже, по шагам.</p>
    </Panel>
  );
}
