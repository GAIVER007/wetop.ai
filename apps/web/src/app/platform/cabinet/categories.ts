import type { PlatformExpenseCategory } from '../../../lib/api';
import { msg } from '../../../i18n';

/**
 * Статьи расходов компании WETOP (DATA_MODEL §63). Отдельный файл без 'use client': справочник нужен и серверным
 * страницам («Деньги»), и формам в браузере.
 */
export const CATEGORY_LABEL: Record<PlatformExpenseCategory, string> = {
  SERVER: msg('Сервер'),
  DOMAINS: msg('Домены'),
  ADS: msg('Реклама'),
  AI: msg('ИИ'),
  SALARIES: msg('Зарплаты'),
  SERVICES: msg('Сервисы'),
  OTHER: msg('Другое'),
};
