'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { AuthShell } from '../../../components/auth-shell';
import { Icon } from '../../../components/icon';
import { verifyEmailAction } from '../actions';
import { msg } from '../../../i18n';
import { useT } from '../../../i18n/locale-provider';

/**
 * Подтверждение почты по ссылке из письма. Раньше здесь была кнопка «Подтвердить почту и войти»:
 * человек открывал письмо, попадал сюда и должен был нажать ещё раз. Многие вместо этого шли на
 * «Войти», вводили пароль неподтверждённой почты и упирались в «Почта не подтверждена». Теперь
 * страница подтверждает сама, как только открылась в настоящем браузере: JS выполняется только у
 * человека, а почтовые сканеры ходят по ссылке без него — «подтверждение по открытию» у них раньше
 * человека не сработает (ADR-060). Кнопка остаётся лишь как повтор, если что-то не заладилось.
 */
export function VerifyPanel({ token }: { token: string }) {
  const t = useT();
  const [error, setError] = useState<string | null>(
    token ? null : msg('Ссылка неполная: откройте её из письма целиком'),
  );
  const [pending, start] = useTransition();
  const started = useRef(false);

  const confirm = () =>
    start(async () => {
      const result = await verifyEmailAction(token);
      setError(result.error);
      if (result.redirectTo) window.location.assign(result.redirectTo);
    });

  // Один раз при открытии страницы: повторный запуск в строгом режиме отсекает ref, а не токен
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      confirm();
    }
  }, []);

  return (
    <AuthShell
      story={{
        eyebrow: t('Подтверждение почты'),
        title: (
          <>
            {t('Почти')} <br /> {t('готово.')}
          </>
        ),
        text: t('Подтверждаем вашу почту — и сразу откроем рабочее место.'),
      }}
    >
      <span className="round-icon">
        <Icon name="shield" />
      </span>
      <h2>{t('Подтверждение почты')}</h2>
      {error ? (
        <>
          <p className="alert" role="alert">
            {t(error)}
          </p>
          {token && (
            <button className="btn" type="button" disabled={pending} onClick={confirm}>
              {pending ? t('Подтверждаем…') : t('Подтвердить ещё раз')}
              <Icon name="arrow" width={16} />
            </button>
          )}
          <div className="login-preview">
            <span>{t('Ссылка не сработала?')}</span>
            <Link href="/login">{t('Войти и запросить письмо заново')}</Link>
          </div>
        </>
      ) : (
        <p role="status">{t('Подтверждаем почту и открываем рабочее место…')}</p>
      )}
    </AuthShell>
  );
}
