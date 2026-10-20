import type { MarketingCampaignView } from '../../../lib/api';

/** Подписи статусов кампании (§53): общий файл для серверной страницы и клиентских форм */
export const CAMPAIGN_STATUS: Record<MarketingCampaignView['status'], string> = {
  ACTIVE: 'Идёт',
  PAUSED: 'На паузе',
  FINISHED: 'Завершена',
};
