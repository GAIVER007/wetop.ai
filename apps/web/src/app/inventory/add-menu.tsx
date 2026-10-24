'use client';
import { useState } from 'react';
import { ActionMenu } from '../../components/action-menu';
import type { InventoryCategory } from '../../lib/api';
import { FundEditorDialog } from './fund-editor';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/**
 * «+ Добавить» (ADR-108): одно главное действие экрана вместо ряда равнозначных кнопок.
 * Пункты называют конкретное действие — «Номер», «Комнату с койками», «Категорию», —
 * а не абстрактное «Номер / койки». Формы пока прежние (переделка — срез I3).
 */
export function AddMenu({ categories }: { categories: InventoryCategory[] }) {
  const t = useT();
  const [open, setOpen] = useState<null | 'room' | 'dorm' | 'category'>(null);

  return (
    <>
      <ActionMenu
        text={msg('Добавить номер')}
        tone="primary"
        label={msg('Добавить в номерной фонд')}
        items={[
          { label: t('Номер'), onSelect: () => setOpen('room') },
          { label: t('Комнату с койками'), onSelect: () => setOpen('dorm') },
          { label: t('Категорию'), onSelect: () => setOpen('category') },
        ]}
      />
      <FundEditorDialog
        categories={categories}
        preferKind="PRIVATE_ROOM"
        mode={categories.some((c) => c.kind === 'PRIVATE_ROOM') ? 'room' : 'category'}
        open={open === 'room'}
        onClose={() => setOpen(null)}
      />
      <FundEditorDialog
        categories={categories}
        preferKind="DORM_BED"
        mode={categories.some((c) => c.kind === 'DORM_BED') ? 'room' : 'category'}
        open={open === 'dorm'}
        onClose={() => setOpen(null)}
      />
      <FundEditorDialog
        categories={categories}
        mode="category"
        open={open === 'category'}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
