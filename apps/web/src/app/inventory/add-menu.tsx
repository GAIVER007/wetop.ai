'use client';
import { useState } from 'react';
import { ActionMenu } from '../../components/action-menu';
import type { InventoryCategory } from '../../lib/api';
import { FundEditorDialog } from './fund-editor';

/**
 * «+ Добавить» (ADR-106): одно главное действие экрана вместо ряда равнозначных кнопок.
 * Пункты называют конкретное действие — «Номер», «Комнату с койками», «Категорию», —
 * а не абстрактное «Номер / койки». Формы пока прежние (переделка — срез I3).
 */
export function AddMenu({ categories }: { categories: InventoryCategory[] }) {
  const [open, setOpen] = useState<null | 'room' | 'dorm' | 'category'>(null);
  const empty = categories.length === 0;
  return (
    <>
      <ActionMenu
        text="+ Добавить"
        tone="primary"
        label="Добавить в номерной фонд"
        items={[
          { label: 'Номер', onSelect: () => setOpen('room'), disabled: empty },
          { label: 'Комнату с койками', onSelect: () => setOpen('dorm'), disabled: empty },
          { label: 'Категорию', onSelect: () => setOpen('category') },
        ]}
      />
      <FundEditorDialog
        categories={categories}
        preferKind="PRIVATE_ROOM"
        open={open === 'room'}
        onClose={() => setOpen(null)}
      />
      <FundEditorDialog
        categories={categories}
        preferKind="DORM_BED"
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
