import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { beautyApi } from '../../../lib/api';
import { currentMe, deskShell } from '../../../lib/desk-shell';
import { mayBeautyAccess } from '../../../lib/navigation';
import { requireFeature } from '../../../lib/vertical-guard';
import { CertificatesBoard } from './board';
import '../../beauty/beauty.css';
import { serverT } from '../../../i18n/server';

/** «Финансы → Сертификаты» салона (решение 21.10.2026 §3): список, продажа, проверка остатка по коду */
export default async function CertificatesPage() {
  await requireFeature('/finance/certificates');
  const shell = await deskShell();
  const me = await currentMe();
  const t = await serverT();
  try {
    const data = await beautyApi.giftCertificates();
    const scopeKey = JSON.stringify({
      organizationId: me.user?.organizationId,
      businessId: me.context?.businessId,
      locationId: me.context?.locationId,
    });
    return (
      <Page title={t('Сертификаты')} subtitle={t('Подарочные сертификаты салона: продажа, остаток и срок')}>
        <CertificatesBoard
          key={scopeKey}
          items={data.items}
          currency={data.currency ?? 'KZT'}
          canSell={!shell.readOnly && mayBeautyAccess(shell.access, 'finance', 'create', { legacy: 'desk' })}
        />
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Сертификаты')}>
        <LoadError testId="certificates-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
