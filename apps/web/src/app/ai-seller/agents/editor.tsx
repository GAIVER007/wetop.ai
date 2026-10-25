'use client';
import { useState, useEffect, useRef } from 'react';
import type { SellerAgentCard } from '../../../lib/api';
import { WizardFields, INITIAL_CONFIG } from '../../create/wizard-fields';
import { useRouter } from 'next/navigation';
import { saveAgent, createAgent } from './actions';
import { useT } from '../../../i18n/locale-provider';

export function AgentEditor({
  agent,
  creating = false,
}: {
  agent: SellerAgentCard;
  creating?: boolean;
}) {
  const router = useRouter();
  const t = useT();
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
        setMessage(t('Настройки сохранены'));
      } else setError(result.error);
    } catch {
      setError(t('Не удалось сохранить. Проверьте соединение и повторите.'));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="guest-wizard__card">
      <h2>{t('Настройки агента')}</h2>
      <p>{t('Черновик: {name}', { name: values.assistantName || values.businessName || t('Новый агент') })}</p>
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
            {creating ? t('Создать агента') : t('Сохранить настройки')}
          </button>
        </fieldset>
      </form>
      <p role="status">
        {busy
          ? t('Сохраняем…')
          : message ||
            (creating
              ? t('Заполните данные и создайте черновик')
              : dirty
                ? t('Есть несохранённые изменения')
                : t('Все изменения сохранены'))}
      </p>
      <p>
        {t('Сохранение не запускает агента. Подключение новых агентов к модели и каналам ещё в разработке.')}
      </p>
    </section>
  );
}
