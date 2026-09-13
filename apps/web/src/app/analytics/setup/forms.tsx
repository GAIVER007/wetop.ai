'use client';
import { useActionState, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Field,
  Input,
  Notice,
  Row,
  Select,
  Stack,
  Textarea,
} from '../../../components/ui';
import {
  bookingSettingsAction,
  createSiteAction,
  hostsAction,
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
      key={state?.attempt ?? 0}
      action={action}
      className="stack stack--sm form-narrow"
      data-testid="site-form"
    >
      <Field label="Название">
        <Input
          name="name"
          defaultValue={state?.values?.name ?? ''}
          required
          placeholder="Сайт хостела"
          data-testid="site-name"
        />
      </Field>
      <Field label="Домены без https://, через запятую">
        <Textarea
          name="hosts"
          defaultValue={state?.values?.hosts ?? ''}
          required
          rows={2}
          placeholder={'luxx-aparts.kz\nwww.luxx-aparts.kz'}
          data-testid="site-hosts"
        />
      </Field>
      <div>
        <Button type="submit" disabled={pending} data-testid="site-create">
          Добавить сайт
        </Button>
      </div>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.message && <Notice data-testid="site-result">{state.message}</Notice>}
    </form>
  );
}

export function SiteButtons({ id, status }: { id: string; status: 'ACTIVE' | 'PAUSED' }) {
  const [result, setResult] = useState<SiteActionResult | null>(null);
  const [pending, start] = useTransition();
  const run = (kind: 'pause' | 'resume' | 'delete' | 'check') =>
    start(async () => setResult(await siteAction(id, kind)));
  return (
    <Stack gap="sm">
      <Row>
        <Button
          type="button"
          onClick={() => run('check')}
          disabled={pending}
          data-testid="site-check"
        >
          Проверить счётчик
        </Button>
        <Button
          type="button"
          tone="secondary"
          onClick={() => run(status === 'ACTIVE' ? 'pause' : 'resume')}
          disabled={pending}
          data-testid="site-toggle"
        >
          {status === 'ACTIVE' ? 'Поставить на паузу' : 'Включить'}
        </Button>
        <Button
          type="button"
          tone="secondary"
          className="is-danger"
          onClick={() => {
            if (window.confirm('Удалить сайт и всю накопленную статистику?')) run('delete');
          }}
          disabled={pending}
          data-testid="site-delete"
        >
          Удалить
        </Button>
      </Row>
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.message && <Notice data-testid="site-check-result">{result.message}</Notice>}
    </Stack>
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
    <Stack gap="sm" data-testid="booking-settings">
      <Row gap="lg">
        <label className="check">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
            data-testid="booking-enabled"
          />
          Принимать брони с сайта
        </label>
        <Field inline label="Тариф">
          <Select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            data-testid="booking-rate-plan"
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          type="button"
          onClick={() =>
            start(async () =>
              setResult(await bookingSettingsAction(id, { enabled: on, ratePlanCode: plan })),
            )
          }
          disabled={pending || (on && !plans.some((p) => p.code === plan))}
          data-testid="booking-save"
        >
          Сохранить
        </Button>
      </Row>
      {result?.error && <Alert>{result.error}</Alert>}
      {on && !plans.length && <Alert>Нет доступных тарифов для виджета.</Alert>}
      {result?.message && <Notice data-testid="booking-result">{result.message}</Notice>}
    </Stack>
  );
}

export function HostsForm({ id, hosts }: { id: string; hosts: string[] }) {
  const [value, setValue] = useState(hosts.join('\n'));
  const [result, setResult] = useState<SiteActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <Stack gap="sm" className="form-narrow" data-testid="hosts-form">
      <Field label="Домены сайта (по одному в строке; поддомены и www подходят сами)">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          data-testid="hosts-input"
        />
      </Field>
      <div>
        <Button
          type="button"
          tone="secondary"
          onClick={() => start(async () => setResult(await hostsAction(id, value)))}
          disabled={pending}
          data-testid="hosts-save"
        >
          Сохранить домены
        </Button>
      </div>
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.message && <Notice data-testid="hosts-result">{result.message}</Notice>}
    </Stack>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="stack stack--sm">
      <Button
        type="button"
        tone="secondary"
        onClick={async () => {
          setError(false);
          try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          } catch {
            setError(true);
          }
        }}
      >
        {done ? 'Скопировано' : 'Скопировать код'}
      </Button>
      {error && <Alert>Не удалось скопировать. Выделите код вручную.</Alert>}
    </div>
  );
}
