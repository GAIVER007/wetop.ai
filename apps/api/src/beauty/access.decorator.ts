import { SetMetadata } from '@nestjs/common';
import type { BeautyAction, BeautySection } from '@pms/domain';
export const BEAUTY_ACCESS = 'wetop:beauty-access';
export interface BeautyRequirement { section: BeautySection; action: BeautyAction; own?: boolean; managerOnly?: boolean; anyOf?: BeautySection[]; also?: Array<{section:BeautySection;action:BeautyAction;own?:boolean}> }
/** Describes the actual action. Legacy @Access remains authoritative in other verticals. */
export const BeautyAccess = (section: BeautySection, action: BeautyAction, options: Omit<BeautyRequirement, 'section' | 'action'> = {}) => SetMetadata(BEAUTY_ACCESS, { section, action, ...options } satisfies BeautyRequirement);
