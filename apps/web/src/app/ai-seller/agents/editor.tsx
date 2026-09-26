'use client';
import { useState, useEffect, useRef } from 'react';
import type { SellerAgentCard } from '../../../lib/api';
import { WizardFields, INITIAL_CONFIG } from '../../create/wizard-fields';
import { useRouter } from 'next/navigation';
import { saveAgent, createAgent } from './actions';

export function AgentEditor({
  agent,
  creating = false,
}: {
  agent: SellerAgentCard;
  creating?: boolean;
}) {
  const router = useRouter();
  const creationId = useRef('');
  const [values, setValues] = useState({ ...INITIAL_CONFIG, ...agent.profile });
  const [saved, setSaved] = useState(JSON.stringify(values));
  const [version, setVersion] = useState(agent.updatedAt);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const dirty = JSON.stringify(values) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function submit() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    const snapshot = JSON.stringify(values);
    try {
      if (creating) {
        creationId.current ||= crypto.randomUUID();
        const created = await createAgent(creationId.current, values);
        if (created.ok) {
          setSaved(snapshot);
          router.replace('/ai-seller/agents/' + created.id);
        } else setError(created.error);
        return;
      }
      const result = await saveAgent(agent.id, values, version);
      if (result.ok) {
        setVersion(result.updatedAt);
        setSaved(snapshot);
        setMessage('Настройки сохранены');
      } else setError(result.error);
    } catch {
      setError('Не удалось сохранить. Проверьте соединение и повторите.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="guest-wizard__card">
      <h2>Настройки агента</h2>
      <p>Черновик: {values.assistantName || values.businessName || 'Новый агент'}</p>
      {error && <p role="alert">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset
          disabled={busy || agent.lifecycle !== 'draft'}
          style={{ border: 0, padding: 0, margin: 0 }}
        >
          <WizardFields
            values={values}
            onChange={(key, value) => {
              setValues((v) => ({ ...v, [key]: value }));
              setMessage('');
            }}
          />
          <button className="btn" type="submit" disabled={!dirty && !creating}>
            {creating ? 'Создать агента' : 'Сохранить настройки'}
          </button>
        </fieldset>
      </form>
      <p role="status">
        {busy
          ? 'Сохраняем…'
          : message || (creating ? 'Заполните данные и создайте черновик' : dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены')}
      </p>
      <p>
        Сохранение не запускает агента. Подключение новых агентов к модели и каналам ещё в
        разработке.
      </p>
    </section>
  );
}
