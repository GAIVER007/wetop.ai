import { api, channelsApi } from '../../lib/api';
import { currentMe, deskShell } from '../../lib/desk-shell';
import { hotelApi, hotelClock } from '../../lib/hotel-api';
import {
  categoryCoverage,
  channexCard,
  settle,
  type CategoryCoverage,
  type ChannexCard,
} from '../../lib/integrations';
import type { PropertyClock } from '../../lib/property-time';

export interface ChannexState {
  card: ChannexCard;
  /** Сопоставление категорий; сводка фонда или сопоставления не пришли — `null`, правило «ни одной» остаётся */
  coverage: CategoryCoverage | null;
  propertyName: string | null;
  clock: PropertyClock;
  now: Date;
  /** Технические детали — владельцу организации и главному администратору, не каждому сотруднику смены */
  technical: boolean;
  owner: boolean;
  readOnly: boolean;
}

/**
 * Один загрузчик на карточку «Интеграций» и страницу Channex (INT2, ADR-120): состояние считается одинаково, и
 * карточка не скажет «работает», пока страница говорит «требует внимания». Каждый запрос — отдельно: отказ одного не
 * уносит экран, а становится «не удалось проверить» в своём сигнале.
 */
export async function loadChannexState(): Promise<ChannexState> {
  const now = new Date();
  const [clock, shell, settings, me, connection, webhook, outbox, mapping, summary] =
    await Promise.all([
      hotelClock(),
      deskShell(),
      settle(hotelApi.settings()),
      settle(currentMe()),
      settle(channelsApi.connection()),
      settle(channelsApi.webhookStatus()),
      settle(channelsApi.outbox()),
      settle(channelsApi.mapping()),
      settle(api.inventorySummary()),
    ]);
  const coverage =
    mapping.ok && summary.ok ? categoryCoverage(mapping.value, summary.value.byCategory) : null;
  const user = me.ok ? me.value.user : null;
  return {
    card: channexCard({ connection, webhook, outbox, coverage, now }),
    coverage,
    propertyName: settings.ok ? settings.value.property.name : null,
    clock,
    now,
    technical: user?.role === 'OWNER' || user?.platformAdmin === true,
    owner: user?.role === 'OWNER',
    readOnly: shell.readOnly,
  };
}
