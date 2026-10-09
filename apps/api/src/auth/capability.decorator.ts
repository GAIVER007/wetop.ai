import { SetMetadata } from '@nestjs/common';
import type { VerticalCapability } from '@pms/domain';
export const BUSINESS_CAPABILITY = 'wetop:business-capability';
export const RequiresBusinessCapability = (capability: VerticalCapability) =>
  SetMetadata(BUSINESS_CAPABILITY, capability);
