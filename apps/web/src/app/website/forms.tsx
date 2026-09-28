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
} from '../../components/ui';
import {
  bookingSettingsAction,
  createSiteAction,
  hostsAction,
  siteAction,
  type SiteActionResult,
} from './actions';
import { useConfirm } from '../../components/use-confirm';

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

/** Проверка счётчика: время последнего события и сессии сегодня — тем же запросом, что карточка сайта */
export function CheckCounterButton({ id }: { id: string }) {
  const [result, setResult] = useState<SiteActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <Stack gap="sm">
      <Row>
        <Button
          type="button"
          tone="secondary"
          onClick={() => start(async () => setResult(await siteAction(id, 'check')))}
          disabled={pending}
          data-testid="site-check"
        >
          Проверить счётчик
        </Button>
      </Row>
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.message && <Notice data-testid="site-check-result">{result.message}</Notice>}
    </Stack>
  );
}

/**
 * «Опасная зона» (ADR-117): пауза и удаление внизу карточки, оба через подтверждение. Пауза сайта останавливает
 * и счётчик, и виджет бронирования (так работает API) — прежняя «Поставить на паузу» говорила только про счётчик.
 */
export function SiteDangerZone({ id, status }: { id: string; status: 'ACTIVE' | 'PAUSED' }) {
  const [result, setResult] = useState<SiteActionResult | null>(null);
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  const run = (kind: 'pause' | 'resume' | 'delete') =>
    start(async () => setResult(await siteAction(id, kind)));
  return (
    <Stack gap="sm">
      <Row>
        <Button
          type="button"
          tone="secondary"
          onClick={async () => {
            if (status !== 'ACTIVE') return run('resume');
            const ok = await ask({
              title: 'Приостановить сайт?',
              body: 'Пока сайт приостановлен, счётчик не записывает посещения, а виджет на сайте не принимает брони. Возобновить можно здесь же.',
              confirmLabel: 'Приостановить',
            });
            if (ok) run('pause');
          }}
          disabled={pending}
          data-testid="site-toggle"
        >
          {status === 'ACTIVE' ? 'Приостановить сайт' : 'Возобновить сайт'}
        </Button>
        <Button
          type="button"
          tone="secondary"
          className="is-danger"
          onClick={async () => {
            const ok = await ask({
              title: 'Удалить подключение сайта?',
              body: 'Вместе с подключением исчезнет вся накопленная статистика посещений; код счётчика и виджета на странице сайта перестанет работать. Вернуть данные будет нельзя.',
              confirmLabel: 'Удалить подключение',
            });
            if (ok) run('delete');
          }}
          disabled={pending}
          data-testid="site-delete"
        >
          Удалить подключение сайта
        </Button>
      </Row>
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.message && <Notice data-testid="site-toggle-result">{result.message}</Notice>}
      {dialog}
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
