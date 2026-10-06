import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { normalizeEmail, parseBusinessVertical, type BusinessVertical } from '@pms/domain';

export interface RegistrationBusinessInput {
  vertical?: unknown;
  businessName?: string;
  hotelName?: string;
}

/** Legacy hotelName-only requests are the sole implicit Hospitality compatibility. */
export function registrationBusiness(input: RegistrationBusinessInput): {
  vertical: BusinessVertical;
  name: string;
} {
  const vertical =
    input.vertical === undefined && input.businessName === undefined
      ? 'HOSPITALITY'
      : parseBusinessVertical(input.vertical);
  if (!vertical) throw new BadRequestException('Выберите направление бизнеса');
  if (
    input.businessName !== undefined &&
    input.hotelName !== undefined &&
    input.businessName.trim() !== input.hotelName.trim()
  )
    throw new BadRequestException('Укажите одно название бизнеса');
  return { vertical, name: input.businessName ?? input.hotelName ?? '' };
}

/** Exact server allowlists never travel to the browser. Empty lists deny pilot signup. */
export function assertRegistrationVertical(
  vertical: BusinessVertical,
  email: string,
  env: Record<string, string | undefined> = process.env,
): void {
  if (vertical === 'HOSPITALITY') return;
  const allowed = (env[`REGISTRATION_${vertical}_PILOT_EMAILS`] ?? '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
  if (!allowed.includes(normalizeEmail(email)))
    throw new ForbiddenException('Направление пока доступно только участникам пилота');
}
