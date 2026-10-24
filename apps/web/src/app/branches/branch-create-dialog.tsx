'use client';
import { useRef, useState } from 'react';
import { BranchForm } from './form';
import type { BusinessCardView } from '../../lib/api';
import type { WebVertical } from '../../lib/vertical-landing';
import { Icon } from '../../components/icon';
import { Button } from '../../components/ui';
import { useT } from '../../i18n/locale-provider';
export function BranchCreateDialog({
  id,
  label,
  businesses,
  newBusinessId,
}: {
  id: string;
  label: string;
  businesses: BusinessCardView[];
  newBusinessId: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const t = useT();
  const [request, setRequest] = useState({
    id,
    mode: 'BRANCH' as 'BRANCH' | 'BUSINESS',
    businessId: businesses[0]?.id ?? '',
    vertical: 'HOSPITALITY' as WebVertical,
    count: 0,
  });
  const [pending, setPending] = useState(false);
  return (
    <>
      <Button
        id="create-branch"
        type="button"
        className="org-create-trigger"
        onClick={(e) => {
          const businessId = e.currentTarget.dataset.businessId ?? '';
          const vertical = e.currentTarget.dataset.vertical as WebVertical | undefined;
          setRequest((old) => ({
            id,
            mode: businessId ? 'BRANCH' : vertical || !businesses.length ? 'BUSINESS' : 'BRANCH',
            businessId: businessId || businesses[0]?.id || '',
            vertical: vertical ?? 'HOSPITALITY',
            count: old.count + 1,
          }));
          dialog.current?.showModal();
        }}
      >
        <Icon name="plus" />
        {t(label)}
      </Button>
      <dialog
        id="create-branch-dialog"
        ref={dialog}
        className="org-create-dialog"
        aria-labelledby="org-create-title"
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <header>
          <div>
            <h2 id="org-create-title">{t('Добавить бизнес или филиал')}</h2>
            <p>{t('Выберите новый бренд или филиал конкретного бизнеса.')}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t('Закрыть окно добавления')}
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </header>
        <BranchForm
          key={request.count}
          id={request.id}
          businesses={businesses}
          newBusinessId={newBusinessId}
          initialMode={request.mode}
          initialBusinessId={request.businessId}
          initialVertical={request.vertical}
          onPendingChange={setPending}
        />
      </dialog>
    </>
  );
}
