import { BadRequestException } from '@nestjs/common';
import { parseBusinessVertical, type BusinessVertical } from '@pms/domain';

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
