'use client';
import { useEffect, useRef } from 'react';
import { S } from './strings';
import { useT } from '../../i18n/locale-provider';

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
let loading: Promise<Turnstile> | undefined;
function load(): Promise<Turnstile> {
  const api = () => (window as typeof window & { turnstile?: Turnstile }).turnstile;
  if (api()) return Promise.resolve(api()!);
  if (!loading)
    loading = new Promise<Turnstile>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => (api() ? resolve(api()!) : reject(new Error('challenge unavailable')));
      script.onerror = () => reject(new Error('challenge unavailable'));
      document.head.appendChild(script);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

export function ScanChallenge({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (value: string) => void;
}) {
  const t = useT();
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let stopped = false;
    let id: string | undefined;
    let api: Turnstile | undefined;
    void load()
      .then((value) => {
        if (stopped || !element.current) return;
        api = value;
        id = api.render(element.current, {
          sitekey: siteKey,
          action: 'wizard',
          callback: onToken,
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        });
      })
      .catch(() => onToken(''));
    return () => {
      stopped = true;
      if (id) api?.remove(id);
    };
  }, [siteKey, onToken]);
  return <div ref={element} role="group" aria-label={t(S.scan.challengeLabel)} />;
}
