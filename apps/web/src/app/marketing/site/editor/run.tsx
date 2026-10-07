'use client';
import { useEffect, useRef, useState } from 'react';
import { GENERATION_ERROR_TEXT, isGenerationErrorCode } from '@pms/domain';
import type { GenerationRunView } from '../../../../lib/api';
import { runAction } from './actions';

/** Состояние задачи ИИ словами (MKT9 §114) */
export const RUN_STATE: Record<GenerationRunView['status'], string> = {
  QUEUED: 'В очереди',
  RUNNING: 'ИИ работает',
  SUCCEEDED: 'Готово',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменено',
};

/** Ошибка ИИ человеку: только постоянный текст по коду, ответ модели и поставщика не показываются */
export function runErrorText(run: GenerationRunView): string {
  return isGenerationErrorCode(run.errorCode) ? GENERATION_ERROR_TEXT[run.errorCode] : 'ИИ не смог выполнить задачу';
}

const POLL_MS = 1500;
const finished = (status: GenerationRunView['status']) => status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED';

/** Опрос статуса задачи существующим маршрутом, пока она не закончится */
export function useGenerationRun(onDone: (run: GenerationRunView) => void) {
  const [run, setRun] = useState<GenerationRunView | null>(null);
  const [lost, setLost] = useState<string | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!run || finished(run.status)) return;
    const timer = setTimeout(async () => {
      const reply = await runAction(run.id);
      if (!reply.ok) return setLost(reply.message);
      setLost(null);
      setRun(reply.data.run);
      if (finished(reply.data.run.status)) done.current(reply.data.run);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [run]);
  const active = !!run && !finished(run.status);
  return { run, active, lost, start: setRun, clear: () => setRun(null) };
}
