import Link from 'next/link';
import { redirect } from 'next/navigation';
import { verticalDefinition } from '@pms/domain';
import { authApi } from '../../../lib/api';
import { publicAuthUrl } from '../../../lib/auth-entry';
import { signedInUser } from '../../login/signed-in';
import { confirmRegistrationContext } from './actions';
import '../../login/login.css';
import './complete.css';

export default async function RegistrationCompletePage() {
  if (!(await signedInUser())) redirect(publicAuthUrl());
  const context = await authApi.registrationContext();
  if (!context)
    return (
      <main className="login-page registration-complete" id="main-content">
        <h1>Рабочее пространство недоступно</h1>
        <p>Обратитесь к владельцу организации.</p>
      </main>
    );
  const { context: verified } = await authApi.me();
  const selected =
    verified?.businessId === context.businessId && verified?.locationId === context.locationId;
  return (
    <main className="login-page registration-complete" id="main-content">
      <section className="login-form-panel">
        <div className="login-form">
          <h1>{context.businessName}</h1>
          <p>{verticalDefinition(context.vertical).label}</p>
          <p>Филиал: {context.locationName}</p>
          {context.vertical !== 'HOSPITALITY' && (
            <p role="status">
              Вы подключены к пилоту. Рабочие инструменты направления готовятся к запуску. Команда
              согласует следующие шаги подключения.
            </p>
          )}
          {!selected || context.vertical === 'HOSPITALITY' ? (
            <form action={confirmRegistrationContext}>
              <button className="btn btn-primary" type="submit">
                Продолжить
              </button>
            </form>
          ) : (
            <p>Рабочее пространство подтверждено.</p>
          )}
          <Link href={publicAuthUrl()}>На главную WETOP</Link>
        </div>
      </section>
    </main>
  );
}
