'use client';
import { useState } from 'react';
import type { GuestCard } from '../../../lib/api';
import { Button, Alert } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { Overlay } from '../../../components/overlay';
import { GuestProfileForm } from '../../guests/[id]/guest-forms';
import { loadBookingGuest } from './guest-editor-actions';

export function BookingGuestEditor({
  id,
  readOnly,
  piiStorage,
}: {
  id: string;
  readOnly: boolean;
  piiStorage: 'real' | 'pseudonymized';
}) {
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState<GuestCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    setError(null);
    setLoading(true);
    try {
      const result = await loadBookingGuest(id);
      setGuest(result.guest);
      setError(result.error);
    } catch {
      setError('Не удалось загрузить гостя. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <Button
        type="button"
        tone="secondary"
        size="sm"
        disabled={readOnly}
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        <Icon name="edit" /> Изменить гостя
      </Button>
      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        title="Данные гостя"
        className="booking-guest-editor"
      >
        {loading ? (
          <p role="status">Загружаем данные гостя…</p>
        ) : error ? (
          <>
            <Alert>{error}</Alert>
            <Button type="button" onClick={() => void load()}>
              Повторить
            </Button>
          </>
        ) : guest ? (
          <GuestProfileForm guest={guest} piiStorage={piiStorage} readOnly={readOnly} compact />
        ) : null}
      </Overlay>
    </>
  );
}
