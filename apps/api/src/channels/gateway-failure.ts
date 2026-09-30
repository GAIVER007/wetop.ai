import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { channex } from '@pms/integrations';

/**
 * Отказ Channex, рассказанный наружу (сверка 20.09.2026).
 *
 * До правки наружу уходил `e.message` как есть, а он собирается из ответа Channex и несёт до 300
 * знаков их JSON: внутренние идентификаторы объекта, тарифов и брони. Для человека на экране это
 * шум, для постороннего — сведения о чужой системе.
 *
 * Оставляем то, по чему отказ узнаётся и ищется в журнале: путь без строки запроса, код HTTP и код
 * ошибки Channex. Полный текст пишем в журнал сервера — он остаётся под рукой у владельца.
 */
export function gatewayFailure(e: channex.ChannexApiError): Error {
  const path = (e.path ?? '').split('?')[0];
  // Ключа нет — это не отказ Channex, а ненастроенная система: текст нужен целиком, он про нас.
  if (e.status === 503 && e.message.includes('CHANNEX_API_KEY')) {
    return new ServiceUnavailableException(e.message);
  }
  console.error(`[channex] ${e.message}`);
  const what = e.status === 0 ? 'нет связи' : `HTTP ${e.status}`;
  return new BadGatewayException(
    `Менеджер каналов ответил отказом (${what}) на ${path}${e.code ? `, код ${e.code}` : ''}. Подробности — в журнале сервера.`,
  );
}
