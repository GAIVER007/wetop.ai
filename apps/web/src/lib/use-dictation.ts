'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Диктовка браузером (Web Speech Recognition): один хук на стойку. Был внутри редактора инструкции ИИ-агента
 * (`app/ai-agents/[id]/instruction-editor.tsx`), с SITE-1 им же пользуется чат первого экрана «Сайт и SEO».
 *
 * Расшифровку делает сервис браузера; стойка получает только итоговый текст фразы. Поддержку браузера хук узнаёт после
 * монтирования (`supported`), поэтому серверная и первая клиентская отрисовка совпадают: кнопку, которой не будет,
 * экран может просто не рисовать.
 */
export type DictationLang = 'ru-RU' | 'kk-KZ' | 'en-US';
export const DICTATION_LANGS: ReadonlyArray<{ value: DictationLang; label: string }> = [
  { value: 'ru-RU', label: 'Русский' },
  { value: 'kk-KZ', label: 'Қазақша' },
  { value: 'en-US', label: 'English' },
];

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

export const DICTATION_TEXT = {
  unsupported: 'В этом браузере диктовка недоступна. Введите текст или воспользуйтесь системной диктовкой.',
  denied: 'Доступ к микрофону не разрешён. Разрешите его в браузере или введите текст.',
  failed: 'Не удалось распознать речь. Проверьте микрофон или продолжите текстом.',
  start: 'Не удалось начать диктовку. Попробуйте ещё раз или введите текст.',
} as const;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const browser = window as typeof window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

/** Итоговые фразы события распознавания одной строкой; промежуточные не берутся */
export function finalTranscript(event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }): string {
  const parts: string[] = [];
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const r = event.results[i];
    if (r?.isFinal) parts.push(r[0].transcript.trim());
  }
  return parts.filter(Boolean).join(' ');
}

/** Дописать фразу к тексту через пробел, с пределом длины поля */
export function appendDictated(previous: string, phrase: string, max: number): string {
  if (!phrase) return previous;
  return `${previous}${previous && !/\s$/.test(previous) ? ' ' : ''}${phrase}`.slice(0, max);
}

export function useDictation({
  lang = 'ru-RU',
  onText,
  onError,
}: {
  lang?: DictationLang;
  /** итоговая фраза; дописывает её в поле вызывающий */
  onText: (phrase: string) => void;
  onError: (message: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const handlers = useRef({ onText, onError });
  handlers.current = { onText, onError };

  useEffect(() => {
    setSupported(recognitionCtor() !== null);
    return () => {
      const r = recognition.current;
      if (!r) return;
      r.onend = null;
      r.onresult = null;
      r.onerror = null;
      r.abort();
    };
  }, []);

  const stop = useCallback(() => {
    recognition.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return handlers.current.onError(DICTATION_TEXT.unsupported);
    const recorder = new Ctor();
    recognition.current = recorder;
    recorder.lang = lang;
    recorder.continuous = true;
    recorder.interimResults = false;
    recorder.onresult = (event) => {
      const phrase = finalTranscript(event);
      if (phrase) handlers.current.onText(phrase);
    };
    recorder.onerror = (event) => {
      setListening(false);
      handlers.current.onError(event.error === 'not-allowed' ? DICTATION_TEXT.denied : DICTATION_TEXT.failed);
    };
    recorder.onend = () => setListening(false);
    try {
      recorder.start();
      setListening(true);
    } catch {
      handlers.current.onError(DICTATION_TEXT.start);
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (recognition.current && listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, toggle, stop };
}
