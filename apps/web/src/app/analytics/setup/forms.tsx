'use client';
import { useActionState, useState, useTransition } from 'react';
import {
  bookingSettingsAction,
  createSiteAction,
  siteAction,
  type SiteActionResult,
} from '../actions';

export function CreateSiteForm() {
  const [state, action, pending] = useActionState<SiteActionResult | null, FormData>(
    createSiteAction,
    null,
  );
  return (
    <form
      action={action}
      style={{ display: 'grid', gap: 8, maxWidth: 520 }}
      data-testid="site-form"
    >
      <label style={lbl}>
        Название
        <input
          name="name"
          required
          placeholder="Сайт хостела"
          style={inp}
          data-testid="site-name"
        />
      </label>
      <label style={lbl}>
        Домены сайта (по одному в строке или через запятую, без https://)
        <textarea
          name="hosts"
          required
          rows={2}
          placeholder={'luxx-aparts.kz\nwww.luxx-aparts.kz'}
          style={inp}
          data-testid="site-hosts"
        />
      </label>
      <div>
        <button type="submit" disabled={pending} style={btn} data-testid="site-create">
          Добавить сайт и получить код
        </button>
      </div>
      {state?.error && (
        <div role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>
          {state.error}
        </div>
      )}
      {state?.message && (
        <div data-testid="site-result" style={{ color: '#166534', fontSize: 13 }}>
          {state.message}
        </div>
      )}
    </form>
  );
}

export function SiteButtons({ id, status }: { id: string; status: 'ACTIVE' | 'PAUSED' }) {
  const [result, setResult] = useState<SiteActionResult | null>(null);
  const [pending, start] = useTransition();
  const run = (kind: 'pause' | 'resume' | 'delete' | 'check') =>
    start(async () => setResult(await siteAction(id, kind)));
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => run('check')}
          disabled={pending}
          style={btn}
          data-testid="site-check"
        >
          Проверить счётчик
        </button>
        <button
          type="button"
          onClick={() => run(status === 'ACTIVE' ? 'pause' : 'resume')}
          disabled={pending}
          style={btnSecondary}
          data-testid="site-toggle"
        >
          {status === 'ACTIVE' ? 'Поставить на паузу' : 'Включить'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Удалить сайт и всю накопленную статистику?')) run('delete');
          }}
          disabled={pending}
          style={btnDanger}
          data-testid="site-delete"
        >
          Удалить
        </button>
      </div>
      {result?.error && (
        <div role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>
          {result.error}
        </div>
      )}
      {result?.message && (
        <div data-testid="site-check-result" style={{ color: '#166534', fontSize: 13 }}>
          {result.message}
        </div>
      )}
    </div>
  );
}

export function BookingSettings({
  id,
  enabled,
  ratePlanCode,
  plans,
}: {
  id: string;
  enabled: boolean;
  ratePlanCode: string;
  plans: Array<{ code: string; name: string }>;
}) {
  const [on, setOn] = useState(enabled);
  const [plan, setPlan] = useState(ratePlanCode || plans[0]?.code || '');
  const [result, setResult] = useState<SiteActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div style={{ display: 'grid', gap: 8 }} data-testid="booking-settings">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
            data-testid="booking-enabled"
          />
          Принимать брони с сайта
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
          Тариф
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            style={inp}
            data-testid="booking-rate-plan"
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() =>
            start(async () =>
              setResult(await bookingSettingsAction(id, { enabled: on, ratePlanCode: plan })),
            )
          }
          disabled={pending}
          style={btn}
          data-testid="booking-save"
        >
          Сохранить
        </button>
      </div>
      {result?.error && (
        <div role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>
          {result.error}
        </div>
      )}
      {result?.message && (
        <div data-testid="booking-result" style={{ color: '#166534', fontSize: 13 }}>
          {result.message}
        </div>
      )}
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      style={btnSecondary}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* буфер недоступен — код можно выделить руками */
        }
      }}
    >
      {done ? 'Скопировано' : 'Скопировать код'}
    </button>
  );
}

const lbl: React.CSSProperties = { display: 'grid', gap: 4, fontSize: 13, color: '#444' };
const inp: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #cfd3d8',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'inherit',
};
const btn: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #2a78d6',
  background: '#2a78d6',
  color: '#fff',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
};
const btnSecondary: React.CSSProperties = {
  ...btn,
  background: '#fff',
  color: '#2a78d6',
};
const btnDanger: React.CSSProperties = {
  ...btn,
  background: '#fff',
  color: '#b91c1c',
  border: '1px solid #b91c1c',
};
