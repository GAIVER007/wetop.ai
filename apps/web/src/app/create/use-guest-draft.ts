'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WizardState } from '../../lib/wizard-types';
import { INITIAL_CONFIG, type WizardConfig } from './wizard-fields';

const STORAGE_KEY = 'wetop.wizard.token';
class WizardRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function call<T = WizardState>(body: unknown): Promise<T> {
  const response = await fetch('/api/wizard', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new WizardRequestError(
      typeof data.message === 'string' ? data.message : 'Не удалось сохранить. Повторите запрос',
      response.status,
    );
  return data as T;
}

export function useGuestDraft() {
  const [values, setValues] = useState<WizardConfig>(INITIAL_CONFIG);
  const [step, setStep] = useState('intro');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [saved, setSaved] = useState('');
  const [savedJson, setSavedJson] = useState(JSON.stringify(INITIAL_CONFIG));
  const token = useRef('');
  const revision = useRef(0);
  const opening = useRef(false);
  const saving = useRef(false);
  const dirty = JSON.stringify(values) !== savedJson;

  const open = useCallback(async () => {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError('');
    try {
      token.current = localStorage.getItem(STORAGE_KEY) ?? '';
      const state = await call({
        operation: 'open',
        token: token.current,
        ref: new URLSearchParams(location.search).get('ref') ?? '',
      });
      if (state.guestToken) {
        localStorage.setItem(STORAGE_KEY, state.guestToken);
        token.current = state.guestToken;
      }
      revision.current = state.draft.revision;
      const restored = { ...INITIAL_CONFIG, ...state.draft.wizardData };
      setValues(restored);
      setSavedJson(JSON.stringify(restored));
      setStep(['intro', 'source', 'review'].includes(state.lastStep) ? state.lastStep : 'review');
      setReady(true);
    } catch (e) {
      setExpired(e instanceof WizardRequestError && e.status === 401);
      setError(e instanceof Error ? e.message : 'Не удалось открыть мастер');
    } finally {
      setBusy(false);
      opening.current = false;
    }
  }, []);
  useEffect(() => {
    void open();
  }, [open]);

  const save = useCallback(
    async (nextStep = step) => {
      if (saving.current || !ready) return;
      saving.current = true;
      setBusy(true);
      setError('');
      setSaved('');
      const snapshot = JSON.stringify(values);
      try {
        const result = await call({
          operation: 'save',
          token: token.current,
          config: values,
          revision: revision.current,
          step: nextStep,
        });
        revision.current = result.draft.revision;
        setSavedJson(snapshot);
        setStep(nextStep);
        setSaved('Черновик сохранён');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось сохранить черновик');
      } finally {
        saving.current = false;
        setBusy(false);
      }
    },
    [ready, step, values],
  );
  useEffect(() => {
    if (!ready || !dirty || busy || error) return;
    const timer = setTimeout(() => void save(), 1000);
    return () => clearTimeout(timer);
  }, [ready, dirty, busy, error, save]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function claim() {
    if (saving.current || busy || dirty) return;
    setBusy(true);
    setError('');
    try {
      const result = await call<{ id: string }>({ operation: 'claim', token: token.current });
      // Keep the bearer until the server has confirmed the idempotent claim.
      localStorage.removeItem(STORAGE_KEY);
      location.assign('/ai-seller/agents/' + encodeURIComponent(result.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить агента');
    } finally {
      setBusy(false);
    }
  }
  function restart() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setExpired(false);
      void open();
    } catch {
      setError('Разрешите хранение данных сайта, чтобы сохранить черновик');
    }
  }
  return {
    values,
    setValues,
    step,
    ready,
    busy,
    error,
    expired,
    saved,
    setSaved,
    dirty,
    open,
    save,
    restart,
    claim,
  };
}
