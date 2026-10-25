import Link from 'next/link';
import { redirect } from 'next/navigation';
import { verticalDefinition } from '@pms/domain';
import { authApi } from '../../../lib/api';
import { publicAuthUrl } from '../../../lib/auth-entry';
import { signedInUser } from '../../login/signed-in';
import { confirmRegistrationContext } from './actions';
import { AuthShell } from '../../../components/auth-shell';
import '../../login/login.css';
import { translator } from '../../../i18n';
import { cookieLocale } from '../../../i18n/server';

export default async function RegistrationCompletePage() {
  if (!(await signedInUser())) redirect(publicAuthUrl());
  const { context: verified } = await authApi.me();
  if (verified?.businessId && verified.locationId) redirect('/register/setup');
  const context = await authApi.registrationContext();
  if (!context) redirect('/scope/resolve');
  const selected =
    verified?.businessId === context.businessId && verified?.locationId === context.locationId;
  if (selected) redirect('/register/setup');
  const t = translator(await cookieLocale());
  return (
    <AuthShell>
      <h1>{context.businessName}</h1>
      <p>{t(verticalDefinition(context.vertical).label)}</p>
      <p>{t('Филиал: {name}', { name: context.locationName })}</p>
      {!selected || context.vertical === 'HOSPITALITY' ? (
        <form action={confirmRegistrationContext}>
          <button className="btn btn--primary" type="submit">
            {t('Продолжить')}
          </button>
        </form>
      ) : (
        <p>{t('Рабочее пространство подтверждено.')}</p>
      )}
      <Link href={publicAuthUrl()}>{t('На главную WETOP')}</Link>
    </AuthShell>
  );
}
