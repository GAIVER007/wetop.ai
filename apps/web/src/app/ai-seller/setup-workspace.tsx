'use client';

import Link from 'next/link';
import { useState, type ReactNode, type FormEvent } from 'react';

/** Visual preview only. Answers and publication still use the server-backed seller screens. */
export function SetupWorkspace({
  name,
  greeting,
  children,
  navigation,
}: {
  name: string | null;
  greeting: string;
  children: ReactNode;
  navigation: ReactNode;
}) {
  const [preview, setPreview] = useState({ name: name ?? '', greeting });
  function update(event: FormEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target.name === 'botName') setPreview((value) => ({ ...value, name: target.value }));
    if (target.name === 'greeting') setPreview((value) => ({ ...value, greeting: target.value }));
  }
  return (
    <div className="seller-workspace" onChange={update}>
      <div className="seller-workspace__navigation">{navigation}</div>
      <div className="seller-workspace__editor">{children}</div>
      <aside className="seller-preview" aria-label="Превью агента">
        <div className="seller-preview__heading">
          <span className="seller-preview__avatar" aria-hidden="true">
            AI
          </span>
          <div>
            <strong>{preview.name.trim() || 'Ваш помощник'}</strong>
            <p>Превью приветствия</p>
          </div>
        </div>
        <div className="seller-preview__body">
          <p className="seller-preview__message">
            {preview.greeting.trim() ||
              'Добавьте приветствие — здесь появится первое сообщение вашего агента.'}
          </p>
        </div>
        <div className="seller-preview__footer">
          <p>Здесь виден внешний вид сообщения. Ответы на вопросы проверяются в тестовом чате.</p>
          <Link className="btn btn--secondary" href="/ai-seller/check">
            Открыть тестовый чат
          </Link>
        </div>
      </aside>
    </div>
  );
}
