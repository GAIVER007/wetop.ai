import { unstable_rethrow } from 'next/navigation';
import { Badge, Panel, SectionTitle, Table } from '../../../components/ui';
import { hotelClock } from '../../../lib/hotel-api';
import { sellerConnected } from '../../../lib/ai-seller';
import { msg } from '../../../i18n';
import { serverT } from '../../../i18n/server';
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
  CONNECTED: { tone: 'ok', state: msg('Подключён') },
  CONNECTING: { tone: 'warn', state: msg('Подключается') },
  CONFIGURED: { tone: 'warn', state: msg('Настроен, не проверен') },
  ERROR: { tone: 'danger', state: msg('Ошибка') },
  NOT_CONNECTED: { tone: 'neutral', state: msg('Не подключён') },
};

/**
 * Сводка каналов продавца (S2.8): одно состояние на канал и куда смотреть, вместо четырёх раскрывашек вслепую. Данные
 * те же, что у форм ниже; чего не удалось узнать, то так и названо, а не «не подключён».
 */
export async function ChannelsTable({ status }: { status: SellerStatus }) {
  if (!sellerConnected(status)) return null;
  const t = await serverT();
  const site = t('Чат на сайте');
  const unknown = t('Не удалось узнать');
  const refresh = t('Обновите страницу.');
  const [clock, embed, whatsapp, telegram] = await Promise.all([
    hotelClock(),
    settle(sellerApi.embed()),
    settle(sellerApi.whatsapp()),
    settle(businessAgentsApi.telegram('working')),
  ]);
  const rows: Row[] = [];
  if (!embed.ok) rows.push({ key: 'site', name: site, tone: 'neutral', state: unknown, detail: refresh });
  else if (!embed.value.snippet)
    rows.push({ key: 'site', name: site, tone: 'neutral', state: t('Адрес не задан'), detail: t('Публичный адрес продавца вписывает владелец.') });
  else if ((embed.value.hosts ?? []).length === 0)
    rows.push({ key: 'site', name: site, tone: 'warn', state: t('Нет сайта'), detail: t('Заведите сайт с доменом в «Настройках сайта».') });
  else rows.push({ key: 'site', name: site, tone: 'ok', state: t('Готов'), detail: t('Домены: {hosts}', { hosts: (embed.value.hosts ?? []).join(', ') }) });

  if (!whatsapp.ok) rows.push({ key: 'whatsapp', name: 'WhatsApp', tone: 'neutral', state: unknown, detail: refresh });
  else if (whatsapp.value.set)
    rows.push({ key: 'whatsapp', name: 'WhatsApp', tone: 'ok', state: t('Подключён'), detail: t('Номер: {number}', { number: whatsapp.value.phoneNumberId ?? t('задан') }) });
  else rows.push({ key: 'whatsapp', name: 'WhatsApp', tone: 'neutral', state: t('Не подключён'), detail: t('Подключается номером и ключом ниже.') });

  if (!telegram.ok) rows.push({ key: 'telegram', name: 'Telegram', tone: 'neutral', state: unknown, detail: refresh });
  else {
    const tg = telegram.value;
    const word = TELEGRAM_STATE[tg.state];
    const last = tg.lastReceivedAt
      ? t('Последнее сообщение: {when}', { when: clock.moment(tg.lastReceivedAt) })
      : tg.error
        ? tg.error
        : t('Сообщений ещё не было');
    rows.push({ key: 'telegram', name: 'Telegram', tone: word.tone, state: t(word.state), detail: tg.username ? `@${tg.username}. ${last}` : last });
  }

  return (
    <Panel aria-labelledby="seller-channels-title" data-testid="seller-channels">
      <SectionTitle first id="seller-channels-title">
        {t('Каналы связи')}
      </SectionTitle>
      <Table size="sm" aria-label={t('Состояние каналов продавца')} data-testid="seller-channels-table">
        <thead>
          <tr>
            <th scope="col">{t('Канал')}</th>
            <th scope="col">{t('Состояние')}</th>
            <th scope="col">{t('Подробности')}</th>
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
      <p className="settings-note">{t('Настройка каждого канала ниже, по шагам.')}</p>
    </Panel>
  );
}
