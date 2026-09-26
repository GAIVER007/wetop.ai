import type { ChangeEvent } from 'react';
export const INITIAL_CONFIG = {
  assistantName: '',
  businessName: '',
  niche: '',
  description: '',
  goal: '',
  advantages: '',
  currency: 'KZT',
  timezone: 'Asia/Almaty',
  botType: 'sales',
};
export type WizardConfig = typeof INITIAL_CONFIG;
export function WizardFields({
  values,
  onChange,
}: {
  values: WizardConfig;
  onChange: (key: keyof WizardConfig, value: string) => void;
}) {
  const change =
    (key: keyof WizardConfig) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(key, e.target.value);
  return (
    <div className="guest-wizard__fields">
      <label>
        Имя ассистента
        <input
          value={values.assistantName}
          onChange={change('assistantName')}
          maxLength={40}
          placeholder="Например, Алина"
          autoComplete="off"
        />
      </label>
      <label>
        Название компании
        <input
          required
          value={values.businessName}
          onChange={change('businessName')}
          maxLength={200}
          autoComplete="organization"
        />
      </label>
      <label>
        Ниша
        <input
          required
          value={values.niche}
          onChange={change('niche')}
          maxLength={200}
          placeholder="Например, хостел"
        />
      </label>
      <label>
        Основная цель
        <input
          value={values.goal}
          onChange={change('goal')}
          maxLength={1000}
          placeholder="Помочь подобрать размещение"
        />
      </label>
      <label className="guest-wizard__wide">
        Описание
        <textarea
          value={values.description}
          onChange={change('description')}
          maxLength={10000}
          rows={4}
          placeholder="Чем занимаетесь и что важно знать вашему агенту"
        />
      </label>
      <label className="guest-wizard__wide">
        Ключевые преимущества
        <textarea
          value={values.advantages}
          onChange={change('advantages')}
          maxLength={2000}
          rows={2}
          placeholder="Укажите подтверждённые преимущества"
        />
      </label>
      <label>
        Валюта
        <select value={values.currency} onChange={change('currency')}>
          {['KZT', 'USD', 'EUR', 'RUB', 'GBP'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Часовой пояс
        <select value={values.timezone} onChange={change('timezone')}>
          <option value="Asia/Almaty">Алматы / Астана (UTC+5)</option>
          <option value="Europe/Moscow">Москва (UTC+3)</option>
          <option value="UTC">UTC</option>
          <option value="Asia/Dubai">Дубай (UTC+4)</option>
        </select>
      </label>
    </div>
  );
}
