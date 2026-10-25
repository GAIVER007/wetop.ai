import type { Translate } from '../../i18n';
import type { ExtensionAccessView, PlatformOrganization } from '../../lib/api';
import { extensionLastDay } from '../../lib/ai-seller';
import { displayDay } from '../../lib/display-date';
import { extensionLine, organizationStatusLine } from '../../lib/platform';

/**
 * Состояние организации и «ИИ-продавца» на языке человека (KK3). `lib/platform` склеивает дату в русскую строку
 * («пробный по 01.11.2026»), целиком её не перевести: здесь та же строка собирается из переводимых частей.
 */
export function statusText(o: Pick<PlatformOrganization, 'status' | 'trialEndsAt'>, t: Translate): string {
  if (o.status === 'TRIAL' && o.trialEndsAt)
    return t('пробный по {date}', { date: displayDay(extensionLastDay(o.trialEndsAt)) });
  return t(organizationStatusLine(o).label);
}

export function sellerText(e: ExtensionAccessView, t: Translate): ReturnType<typeof extensionLine> {
  const line = extensionLine(e);
  if (e.access === 'off') return { ...line, label: t(line.label), detail: t(line.detail) };
  const until = e.activeUntil
    ? t('по {date}', { date: displayDay(extensionLastDay(e.activeUntil)) })
    : t('бессрочно');
  const kind = e.status === 'TRIAL' ? t('пробный') : t('оплачен');
  return { ...line, label: t(line.label), detail: `${kind}, ${until}` };
}
