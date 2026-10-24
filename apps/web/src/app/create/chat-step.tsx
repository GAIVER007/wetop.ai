'use client';
import { useRef, useState } from 'react';
import type { WizardChatState } from '../../lib/wizard-types';
import { CHAT } from './strings';
import { ScanChallenge } from './scan-challenge';
import { Textarea } from '../../components/ui';

export function ChatStep({
  state,
  siteKey,
  busy,
  onMessage,
  onRefresh,
}: {
  state: WizardChatState;
  siteKey: string;
  busy: boolean;
  onMessage: (text: string, requestId: string, challenge: string) => Promise<boolean>;
  onRefresh: () => void;
}) {
  const [text, setText] = useState('');
  const [challenge, setChallenge] = useState('');
  const [challengeKey, setChallengeKey] = useState(0);
  const [sending, setSending] = useState(false);
  const pending = useRef<{ text: string; id: string } | null>(null);
  const waiting = state.messages.some((m) => ['queued', 'running'].includes(m.state));
  const left = Math.max(0, state.limit - state.used);
  async function submit() {
    if (!text.trim() || !challenge || busy || sending || waiting || !left) return;
    if (pending.current?.text !== text) pending.current = { text, id: crypto.randomUUID() };
    setSending(true);
    try {
      if (await onMessage(text, pending.current.id, challenge)) {
        setText('');
        pending.current = null;
      }
    } finally {
      setChallenge('');
      setChallengeKey((k) => k + 1);
      setSending(false);
    }
  }
  return (
    <section className="guest-wizard__chat" aria-labelledby="guest-chat-title">
      <h2 id="guest-chat-title">{CHAT.title}</h2>
      <p>{CHAT.note}</p>
      <p role="status">{CHAT.remaining(left, state.limit)}</p>
      <div role="log" aria-label={CHAT.conversation} aria-live="polite">
        {state.messages.map((m) => (
          <article key={`${m.requestId}:${m.role}`}>
            <h3>{m.role === 'user' ? CHAT.you : CHAT.assistant}</h3>
            <p className="guest-wizard__generated-text">{m.text}</p>
            {m.sources.length > 0 && (
              <details>
                <summary>{CHAT.sources}</summary>
                <p>{m.sources.join(', ')}</p>
              </details>
            )}
          </article>
        ))}
      </div>
      {waiting && <p role="status">{CHAT.waiting}</p>}
      {state.failed.length > 0 && <p>{CHAT.failed}</p>}
      {!left ? (
        <p>{CHAT.exhausted}</p>
      ) : (
        <form
          className="guest-wizard__chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="guest-wizard__chips" aria-label={CHAT.examples}>
            {CHAT.suggestions.map((question) => (
              <button
                key={question}
                type="button"
                className="btn btn--secondary"
                disabled={busy || sending || waiting}
                onClick={() => setText(question)}
              >
                {question}
              </button>
            ))}
          </div>
          <label>
            {CHAT.message}
            <Textarea
              value={text}
              maxLength={2000}
              rows={3}
              disabled={busy || sending || waiting}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <ScanChallenge key={challengeKey} siteKey={siteKey} onToken={setChallenge} />
          <button
            type="submit"
            className="btn"
            disabled={busy || sending || waiting || !text.trim() || !challenge}
          >
            {CHAT.send}
          </button>
        </form>
      )}
      <button
        type="button"
        className="btn btn--secondary"
        disabled={busy || sending}
        onClick={onRefresh}
      >
        {CHAT.refresh}
      </button>
    </section>
  );
}
