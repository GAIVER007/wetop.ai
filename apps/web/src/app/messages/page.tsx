'use client';
import { useState } from 'react';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { Input } from '../../components/ui';
export default function MessagesPage() {
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(''),
    [drafts, setDrafts] = useState<Array<{ id: number; to: string; text: string }>>([]),
    [selected, setSelected] = useState<number | null>(null),
    [notice, setNotice] = useState('');
  const draft = drafts.find((d) => d.id === selected);
  return (
    <Page
      title="Сообщения"
      subtitle="Переписка с гостями"
      actions={
        <button className="btn" onClick={() => setOpen(true)}>
          <Icon name="plus" />
          Новое сообщение
        </button>
      }
    >
      <div className="messages-workspace">
        <aside className="messages-list">
          <div className="search-field">
            <Icon name="search" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск сообщений"
              placeholder="Поиск переписки"
            />
          </div>
          <div className="directory-meta">
            <span>Черновики этой сессии</span>
            <span>{drafts.length}</span>
          </div>
          {drafts
            .filter((d) => `${d.to} ${d.text}`.toLowerCase().includes(q.toLowerCase()))
            .map((d) => (
              <button
                key={d.id}
                className={`message-item ${selected === d.id ? 'is-selected' : ''}`}
                onClick={() => setSelected(d.id)}
              >
                <span className="guest-initials">{d.to.slice(0, 2).toUpperCase()}</span>
                <span>
                  <strong>{d.to}</strong>
                  <small>{d.text}</small>
                </span>
              </button>
            ))}
          {!drafts.length && <p className="muted small">Нет сохранённых черновиков</p>}
        </aside>
        <section className="message-content">
          {draft ? (
            <>
              <div className="card-heading">
                <h2>{draft.to}</h2>
                <span className="badge badge--warn">Не отправлено</span>
              </div>
              <p className="message-bubble">{draft.text}</p>
              <div className="message-actions">
                <button
                  className="btn btn--secondary"
                  onClick={() => {
                    setDrafts(drafts.filter((d) => d.id !== draft.id));
                    setSelected(null);
                    setNotice('Черновик удалён');
                  }}
                >
                  Удалить черновик
                </button>
              </div>
              <p className="muted small">
                Отправка станет доступна после подключения канала сообщений.
              </p>
            </>
          ) : (
            <div className="empty-state">
              <Icon name="messages" />
              <h3>Здесь начинается диалог</h3>
              <p>Канал сообщений ещё не подключён. Пока можно подготовить черновик.</p>
              <button className="btn btn--secondary" onClick={() => setOpen(true)}>
                Подготовить сообщение
              </button>
            </div>
          )}
        </section>
      </div>
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <Overlay open={open} onClose={() => setOpen(false)} title="Новое сообщение">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const d = {
              id: Date.now(),
              to: String(data.get('to')).trim(),
              text: String(data.get('message')).trim(),
            };
            if (!d.to || !d.text) return;
            setDrafts([...drafts, d]);
            setSelected(d.id);
            setOpen(false);
            setNotice('Черновик сохранён в этой сессии. Сообщение не отправлено.');
          }}
        >
          <label className="field">
            Получатель
            <Input name="to" required placeholder="Имя гостя" />
          </label>
          <label className="field">
            Сообщение
            <textarea
              className="inp"
              name="message"
              rows={5}
              required
              placeholder="Напишите сообщение..."
            />
          </label>
          <button className="btn" type="submit">
            Сохранить черновик
          </button>
        </form>
      </Overlay>
    </Page>
  );
}
