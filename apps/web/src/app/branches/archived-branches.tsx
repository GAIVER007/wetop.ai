'use client';
import { useRef } from 'react';
import { Icon } from '../../components/icon';
import { Button } from '../../components/ui';
import type { ArchivedBranch } from '../../lib/api';
import { BranchArchiveButton } from './branch-archive-button';
export function ArchivedBranches({ items }: { items: ArchivedBranch[] | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button
        type="button"
        tone="secondary"
        className="org-archive-open"
        onClick={() => dialog.current?.showModal()}
      >
        Архив {items ? `(${items.length})` : ''}
      </Button>
      <dialog ref={dialog} className="org-archived org-create-dialog" aria-label="Архив объектов">
        <header>
          <h2>Архив объектов</h2>
          <button type="button" className="icon-button" aria-label="Закрыть архив" onClick={() => dialog.current?.close()}>
            <Icon name="close" />
          </button>
        </header>

        {items === null ? (
          <p>Архив сейчас недоступен. Повторите загрузку страницы.</p>
        ) : items.length ? (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.businessName}
                    {item.address ? `, ${item.address}` : ''}
                  </small>
                </div>
                <BranchArchiveButton id={item.id} name={item.name} restore />
              </li>
            ))}
          </ul>
        ) : (
          <p>В архиве пока нет объектов. Данные архивных объектов сохраняются.</p>
        )}
      </dialog>
    </>
  );
}
