'use client';
import { useActionState, useState, useTransition, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Fact,
  Field,
  Input,
  Notice,
  Row,
  Select,
  Stack,
  Table,
} from '../../components/ui';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { DOMAIN_EXAMPLE, isPlaceholderHost, primaryHost } from '../../lib/website';
import {
  addDomainAction,
  bookingSettingsAction,
  createSiteAction,
  removeDomainAction,
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
      {/* WEB2: один адрес — как его вставляют из браузера; ещё адреса — списком после подключения */}
      <Field label="Адрес сайта">
        <Input
          name="hosts"
          defaultValue={state?.values?.hosts ?? ''}
          required
          inputMode="url"
          autoComplete="off"
          placeholder={DOMAIN_EXAMPLE}
          data-testid="site-hosts"
        />
      </Field>
      <div>
        <Button type="submit" disabled={pending} data-testid="site-create">
          Подключить сайт
        </Button>
      </div>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.message && <Notice data-testid="site-result">{state.message}</Notice>}
    </form>
  );
}

/** Проверка счётчика: время последнего события и сессии сегодня — тем же запросом, что карточка сайта */
export function CheckCounterButton({
  id,
  label = 'Проверить счётчик',
}: {
  id: string;
  label?: string;
}) {
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
          {label}
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

/**
 * Домены сайта списком (WEB2, п. 6 ТЗ): основной, заглушка, «Убрать» с подтверждением, «Добавить домен». Список для
 * сохранения сервер читает заново (`addDomainAction`, `removeDomainAction`), здесь — только то, что видно.
 */
export function DomainList({ id, hosts }: { id: string; hosts: string[] }) {
  const primary = primaryHost({ hosts });
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<SiteActionResult | null>(null);
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  const add = () =>
    start(async () => {
      const next = await addDomainAction(id, value);
      setResult(next);
      if (!next.error) {
        setValue('');
        setAdding(false);
      }
    });
  const remove = async (host: string) => {
    const ok = await ask({
      title: `Убрать ${host}?`,
      body: `С адреса ${host} и его поддоменов WETOP перестанет принимать посещения и брони: счётчик и виджет на этом сайте замолчат.`,
      confirmLabel: 'Убрать домен',
    });
    if (ok) start(async () => setResult(await removeDomainAction(id, host)));
  };
  return (
    <Stack gap="sm" data-testid="domain-list">
      <Table size="sm" plain aria-label="Домены сайта">
        <tbody>
          {hosts.map((host) => (
            <tr key={host} data-testid="domain-row" data-host={host}>
              {/* домен и плашки в одной ячейке: на телефоне плашка переносится, а не обрезается */}
              <td>
                <span className="row">
                  <strong className="break-all">{host}</strong>
                  {host === primary && <Badge tone="ok">Основной</Badge>}
                  {isPlaceholderHost(host) && <Badge tone="warn">Пример, не сайт</Badge>}
                </span>
              </td>
              <td className="num">
                {hosts.length > 1 && (
                  <Button
                    type="button"
                    tone="ghost"
                    onClick={() => remove(host)}
                    disabled={pending}
                    aria-label={`Убрать ${host}`}
                    data-testid="domain-remove"
                  >
                    Убрать
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {adding ? (
        <form
          className="row row--end"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          data-testid="domain-add-form"
        >
          <Field label="Новый домен">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="url"
              autoComplete="off"
              autoFocus
              placeholder={DOMAIN_EXAMPLE}
              data-testid="domain-input"
            />
          </Field>
          <Button type="submit" disabled={pending} data-testid="domain-save">
            Добавить
          </Button>
          <Button
            type="button"
            tone="ghost"
            onClick={() => {
              setAdding(false);
              setResult(null);
            }}
          >
            Отмена
          </Button>
        </form>
      ) : (
        <div>
          <Button
            type="button"
            tone="secondary"
            onClick={() => setAdding(true)}
            data-testid="domain-add"
          >
            <Icon name="plus" />
            Добавить домен
          </Button>
        </div>
      )}
      <p className="hint">
        www и поддомены подходят сами: {primary ?? DOMAIN_EXAMPLE} принимает и www, и адреса вида
        booking.{primary ?? DOMAIN_EXAMPLE}.
        {hosts.length === 1 && ' Последний адрес не убирается — сначала добавьте другой.'}
      </p>
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.message && <Notice data-testid="domain-result">{result.message}</Notice>}
      {dialog}
    </Stack>
  );
}

/**
 * Окно установки счётчика (WEB2): код в head, Google Tag Manager, конструкторы, проверка и «Дополнительно». Раньше это
 * была раскрывашка в карточке и отдельная «Инструкция» внизу страницы — теперь одно окно по кнопке.
 */
export function InstallCounterButton({
  code,
  siteKey,
  demoUrl,
}: {
  code: string;
  siteKey: string;
  demoUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const demo = (() => {
    try {
      return ['https:', 'http:'].includes(new URL(demoUrl).protocol);
    } catch {
      return false;
    }
  })();
  return (
    <>
      <Button
        type="button"
        tone="secondary"
        onClick={() => setOpen(true)}
        data-testid="site-install"
      >
        Инструкция по установке
      </Button>
      <Overlay drawer open={open} onClose={() => setOpen(false)} title="Установка счётчика WETOP">
        <Stack data-testid="site-install-drawer">
          <InstallStep title="Код для сайта">
            <p className="hint--lg">Вставьте в &lt;head&gt; каждой страницы сайта.</p>
            <pre data-testid="site-card-snippet" className="code">
              {code}
            </pre>
            <Row className="items-start">
              <CopyButton text={code} />
              {demo ? (
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="site-card-demo"
                  title="Страница со счётчиком на адресе API: открыть с телефона и нажать кнопки"
                >
                  Открыть демо-страницу счётчика
                </a>
              ) : (
                <Badge>Демо счётчика не подключено</Badge>
              )}
            </Row>
            <Fact label="Публичный ключ сайта" value={siteKey} testId="site-card-key" />
          </InstallStep>
          <InstallStep title="Через Google Tag Manager">
            <ol className="list hint--lg list--gap">
              <li>Теги → «Создать» → тип тега «Пользовательский HTML».</li>
              <li>Вставьте код выше целиком.</li>
              <li>Триггер — «Все страницы» (All Pages).</li>
              <li>Сохраните тег и опубликуйте контейнер кнопкой «Отправить».</li>
            </ol>
          </InstallStep>
          <InstallStep title="Tilda, WordPress и свой сайт">
            <ul className="list hint--lg list--gap">
              <li>Tilda и другие конструкторы: в настройках сайта — поле для HTML-кода в head.</li>
              <li>WordPress: поле темы или плагина для кода в head.</li>
              <li>Свой сайт: в общем шаблоне, перед закрывающим &lt;/head&gt;.</li>
            </ul>
          </InstallStep>
          <InstallStep title="Проверка">
            <p className="hint--lg">
              Откройте любую страницу сайта и вернитесь сюда: кнопка «Проверить» в карточке покажет
              время последнего события. Проверить без сайта: откройте демо-страницу с телефона и
              нажмите кнопки на ней.
            </p>
          </InstallStep>
          <details className="settings-disclosure">
            <summary>Дополнительно: поиск дат, звонки и согласие</summary>
            <ol className="list hint--lg list--gap">
              <li>
                Счётчик шлёт только: адрес и заголовок страницы, реферер, ширину экрана, язык,
                часовой пояс и случайные ID посетителя и сессии. Без cookies, без IP, без имён и
                телефонов.
              </li>
              <li>
                Форма поиска дат на сайте: при поиске вызовите{' '}
                <code>
                  pms(&apos;event&apos;, &apos;search&apos;, {'{'}arrival: &apos;2026-10-01&apos;,
                  departure: &apos;2026-10-03&apos;, adults: 2{'}'})
                </code>{' '}
                — так заполняется календарь спроса. Клики по телефону и WhatsApp:{' '}
                <code>pms(&apos;event&apos;, &apos;phone_click&apos;)</code>,{' '}
                <code>pms(&apos;event&apos;, &apos;whatsapp_click&apos;)</code>.
              </li>
              <li>
                Нужен баннер согласия — добавьте атрибут <code>data-consent=&quot;wait&quot;</code>{' '}
                и вызовите <code>pms(&apos;consent&apos;)</code> после согласия.
              </li>
            </ol>
          </details>
        </Stack>
      </Overlay>
    </>
  );
}

function InstallStep({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack stack--sm">
      <h3>{title}</h3>
      {children}
    </section>
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
