import { cache } from 'react';
import { guardApi } from '../../lib/api';

/**
 * Статус сторожа — один запрос на отрисовку Главной: его читают «Системы» (A2) и очередь «Требуют внимания» (A3). Бюджет
 * экрана — десять рейсов (`tests/ui/requests.spec.ts`), второй такой же GET его бы нарушил. Не ответил или закрыт для
 * роли — `null`: строки сторожа просто нет, остальное на месте.
 */
export const loadGuardStatus = cache(() => guardApi.status().catch(() => null));
