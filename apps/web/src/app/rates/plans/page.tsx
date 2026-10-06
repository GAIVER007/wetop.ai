import { requireVertical } from '../../../lib/vertical-guard';
import Link from 'next/link';
import { ratesApi } from '../../../lib/api';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { EmptyState } from '../../../components/ui';
import { deskShell } from '../../../lib/desk-shell';
import { RatesTabs } from '../tabs';
import { RatePlansTable } from '../plans-table';
import { unstable_rethrow } from 'next/navigation';
import '../rates.css';

/**
 * «Тарифы и цены» → «Тарифные планы» (SET4, дополнение 29.09 к ADR-115; начало RT4 плана «Тарифы и цены» v2):
 * тарифы объекта с правилом отмены. Раздел открыт праву `rates` (владелец и управляющий), поэтому правка есть у
 * всех, кто его видит, — кроме «только чтения» (ADR-102). Отказ API не уносит экран: заголовок и вкладки на месте (D4).
 */
export default async function RatePlansPage() {
  await requireVertical(['HOSPITALITY']);
  const { readOnly } = await deskShell();
  const plans = await ratesApi.plans().then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => {
      unstable_rethrow(e);
      return { ok: false as const, e };
    },
  );
  return (
    <Page width="wide" title="Тарифы и цены" subtitle="Управление ценами и ограничениями продаж">
      <RatesTabs current="plans" />
      {!plans.ok ? (
        <LoadError testId="rate-plans-error" {...loadErrorProps(plans.e)} />
      ) : !plans.r.length ? (
        <EmptyState
          data-testid="rate-plans-empty"
          title="Тарифов ещё нет"
          actions={
            <Link href="/rooms/categories" className="btn btn--secondary">
              Открыть категории
            </Link>
          }
        >
          Тариф создаётся вместе с категорией в номерном фонде или позже — кнопкой «Настроить тариф»
          у категории.
        </EmptyState>
      ) : (
        <>
          <p className="rates-rule">
            Правило отмены — свойство тарифа: штраф по нему считается при отмене в день заезда и при
            незаезде, для всех броней по тарифу.
          </p>
          <RatePlansTable plans={plans.r} editable={!readOnly} />
        </>
      )}
    </Page>
  );
}
