import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const compose = readFileSync(resolve(import.meta.dirname, '../../deploy/compose.yml'), 'utf8');
const assignment = compose.split('\n').find(line => /^\s+APP_UNIFIED_OWNER_HOME=/.test(line))?.trim().replaceAll('$$', '$');

// Exercise the actual container-shell assignment, not an invented rollout parser.
function runtimeFlag(value?: string): string {
  if (!assignment) throw new Error('Missing web owner-home runtime assignment');
  return execFileSync('/bin/sh', ['-c', `${assignment}; printf '%s' "$APP_UNIFIED_OWNER_HOME"`], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...(value === undefined ? {} : { APP_UNIFIED_OWNER_HOME: value }) },
  });
}

describe('approved unified owner-home deployment', () => {
  it('selects the accepted shared Main on a normal deployment with no extra operator flag', () => {
    expect(runtimeFlag()).toBe('true');
  });
  it.each(['0', 'false'])('preserves the explicit emergency opt-out %s', value => {
    expect(runtimeFlag(value)).toBe(value);
  });
  it('preserves explicit activation', () => {
    expect(runtimeFlag('true')).toBe('true');
  });
  it('does not enable held-schema capture as part of the presentation rollout', () => {
    expect(compose).toContain('RESTAURANT_CAPACITY_CAPTURE="$${RESTAURANT_CAPACITY_CAPTURE:-false}"');
    expect(compose).toContain('RESTAURANT_OCCUPANCY_CAPTURE="$${RESTAURANT_OCCUPANCY_CAPTURE:-false}"');
    expect(compose).not.toMatch(/EXPENSE_LINKS_ENABLED:\s*['"]?1/);
    expect(compose).not.toMatch(/HOSPITALITY_WORKLOAD_CAPTURE:\s*['"]?true/);
    expect(compose).not.toMatch(/BEAUTY_WORKLOAD_CAPTURE:\s*['"]?true/);
  });
});
