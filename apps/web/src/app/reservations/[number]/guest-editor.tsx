'use client';
import { useEffect, useRef, useState } from 'react';
import type { GuestCard } from '../../../lib/api';
import { Alert, Button } from '../../../components/ui';
import { Overlay } from '../../../components/overlay';
import { GuestProfileForm } from '../../guests/[id]/guest-forms';
import { loadBookingGuest } from './guest-editor-actions';

export function BookingGuestEditor({ id, scopeKey, canEdit, piiStorage }: {
  id: string; scopeKey: string; canEdit: boolean; piiStorage: 'real' | 'pseudonymized';
}) {
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState<GuestCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, [id, scopeKey, canEdit]);
  const close = () => { generation.current++; setOpen(false); setGuest(null); setError(null); setLoading(false); };
  const load = async () => {
    if (!canEdit) return;
    const request = ++generation.current;
    setGuest(null); setError(null); setLoading(true);
    try {
      const result = await loadBookingGuest(id);
      if (request !== generation.current) return;
      setGuest(result.guest); setError(result.error);
    } catch {
      if (request === generation.current) setError('Не удалось загрузить гостя. Попробуйте снова.');
    } finally {
      if (request === generation.current) setLoading(false);
    }
  };
  return <>
    <Button type="button" tone="secondary" size="sm" disabled={!canEdit}
      onClick={() => { setOpen(true); void load(); }}>Изменить гостя</Button>
    <Overlay open={open && canEdit} onClose={close} title="Данные гостя">
      {loading ? <p role="status">Загружаем данные гостя…</p> : error ? <>
        <Alert>{error}</Alert><Button type="button" onClick={() => void load()}>Повторить</Button>
      </> : guest ? <GuestProfileForm key={`${scopeKey}:${guest.id}`} guest={guest} piiStorage={piiStorage} readOnly={!canEdit} onSaved={close} /> : null}
    </Overlay>
  </>;
}
