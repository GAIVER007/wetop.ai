'use client';
import { useActionState } from 'react';
import { Alert, Button, Field, Input, Notice, Row } from '../../../components/ui';
import { useT } from '../../../i18n/locale-provider';
import { changeStatusAction, extendTrialAction, type StatusFormResult } from '../actions';

/**
 * Доступ клиента в карточке кабинета (срез 3): «Оплата получена», «Только чтение» и «Продлить пробный» на 7, 14
 * или 30 дней. Каждое действие API пишет в журнал организации; ответ API показывается его словами.
 */
export function AccessForm({
  organizationId,
  status,
}: {
  organizationId: string;
  status: 'TRIAL' | 'ACTIVE' | 'READ_ONLY' | 'SUSPENDED';
}) {
  const t = useT();
  const [paid, payAction, paying] = useActionState<StatusFormResult | null, FormData>(
    changeStatusAction.bind(null, organizationId),
    null,
  );
  const [trial, trialAction, extending] = useActionState<StatusFormResult | null, FormData>(
    extendTrialAction.bind(null, organizationId),
    null,
  );
  const archived = status === 'SUSPENDED';
  const canTrial = status === 'TRIAL' || status === 'READ_ONLY';
  const result = trial ?? paid;
  return (
    <div className="cabinet__access" data-testid="client-access">
      <form key={paid?.attempt ?? 0} action={payAction} className="cabinet__form">
        <Field label={t('Заметка к оплате')}>
          <Input name="note" maxLength={300} placeholder={t('Счёт № 17 от 25.09.2026')} />
        </Field>
        <Row>
          <Button
            type="submit"
            name="status"
            value="ACTIVE"
            disabled={archived || paying || status === 'ACTIVE'}
            aria-busy={paying}
            data-testid="client-access-paid"
          >
            {t('Оплата получена')}
          </Button>
          <Button
            type="submit"
            name="status"
            value="READ_ONLY"
            tone="secondary"
            disabled={archived || paying || status === 'READ_ONLY'}
            data-testid="client-access-readonly"
          >
            {t('Только чтение')}
          </Button>
        </Row>
      </form>
      {canTrial && (
        <form action={trialAction} className="cabinet__form" aria-label={t('Продлить пробный')}>
          <span className="cabinet__label">{t('Продлить пробный')}</span>
          <Row>
            {[7, 14, 30].map((days) => (
              <Button
                key={days}
                type="submit"
                name="days"
                value={String(days)}
                tone="secondary"
                disabled={extending}
                data-testid={`client-trial-${days}`}
              >
                {t('+{n} дн.', { n: days })}
              </Button>
            ))}
          </Row>
        </form>
      )}
      {result?.error && <Alert data-testid="client-access-error">{result.error}</Alert>}
      {result?.message && <Notice data-testid="client-access-result">{result.message}</Notice>}
    </div>
  );
}
