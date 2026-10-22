import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Порядковый номер миграции (последние цифры префикса: `20261022000142_…` → 142) один на всю цепочку.
 * 22.10.2026 два открытых PR принесли по миграции 142 (#766 `order_item_station` и #772 `voice_calls`):
 * Prisma применила бы обе, но голосовая встала бы «задним числом» перед 143/144, а номер 142 зашит в
 * сторожа схемы, скрипты и документы выкладки. Отдельного сторожа на это не было (`organization-migration-order`
 * проверяет только `_business_card`). Восемь исторических пар до 75 уже на проде и не переименовываются:
 * они перечислены ниже как есть, новых пар быть не может.
 */
const MIGRATIONS = resolve(import.meta.dirname, '../../packages/database/prisma/migrations');

/** пары, выкаченные до сторожа (номер → папки): переименовать уже применённую миграцию нельзя */
const HISTORICAL: Record<number, readonly string[]> = {
  14: ['20260915000014_password_login', '20260916000014_session_token_hash'],
  26: ['20260927000026_phase1_tenant_scope', '20260927000026_rls_roles'],
  40: ['20261001000040_reservation_creation_key', '20261002000040_cashbox'],
  41: ['20261001000041_channex_property_metadata', '20261002000041_cash_reconciliations'],
  44: ['20261003000044_beauty_domain', '20261003000044_competitor_occupancy'],
  51: ['20261004000051_bar_inventory', '20261004000051_food_service_vertical'],
  70: ['20261009000070_accommodation_type_photos', '20261009000070_competitor_rates'],
  75: ['20261009000075_membership_scope_guard_search_path', '20261009000075_property_card'],
};

export function ordinal(name: string): number | null {
  const match = /^\d{8}(\d{6})_/.exec(name);
  return match ? Number(match[1]) : null;
}

export function duplicateOrdinals(names: readonly string[]): Record<number, string[]> {
  const byOrdinal = new Map<number, string[]>();
  for (const name of [...names].sort()) {
    const n = ordinal(name);
    if (n === null) continue;
    byOrdinal.set(n, [...(byOrdinal.get(n) ?? []), name]);
  }
  const out: Record<number, string[]> = {};
  for (const [n, list] of byOrdinal) {
    if (list.length < 2) continue;
    const known = HISTORICAL[n];
    if (known && known.length === list.length && known.every((name) => list.includes(name)))
      continue;
    out[n] = list;
  }
  return out;
}

describe('миграции: порядковый номер один на всю цепочку', () => {
  const dirs = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it('у каждой папки миграции префикс «дата + номер»', () => {
    expect(dirs.filter((name) => ordinal(name) === null)).toEqual([]);
  });

  it('новых повторов номера нет (исторические пары до 75 перечислены поимённо)', () => {
    expect(duplicateOrdinals(dirs)).toEqual({});
  });

  it('сторож ловит повтор номера, как 142 у #766 и #772', () => {
    expect(
      duplicateOrdinals([
        '20261021000141_salon_loyalty',
        '20261022000142_order_item_station',
        '20261022000142_voice_calls',
        '20261022000143_hotel_staff_cabinet',
      ]),
    ).toEqual({ 142: ['20261022000142_order_item_station', '20261022000142_voice_calls'] });
  });

  it('историческую пару с третьей миграцией того же номера не пропускает', () => {
    expect(duplicateOrdinals([...HISTORICAL[44]!, '20261023000044_late_extra'])).toEqual({
      44: [...HISTORICAL[44]!, '20261023000044_late_extra'].sort(),
    });
  });
});
