'use client';
import { useState } from 'react';
import { BUILDER_INSTRUCTIONS_MAX } from '@pms/domain';
import { Button, Field, Textarea } from '../../../../components/ui';
import { saveContextAction } from './actions';

/**
 * «Знания проекта» (MKT9.2): постоянные указания ИИ этого сайта, их видит каждый запрос (тон, что подчёркивать, чего
 * избегать). Это данные для модели, а не правила: цены, контакты и правила безопасности они не отменяют. Хранятся в
 * сайте филиала отдельно от документа, поэтому сохраняются своей кнопкой и новой версии сайта не создают.
 */
export function ProjectKnowledge({ initial, readOnly }: { initial: string | null; readOnly: boolean }) {
  const [saved, setSaved] = useState(initial ?? '');
  const [text, setText] = useState(initial ?? '');
  const [state, setState] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const changed = text.trim() !== saved.trim();
  return (
    <section className="ed-form" aria-labelledby="ed-knowledge-title" data-testid="ed-knowledge">
      <h2 id="ed-knowledge-title" className="ed-form__title">
        Знания проекта
      </h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!changed || busy) return;
          setBusy(true);
          const r = await saveContextAction(text);
          setBusy(false);
          if (!r.ok) return setState({ tone: 'error', text: r.message });
          setSaved(r.data.instructions ?? '');
          setText(r.data.instructions ?? '');
          setState({ tone: 'ok', text: 'Знания проекта сохранены: ИИ учтёт их в следующих запросах' });
        }}
      >
        <Field
          label="Что ИИ должен всегда учитывать на этом сайте"
          controlId="ed-knowledge-text"
          hint="Например: тон спокойный, без восклицаний; подчёркивать тишину и близость к вокзалу. Цены и контакты ИИ всё равно берёт только из данных филиала."
        >
          <Textarea rows={5} maxLength={BUILDER_INSTRUCTIONS_MAX} value={text} disabled={readOnly} onChange={(e) => setText(e.currentTarget.value)} />
        </Field>
        <div className="ed-row">
          <Button type="submit" size="sm" disabled={readOnly || !changed || busy} data-testid="ed-knowledge-save">
            {busy ? 'Сохраняем…' : 'Сохранить знания'}
          </Button>
          <span className="muted">
            {[...text].length} из {BUILDER_INSTRUCTIONS_MAX}
          </span>
        </div>
        {state && (
          <p className={state.tone === 'error' ? 'ed-error' : 'muted'} role={state.tone === 'error' ? 'alert' : 'status'} data-testid="ed-knowledge-state">
            {state.text}
          </p>
        )}
      </form>
    </section>
  );
}
