'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WizardState } from '../../lib/wizard-types';
import { INITIAL_CONFIG, type WizardConfig } from './wizard-fields';
import { guessRegional } from './regional';
import { S, STEPS, type StepKey } from './strings';
import { msg } from '../../i18n';

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
      typeof data.message === 'string' ? data.message : msg('Не удалось сохранить. Повторите запрос'),
      response.status,
    );
  return data as T;
}

export function useGuestDraft() {
  const [generationState, setGenerationState] = useState<
    Pick<
      WizardState,
      'generation' | 'generated' | 'generationsUsed' | 'generateSiteKey' | 'chat' | 'chatSiteKey'
    >
  >({});
  const [generationPolling, setGenerationPolling] = useState(false);
  const generationEpoch = useRef(0);
  const [scanSiteKey, setScanSiteKey] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState('');
  const scanEpoch = useRef(0);
  const [values, setValues] = useState<WizardConfig>(INITIAL_CONFIG);
  const [step, setStep] = useState<StepKey>('source');
  const [resumed, setResumed] = useState(false);
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
      setGenerationState(state);
      setGenerationPolling(
        (!!state.generation && ['queued', 'running'].includes(state.generation.state)) ||
          !!state.chat?.messages.some((m) => ['queued', 'running'].includes(m.state)),
      );
      setScanSiteKey(state.scanSiteKey ?? null);
      if (state.scan && ['queued', 'running'].includes(state.scan.state)) {
        setScanning(true);
        setScanPhase(state.scan.state);
      }
      revision.current = state.draft.revision;
      const restored = { ...INITIAL_CONFIG, ...state.draft.wizardData };
      const untouched = JSON.stringify(restored) === JSON.stringify(INITIAL_CONFIG);
      // пустой черновик: валюта и пояс по поясу браузера; уже правленный не трогаем
      const initial = untouched
        ? { ...restored, ...guessRegional('', Intl.DateTimeFormat().resolvedOptions().timeZone) }
        : restored;
      setValues(initial);
      // сохранённым считаем то, что пришло с сервера: угаданные умолчания уйдут автосохранением
      setSavedJson(JSON.stringify(restored));
      // «intro» остался от прежней версии: первый экран теперь один
      const last =
        STEPS.find((name) => name === state.lastStep) ??
        (state.lastStep === 'intro' ? 'source' : 'review');
      const back = state.lastStep !== 'intro' && last !== 'source';
      setStep(last);
      setResumed(back && !untouched);
      setReady(true);
    } catch (e) {
      setExpired(e instanceof WizardRequestError && e.status === 401);
      setError(e instanceof Error ? e.message : msg('Не удалось открыть мастер'));
    } finally {
      setBusy(false);
      opening.current = false;
    }
  }, []);
  useEffect(() => {
    void open();
  }, [open]);

  const save = useCallback(
    async (nextStep: StepKey = step, patch?: Partial<WizardConfig>) => {
      if (saving.current || !ready) return false;
      saving.current = true;
      setBusy(true);
      setError('');
      setSaved('');
      // patch: правка, сделанная в этом же нажатии (setValues ещё не применён): уходит сразу, а не со следующим кругом
      const payload = patch ? { ...values, ...patch } : values;
      const snapshot = JSON.stringify(payload);
      try {
        const result = await call({
          operation: 'save',
          token: token.current,
          config: payload,
          revision: revision.current,
          step: nextStep,
        });
        revision.current = result.draft.revision;
        generationEpoch.current++;
        setGenerationPolling(false);
        setGenerationState(result);
        setSavedJson(snapshot);
        if (patch) setValues(payload);
        setStep(nextStep);
        setSaved(msg('Черновик сохранён'));
        return true;
      } catch (e) {
        if (e instanceof WizardRequestError && e.status === 409) {
          // Keep the user's input; refresh only the revision so a retry can save it.
          try {
            revision.current = (
              await call({ operation: 'scan-status', token: token.current })
            ).draft.revision;
          } catch {
            /* retry after reconnect */
          }
        }
        setError(e instanceof Error ? e.message : msg('Не удалось сохранить черновик'));
        return false;
      } finally {
        saving.current = false;
        setBusy(false);
      }
    },
    [ready, step, values],
  );
  useEffect(() => {
    if (!ready || !dirty || busy || scanning || error) return;
    const timer = setTimeout(() => void save(), 1000);
    return () => clearTimeout(timer);
  }, [ready, dirty, busy, scanning, error, save]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    const epoch = scanEpoch.current;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const state = await call({ operation: 'scan-status', token: token.current });
        if (stopped || epoch !== scanEpoch.current) return;
        const phase = state.scan?.state ?? 'failed';
        setScanPhase(phase);
        if (['queued', 'running'].includes(phase)) {
          timer = setTimeout(() => void poll(), 1500);
          return;
        }
        setScanning(false);
        if (phase === 'succeeded') {
          const restored = { ...INITIAL_CONFIG, ...state.draft.wizardData };
          revision.current = state.draft.revision;
          setValues(restored);
          setSavedJson(JSON.stringify(restored));
          setSaved(S.scan.received);
        } else setError(state.scan?.error ?? S.scan.failed);
      } catch {
        if (!stopped) {
          setScanning(false);
          setError(S.scan.failed);
        }
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [scanning]);

  async function scanSite(patch: Partial<WizardConfig>, challenge: string) {
    if (!(await save('review', patch))) return;
    setBusy(true);
    try {
      await call({
        operation: 'scan',
        token: token.current,
        revision: revision.current,
        challenge,
      });
      setScanPhase('queued');
      setScanning(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : msg('Не удалось прочитать сайт. Заполните данные вручную'),
      );
    } finally {
      setBusy(false);
    }
  }
  async function useManual() {
    scanEpoch.current++;
    setScanning(false);
    setBusy(true);
    try {
      revision.current = (
        await call({ operation: 'scan-status', token: token.current })
      ).draft.revision;
      // Any save increments the revision; retain local fields rather than applying a late result.
      await save('review');
    } catch {
      setError(S.scan.failed);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!generationPolling) return;
    let stopped = false;
    const epoch = generationEpoch.current;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const state = await call({ operation: 'scan-status', token: token.current });
        if (stopped || epoch !== generationEpoch.current) return;
        setGenerationState(state);
        if (
          (state.generation && ['queued', 'running'].includes(state.generation.state)) ||
          state.chat?.messages.some((m) => ['queued', 'running'].includes(m.state))
        )
          timer = setTimeout(() => void poll(), 1500);
        else setGenerationPolling(false);
      } catch {
        if (!stopped && epoch === generationEpoch.current) {
          setGenerationPolling(false);
          setError(S.generation.connectionError);
        }
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [generationPolling]);

  async function generate(challenge: string) {
    if (saving.current || busy || dirty || generationPolling) return;
    setBusy(true);
    setError('');
    try {
      // A terminal failure is cached. Retry explicitly creates a new revision within the five-build cap.
      if (generationState.generation?.state === 'failed') {
        if (!(await save('generating'))) return;
      }
      const job = await call<{ id: string; state: string }>({
        operation: 'generate',
        token: token.current,
        revision: revision.current,
        challenge,
      });
      setGenerationState((current) => ({ ...current, generation: { ...job, error: null } }));
      setGenerationPolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : S.generation.failed);
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(text: string, requestId: string, challenge: string) {
    if (busy || dirty || saving.current) return false;
    setBusy(true);
    setError('');
    try {
      await call({
        operation: 'message',
        token: token.current,
        revision: revision.current,
        text,
        requestId,
        challenge,
      });
      setGenerationState(await call({ operation: 'scan-status', token: token.current }));
      setGenerationPolling(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : msg('Не удалось отправить сообщение'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** События и опрос: не мешают мастеру, ошибки молча теряем (аналитика не должна ломать путь) */
  const track = useCallback(async (type: 'source_submitted' | 'testbot_cta') => {
    try {
      await call({ operation: 'event', token: token.current, type });
    } catch {
      /* аналитика необязательна */
    }
  }, []);
  const sendSurvey = useCallback(async (answers: Record<string, string>) => {
    try {
      await call({ operation: 'survey', token: token.current, answers });
    } catch {
      /* опрос необязателен */
    }
  }, []);

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
      setError(e instanceof Error ? e.message : msg('Не удалось сохранить агента'));
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
      setError(msg('Разрешите хранение данных сайта, чтобы сохранить черновик'));
    }
  }
  return {
    sendMessage,
    generationState,
    generationPolling,
    generate,
    resumeGeneration: () => {
      setError('');
      setGenerationPolling(true);
    },
    scanSiteKey,
    scanning,
    scanPhase,
    scanSite,
    useManual,
    values,
    setValues,
    step,
    resumed,
    setResumed,
    track,
    sendSurvey,
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
