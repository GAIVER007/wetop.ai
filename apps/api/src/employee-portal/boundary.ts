import { employeeProfileRevision } from './employee-common';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PortalProfileInput, PortalPortfolioInput, PortalPublicationInput, PortalPercentBasis } from '@pms/domain';

export function objectInput(raw: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k => !keys.includes(k)))
    throw new BadRequestException('Unexpected input fields');
  return raw as Record<string, unknown>;
}
export function text(value: unknown, max: number, optional = false): string {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) throw new BadRequestException('Invalid text');
  return value.trim();
}
export function revision(expected: unknown, actual: string): void {
  if (typeof expected !== 'string' || !expected.length) throw new BadRequestException('expectedRevision required');
  if (expected !== actual) throw new ConflictException('Данные изменились. Обновите их перед сохранением; ваш ввод сохранён.');
}
export function profileInput(raw: unknown): PortalProfileInput {
  const b = objectInput(raw, ['name','phone','email','headline','biography','practiceSinceYear','expectedRevision','expectedProfileRevision']);
  if (typeof b.expectedRevision !== 'string' || !b.expectedRevision) throw new BadRequestException('expectedRevision required');
  employeeProfileRevision(b.expectedProfileRevision);
  for (const [key,max] of [['name',200],['phone',32],['email',320],['headline',200],['biography',5000]] as const) {
    if (b[key] !== undefined && !(b[key] === null && ['phone','email'].includes(key))) b[key] = text(b[key],max);
  }
  if (b.name === '') throw new BadRequestException('Name required');
  if (b.practiceSinceYear !== undefined && b.practiceSinceYear !== null && (!Number.isInteger(b.practiceSinceYear) || Number(b.practiceSinceYear) < 1900 || Number(b.practiceSinceYear) > new Date().getUTCFullYear())) throw new BadRequestException('Invalid practice year');
  return b as unknown as PortalProfileInput;
}
export function publicationInput(raw: unknown): PortalPublicationInput {
  const b = objectInput(raw, ['published','publicationConsent','expectedRevision']);
  if (typeof b.published !== 'boolean' || typeof b.publicationConsent !== 'boolean' || typeof b.expectedRevision !== 'string') throw new BadRequestException('Explicit consent and revision required');
  if (b.published && !b.publicationConsent) throw new BadRequestException('Publication requires consent');
  return b as unknown as PortalPublicationInput;
}
export function portfolioInput(raw: unknown): PortalPortfolioInput {
  const b = objectInput(raw, ['title','description','serviceId','publicationConsent','published']);
  b.title = text(b.title,200);
  if (!b.title) throw new BadRequestException('Title required');
  if (b.description !== undefined) b.description = text(b.description,2000);
  if (b.serviceId !== undefined && b.serviceId !== null && (typeof b.serviceId !== 'string' || !UUID.test(b.serviceId))) throw new BadRequestException('Invalid service');
  for (const k of ['published','publicationConsent']) if (b[k] !== undefined && typeof b[k] !== 'boolean') throw new BadRequestException('Boolean required');
  if (b.published && !b.publicationConsent) throw new BadRequestException('Publication requires consent');
  return b as unknown as PortalPortfolioInput;
}
export function policyInput(raw: unknown): { percentBasis: PortalPercentBasis; expectedRevision?: string } {
  const b = objectInput(raw, ['percentBasis','expectedRevision']);
  if (b.percentBasis !== 'COMPLETED_SERVICES' && b.percentBasis !== 'PAID_COMPLETED_SERVICES') throw new BadRequestException('Invalid percent basis');
  if (b.expectedRevision !== undefined && typeof b.expectedRevision !== 'string') throw new BadRequestException('Invalid revision');
  return b as { percentBasis: PortalPercentBasis; expectedRevision?: string };
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
