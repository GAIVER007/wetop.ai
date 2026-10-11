import { cache } from 'react';
import { ApiError, deskApi } from '../../lib/api';

/**
 * День стойки для Главной: один запрос на рендер (`cache`), отказ API возвращается значением,
 * чтобы экран назвал его словами, а не упал (замечание владельца 16.09.2026).
 */
export const loadDeskDay = cache((date: string) =>
  deskApi.today(date).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  }),
);
