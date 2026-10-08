import { hospitality } from './hospitality';
import { housekeeping } from './housekeeping';
import { payment } from './payment';
import { beauty } from './beauty';
import { food } from './food';
import { source } from './source';
import type { StatusPresentation } from './types';

export const statusRegistries = { hospitality, housekeeping, payment, beauty, food, source };
export type StatusKind = keyof typeof statusRegistries;

/** Older/newer API values stay visible without borrowing a known status meaning. */
export function statusPresentation(kind: StatusKind, value: string): StatusPresentation {
  const registry: Record<string, StatusPresentation> = statusRegistries[kind];
  return Object.hasOwn(registry, value) ? registry[value]! : { label: value, tone: 'neutral' };
}
