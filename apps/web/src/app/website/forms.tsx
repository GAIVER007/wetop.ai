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
import { DOMAIN_EXAMPLE, isOpenableUrl, isPlaceholderHost, primaryHost } from '../../lib/website';
import {
  addDomainAction,
  bookingSettingsAction,
  createSiteAction,
  removeDomainAction,
  siteAction,
  type SiteActionResult,
} from './actions';
import { useConfirm } from '../../components/use-confirm';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

export function CreateSiteForm() {
  const [state, action, pending] = useActionState<SiteActionResult | null, FormData>(
    createSiteAction,
    null,
  );
  const t = useT();
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="stack stack--sm form-narrow"
      data-testid="site-form"
    >
      <Field label={t('Название')}>
        <Input
          name="name"
          defaultValue={state?.values?.name ?? ''}
          required
          placeholder={t('Сайт хостела')}
          data-testid="site-name"
        />
      </Field>
      {/* WEB2: один адрес — как его вставляют из браузера; ещё адреса — списком после подключения */}
      <Field label={t('Адрес сайта')}>
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
          {t('Подключить сайт')}
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
  label = msg('Проверить счётчик'),
}: {
  id: string;
  label?: string;
}) {
  const [result, setResult] = useState<SiteActionResult | null>(null);
  const [pending, start] = useTransition();
  const t = useT();
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
          {t(label)}
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
  const t = useT();
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
              title: t('Приостановить сайт?'),
              body: t('Пока сайт приостановлен, счётчик не записывает посещения, а виджет на сайте не принимает брони. Возобновить можно здесь же.'),
              confirmLabel: t('Приостановить'),
            });
            if (ok) run('pause');
          }}
          disabled={pending}
          data-testid="site-toggle"
        >
          {status === 'ACTIVE' ? t('Приостановить сайт') : t('Возобновить сайт')}
        </Button>
        <Button
          type="button"
          tone="secondary"
          className="is-danger"
          onClick={async () => {
            const ok = await ask({
              title: t('Удалить подключение сайта?'),
              body: t('Вместе с подключением исчезнет вся накопленная статистика посещений; код счётчика и виджета на странице сайта перестанет работать. Вернуть данные будет нельзя.'),
              confirmLabel: t('Удалить подключение'),
            });
            if (ok) run('delete');
          }}
          disabled={pending}
          data-testid="site-delete"
        >
          {t('Удалить подключение сайта')}
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
  const t = useT();
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
          {t('Принимать брони с сайта')}
        </label>
        <Field inline label={t('Тариф')}>
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
          {t('Сохранить')}
        </Button>
      </Row>
      <p className="hint">
        {t('Виджет показывает категории этого тарифа и его цены; отмена — по правилам тарифа.')}
      </p>
      {result?.error && <Alert>{result.error}</Alert>}
      {on && !plans.length && <Alert>{t('Нет доступных тарифов для виджета.')}</Alert>}
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
  const t = useT();
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
      title: t('Убрать {host}?', { host }),
      body: t('С адреса {host} и его поддоменов WETOP перестанет принимать посещения и брони: счётчик и виджет на этом сайте замолчат.', { host }),
      confirmLabel: t('Убрать домен'),
    });
    if (ok) start(async () => setResult(await removeDomainAction(id, host)));
  };
  return (
    <Stack gap="sm" data-testid="domain-list">
      <Table size="sm" plain aria-label={t('Домены сайта')}>
        <tbody>
          {hosts.map((host) => (
            <tr key={host} data-testid="domain-row" data-host={host}>
              {/* домен и плашки в одной ячейке: на телефоне плашка переносится, а не обрезается */}
              <td>
                <span className="row">
                  <strong className="break-all">{host}</strong>
                  {host === primary && <Badge tone="ok">{t('Основной')}</Badge>}
                  {isPlaceholderHost(host) && <Badge tone="warn">{t('Пример, не сайт')}</Badge>}
                </span>
              </td>
              <td className="num">
                {hosts.length > 1 && (
                  <Button
                    type="button"
                    tone="ghost"
                    onClick={() => remove(host)}
                    disabled={pending}
                    aria-label={t('Убрать {host}', { host })}
                    data-testid="domain-remove"
                  >
                    {t('Убрать')}
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
          <Field label={t('Новый домен')}>
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
            {t('Добавить')}
          </Button>
          <Button
            type="button"
            tone="ghost"
            onClick={() => {
              setAdding(false);
              setResult(null);
            }}
          >
            {t('Отмена')}
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
            {t('Добавить домен')}
          </Button>
        </div>
      )}
      <p className="hint">
        {t('www и поддомены подходят сами: {host} принимает и www, и адреса вида booking.{host}.', { host: primary ?? DOMAIN_EXAMPLE })}
        {hosts.length === 1 && ` ${t('Последний адрес не убирается — сначала добавьте другой.')}`}
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
  const demo = isOpenableUrl(demoUrl);
  const t = useT();
  return (
    <>
      <Button
        type="button"
        tone="secondary"
        onClick={() => setOpen(true)}
        data-testid="site-install"
      >
        {t('Инструкция по установке')}
      </Button>
      <Overlay drawer open={open} onClose={() => setOpen(false)} title={t('Установка счётчика WETOP')}>
        <Stack data-testid="site-install-drawer">
          <InstallStep title={t('Код для сайта')}>
            <p className="hint--lg">{t('Вставьте в <head> каждой страницы сайта.')}</p>
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
                  title={t('Страница со счётчиком на адресе API: открыть с телефона и нажать кнопки')}
                >
                  {t('Открыть демо-страницу счётчика')}
                </a>
              ) : (
                <Badge>{t('Демо счётчика не подключено')}</Badge>
              )}
            </Row>
            <Fact label={t('Публичный ключ сайта')} value={siteKey} testId="site-card-key" />
          </InstallStep>
          <InstallStep title={t('Через Google Tag Manager')}>
            <ol className="list hint--lg list--gap">
              <li>{t('Теги → «Создать» → тип тега «Пользовательский HTML».')}</li>
              <li>{t('Вставьте код выше целиком.')}</li>
              <li>{t('Триггер — «Все страницы» (All Pages).')}</li>
              <li>{t('Сохраните тег и опубликуйте контейнер кнопкой «Отправить».')}</li>
            </ol>
          </InstallStep>
          <InstallStep title={t('Tilda, WordPress и свой сайт')}>
            <ul className="list hint--lg list--gap">
              <li>{t('Tilda и другие конструкторы: в настройках сайта — поле для HTML-кода в head.')}</li>
              <li>{t('WordPress: поле темы или плагина для кода в head.')}</li>
              <li>{t('Свой сайт: в общем шаблоне, перед закрывающим </head>.')}</li>
            </ul>
          </InstallStep>
          <InstallStep title={t('Проверка')}>
            <p className="hint--lg">
              {t('Откройте любую страницу сайта и вернитесь сюда: кнопка «Проверить» в карточке покажет время последнего события. Проверить без сайта: откройте демо-страницу с телефона и нажмите кнопки на ней.')}
            </p>
          </InstallStep>
          <details className="settings-disclosure">
            <summary>{t('Дополнительно: поиск дат, звонки и согласие')}</summary>
            <ol className="list hint--lg list--gap">
              <li>
                {t('Счётчик шлёт только: адрес и заголовок страницы, реферер, ширину экрана, язык, часовой пояс и случайные ID посетителя и сессии. Без cookies, без IP, без имён и телефонов.')}
              </li>
              <li>
                {t('Форма поиска дат на сайте: при поиске вызовите')}{' '}
                <code>
                  pms(&apos;event&apos;, &apos;search&apos;, {'{'}arrival: &apos;2026-10-01&apos;,
                  departure: &apos;2026-10-03&apos;, adults: 2{'}'})
                </code>{' '}
                {t('— так заполняется календарь спроса. Клики по телефону и WhatsApp:')}{' '}
                <code>pms(&apos;event&apos;, &apos;phone_click&apos;)</code>,{' '}
                <code>pms(&apos;event&apos;, &apos;whatsapp_click&apos;)</code>.
              </li>
              <li>
                {t('Нужен баннер согласия — добавьте атрибут')} <code>data-consent=&quot;wait&quot;</code>{' '}
                {t('и вызовите')} <code>pms(&apos;consent&apos;)</code> {t('после согласия.')}
              </li>
            </ol>
          </details>
        </Stack>
      </Overlay>
    </>
  );
}

/**
 * Окно установки виджета бронирования (WEB3): код, куда поставить форму, цвет стилями сайта, проверка через демо.
 * Подписи, языка и промокода в модели нет — окно их не обещает (п. 10 ТЗ); цвет меняет сам сайт переменной
 * `--pmsw-accent`, стойка его не хранит.
 */
export function InstallWidgetButton({ code, demoUrl }: { code: string; demoUrl: string }) {
  const [open, setOpen] = useState(false);
  const demo = isOpenableUrl(demoUrl);
  const t = useT();
  return (
    <>
      <Button
        type="button"
        tone="secondary"
        onClick={() => setOpen(true)}
        data-testid="booking-install"
      >
        {t('Установка виджета')}
      </Button>
      <Overlay
        drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t('Установка виджета бронирования')}
      >
        <Stack data-testid="booking-install-drawer">
          <InstallStep title={t('Код для сайта')}>
            <p className="hint--lg">
              {t('Вставьте туда, где на странице должна быть форма бронирования, — обычно на страницу «Номера» или «Бронирование». Счётчик для этого не нужен, но с ним поиск и бронь попадут в аналитику.')}
            </p>
            <pre data-testid="site-card-booking-snippet" className="code">
              {code}
            </pre>
            <Row className="items-start">
              <CopyButton text={code} />
              {!demo && <Badge>{t('Демо виджета не подключено')}</Badge>}
            </Row>
          </InstallStep>
          <InstallStep title={t('Место и цвет')}>
            <ul className="list hint--lg list--gap">
              <li>
                {t('Форма встаёт в блок')} <code>&lt;div id=&quot;pms-booking&quot;&gt;</code>. {t('Другое место — атрибут')}{' '}
                <code>data-target=&quot;#{t('ваш-блок')}&quot;</code> {t('у тега script.')}
              </li>
              <li>
                {t('Цвет кнопок и рамки фокуса — в стилях сайта:')}{' '}
                <code>
                  .pmsw {'{'} --pmsw-accent: &lt;{t('цвет сайта')}&gt;; {'}'}
                </code>
                .
              </li>
              <li>
                {t('Язык формы: русский, казахский, английский или китайский, гость переключает сам. Язык при открытии задаёт атрибут')}{' '}
                <code>data-lang=&quot;kk&quot;</code> (<code>ru</code>, <code>kk</code>, <code>en</code>, <code>zh</code>).{' '}
                {t('Если гость оставит почту, ему придёт письмо с подтверждением на его языке.')}
              </li>
            </ul>
          </InstallStep>
          <InstallStep title={t('Проверка')}>
            <p className="hint--lg">
              {t('Откройте страницу сайта с формой, выберите даты и нажмите «Показать цены»: должны появиться свободные категории с ценой. Без сайта — кнопка «Открыть демо» на вкладке.')}
            </p>
            {/* Демо работает на живом API: бронь с него — обычная бронь PMS, а не примерка (§7.3) */}
            <p className="note" data-testid="booking-demo-warning">
              {t('Бронь с сайта и с демо-страницы настоящая: она попадёт в PMS, займёт место и откроет счёт. После проверки отмените её на карточке брони.')}
            </p>
          </InstallStep>
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

export function CopyButton({ text, label = msg('Скопировать код') }: { text: string; label?: string }) {
  const t = useT();
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
        {done ? t('Скопировано') : t(label)}
      </Button>
      {error && <Alert>{t('Не удалось скопировать. Выделите текст вручную.')}</Alert>}
    </div>
  );
}
