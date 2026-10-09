import { BadRequestException } from '@nestjs/common';

export const WIZARD_STEPS = [
  'intro',
  'source',
  'review',
  'generating',
  'testbot',
  'signup',
] as const;
const fields: Record<string, number> = {
  assistantName: 40,
  businessName: 200,
  niche: 200,
  description: 10000,
  goal: 1000,
  advantages: 2000,
  currency: 3,
  timezone: 80,
  botType: 16,
  siteUrl: 500,
  foundFields: 300,
};
export function wizardConfig(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Ожидаются настройки');
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    const limit = fields[key];
    if (!limit || typeof value !== 'string' || value.length > limit)
      throw new BadRequestException(`Проверьте поле ${limit ? key : 'настроек'}`);
    result[key] = value.trim();
  }
  if (result.siteUrl && !/^https?:\/\/\S+$/i.test(result.siteUrl))
    throw new BadRequestException('Введите корректный адрес сайта');
  if (result.botType && !['sales', 'support'].includes(result.botType))
    throw new BadRequestException('Выберите сценарий');
  if (result.currency && !['KZT', 'USD', 'EUR', 'RUB', 'GBP'].includes(result.currency))
    throw new BadRequestException('Выберите валюту');
  if (result.timezone) {
    try {
      new Intl.DateTimeFormat('ru', { timeZone: result.timezone });
    } catch {
      throw new BadRequestException('Проверьте часовой пояс');
    }
  }
  return result;
}

const LEADS = ['Менее 10', '10-50', '50-200', '200-1000', '1000+'];
const SOURCES = ['Instagram', 'Google', 'Реклама', 'Рекомендация', 'Другое'];
/** Опрос гостя: три вопроса, все необязательные. Любое лишнее поле или чужое значение отклоняется целиком. */
export function wizardSurvey(body: unknown): { goal?: string; leadsPerDay?: string; source?: string } {
  const bad = () => new BadRequestException('Проверьте ответы опроса');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad();
  const out: { goal?: string; leadsPerDay?: string; source?: string } = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string') throw bad();
    if (key === 'goal' && value.length <= 1000) out.goal = value.trim();
    else if (key === 'leadsPerDay' && LEADS.includes(value)) out.leadsPerDay = value;
    else if (key === 'source' && SOURCES.includes(value)) out.source = value;
    else throw bad();
  }
  return out;
}

/** События, которые вправе прислать браузер; скан, генерацию и тест пишет только сервер, подделать их нельзя */
const CLIENT_EVENTS = ['source_submitted', 'testbot_cta'] as const;
export function wizardClientEvent(body: unknown): (typeof CLIENT_EVENTS)[number] {
  const type = body && typeof body === 'object' ? (body as { type?: unknown }).type : undefined;
  const found = CLIENT_EVENTS.find((event) => event === type);
  if (!found) throw new BadRequestException('Неизвестное событие');
  return found;
}
