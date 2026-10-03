import { ratesApi } from '../../../lib/api';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { deskShell } from '../../../lib/desk-shell';
import { RatesTabs } from '../tabs';
import { PromoTable } from '../promo-table';
import { unstable_rethrow } from 'next/navigation';
import '../rates.css';

/**
 * «Тарифы и цены» → «Промокоды» (D4, DATA_MODEL §20, ADR-123). Промокод даёт процент скидки на проживание в своём
 * периоде и не больше заданного числа раз; скидка тарифа и промокода не суммируются (Q-231). Раздел открыт праву `rates`,
 * правка — всем, кто его видит, кроме «только чтения» (ADR-102). Отказ API не уносит экран: заголовок остаётся.
 */
export default async function PromoCodesPage() {
  const { readOnly } = await deskShell();
  const promos = await ratesApi.promoCodes().then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => {
      unstable_rethrow(e);
      return { ok: false as const, e };
    },
  );
  return (
    <Page width="wide" title="Тарифы и цены" subtitle="Управление ценами и ограничениями продаж">
      <RatesTabs current="promo" />
      {!promos.ok ? (
        <LoadError testId="promo-error" {...loadErrorProps(promos.e)} />
      ) : (
        <>
          <p className="rates-rule">
            Промокод даёт скидку на проживание в своём периоде. Если у тарифа уже есть скидка, гостю
            применяется большая: скидки не суммируются. Промокод не удаляется, а выключается.
          </p>
          <PromoTable promos={promos.r} editable={!readOnly} />
        </>
      )}
    </Page>
  );
}
