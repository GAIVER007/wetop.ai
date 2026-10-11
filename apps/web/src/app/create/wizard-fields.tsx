import { useState, type ChangeEvent } from 'react';
import { NICHES, OTHER_NICHE, S } from './strings';
export const INITIAL_CONFIG = {
  assistantName: '',
  businessName: '',
  niche: '',
  description: '',
  goal: '',
  advantages: '',
  currency: 'KZT',
  timezone: 'Asia/Almaty', // tz-allow: начальное значение поля мастера, человек выбирает сам
  botType: 'sales',
  siteUrl: '',
  /** Имена полей, найденных по сайту, через запятую (заполняет сканирование) */
  foundFields: '',
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
  const found = new Set(values.foundFields.split(',').filter(Boolean));
  const mark = (key: keyof WizardConfig) =>
    found.has(key) ? <em className="guest-wizard__found">{S.review.found}</em> : null;
  const preset = (NICHES as readonly string[]).includes(values.niche);
  // «Другое» выбрано, пока ниша не из списка: пустая ниша без выбора остаётся «Выберите»
  const [other, setOther] = useState(values.niche !== '' && !preset);
  const selectValue = other ? OTHER_NICHE : preset ? values.niche : '';
  return (
    <div className="guest-wizard__fields">
      <label>
        <span>Имя ассистента</span>
        <input
          value={values.assistantName}
          onChange={change('assistantName')}
          maxLength={40}
          placeholder="Например, Алина"
          autoComplete="off"
        />
      </label>
      <label>
        <span>
          Название компании {mark('businessName')}
        </span>
        <input
          required
          value={values.businessName}
          onChange={change('businessName')}
          maxLength={200}
          autoComplete="organization"
        />
      </label>
      <label>
        <span>Ниша {mark('niche')}</span>
        <select
          required
          value={selectValue}
          onChange={(e) => {
            if (e.target.value === OTHER_NICHE) {
              setOther(true);
              onChange('niche', '');
            } else {
              setOther(false);
              onChange('niche', e.target.value);
            }
          }}
        >
          <option value="">{S.review.nichePick}</option>
          {NICHES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value={OTHER_NICHE}>{S.review.nicheOther}</option>
        </select>
      </label>
      {other && (
        <label>
          <span>{S.review.nicheOwn}</span>
          <input
            required
            value={values.niche}
            onChange={change('niche')}
            maxLength={200}
            placeholder="Например, стоматология"
          />
        </label>
      )}
      <label>
        <span>Основная цель {mark('goal')}</span>
        <input
          value={values.goal}
          onChange={change('goal')}
          maxLength={1000}
          placeholder={
            values.botType === 'support' ? 'Ответить на вопросы гостей' : 'Помочь подобрать размещение'
          }
        />
      </label>
      <label className="guest-wizard__wide">
        <span>Описание {mark('description')}</span>
        <textarea
          value={values.description}
          onChange={change('description')}
          maxLength={10000}
          rows={4}
          placeholder="Чем занимаетесь и что важно знать вашему агенту"
        />
      </label>
      <label className="guest-wizard__wide">
        <span>Ключевые преимущества {mark('advantages')}</span>
        <textarea
          value={values.advantages}
          onChange={change('advantages')}
          maxLength={2000}
          rows={2}
          placeholder="Укажите подтверждённые преимущества"
        />
      </label>
      <label>
        <span>Валюта</span>
        <select value={values.currency} onChange={change('currency')}>
          {['KZT', 'USD', 'EUR', 'RUB', 'GBP'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Часовой пояс</span>
        <select value={values.timezone} onChange={change('timezone')}>
          {/* tz-allow: вариант в списке поясов, человек выбирает сам */}
          <option value="Asia/Almaty">Алматы / Астана (UTC+5)</option>
          <option value="Europe/Moscow">Москва (UTC+3)</option>
          <option value="UTC">UTC</option>
          <option value="Asia/Dubai">Дубай (UTC+4)</option>
        </select>
      </label>
    </div>
  );
}
