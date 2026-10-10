'use client';
import { ActionMenu } from '../../components/action-menu';

/** «⋯» карточки организации: подписка и расширения (панель ниже на странице) и копирование идентификатора */
export function OrganizationMenu({ id, name }: { id: string; name: string }) {
  return (
    <ActionMenu
      label={`Действия: ${name}`}
      items={[
        { label: 'Подписка и расширения', href: `/platform?org=${id}#org-admin` },
        {
          label: 'Скопировать ID организации',
          onSelect: () => {
            void navigator.clipboard?.writeText(id);
          },
        },
      ]}
    />
  );
}
