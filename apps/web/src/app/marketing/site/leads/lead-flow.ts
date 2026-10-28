import type { SiteLeadStatus } from '../../../../lib/api';

/**
 * Куда двигается заявка с сайта: новую берут в работу или отмечают спамом, в работе закрывают, закрытую и спам можно
 * вернуть в новые (ошиблись кнопкой). API принимает любой статус, порядок держит экран.
 */
export const LEAD_NEXT: Record<SiteLeadStatus, SiteLeadStatus[]> = {
  NEW: ['IN_PROGRESS', 'SPAM'],
  IN_PROGRESS: ['DONE'],
  DONE: ['NEW'],
  SPAM: ['NEW'],
};

export const LEAD_FILTERS = ['NEW', 'IN_PROGRESS', 'DONE', 'SPAM'] as const;

/** Фильтр из адреса: пусто или чужое значение значит «Новые» */
export function leadFilter(raw: string | undefined): SiteLeadStatus {
  return (LEAD_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as SiteLeadStatus) : 'NEW';
}
