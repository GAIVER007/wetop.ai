'use client';
import { useState } from 'react';
import { Alert, Button, Field, Input } from './ui';
import { useT } from '../i18n/locale-provider';
import { inviteWhatsAppText, inviteWhatsAppUrl } from './invite-link';

/**
 * Ссылка приглашения после отправки (владелец 30.10.2026, варианты A/B/C): поле со ссылкой, «Скопировать»,
 * «Отправить в WhatsApp» и подсказка про срок и один раз. Ссылка в базе не хранится: показываем её только сейчас.
 */
export function InviteLinkBox({ link, business, phone }: { link: string; business: string; phone?: string | null | undefined }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  return (
    <div className="invite-link" data-testid="invite-link">
      <Field label={t('Ссылка приглашения')}>
        <Input value={link} readOnly onFocus={(event) => event.target.select()} data-testid="invite-link-url" />
      </Field>
      <div className="invite-link__actions">
        <Button
          type="button"
          tone="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setCopyError(false);
            } catch {
              setCopyError(true);
            }
          }}
        >
          {copied ? t('Скопировано') : t('Скопировать ссылку')}
        </Button>
        <a
          className="btn btn--primary"
          href={inviteWhatsAppUrl(inviteWhatsAppText(link, business, t), phone)}
          target="_blank"
          rel="noreferrer"
          data-testid="invite-link-whatsapp"
        >
          {t('Отправить в WhatsApp')}
        </a>
      </div>
      {copied && <p role="status">{t('Ссылка скопирована.')}</p>}
      {copyError && <Alert>{t('Выделите и скопируйте ссылку из поля.')}</Alert>}
      <p className="invite-link__note">
        {t('Ссылка действует 7 дней и срабатывает один раз. Отправляйте её только этому сотруднику.')}
      </p>
    </div>
  );
}
