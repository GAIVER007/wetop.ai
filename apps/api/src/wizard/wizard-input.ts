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
