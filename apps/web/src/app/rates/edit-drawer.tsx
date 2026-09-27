'use client';
import { useState } from 'react';
import { Button } from '../../components/ui';
import { Overlay } from '../../components/overlay';
import { BulkEditor } from './bulk-editor';

/**
 * «Изменить цены» (ТЗ v2 §5, ADR-106): постоянная правая форма ушла с экрана — та же форма массового
 * изменения открывается выдвижной панелью, как карточка брони. Поля, testid'ы и порядок команд формы
 * не меняются: их водит запись сертификации Channex (`channex-certification.spec.ts`).
 */
export function RatesEditDrawer(props: Parameters<typeof BulkEditor>[0]) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" data-testid="rates-edit-open" onClick={() => setOpen(true)}>
        Изменить цены
      </Button>
      {open && (
        <Overlay
          open
          onClose={() => setOpen(false)}
          title="Изменить цены и ограничения"
          drawer
          className="rates-drawer"
        >
          <BulkEditor {...props} />
        </Overlay>
      )}
    </>
  );
}
