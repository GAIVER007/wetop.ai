'use client';
import { useActionState, useState, useTransition } from 'react';
import {
  Alert,
  Badge,
  type BadgeTone,
  Button,
  Field,
  Input,
  Notice,
  Row,
  Stack,
  Textarea,
} from '../../components/ui';
import type { SellerKeyState, SellerLlmKeyStatus, SellerWhatsAppView } from '../../lib/api';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/** Состояние ключа модели словом и тоном; null: ещё не проверялся и ходов не было */
const KEY_STATE: Record<SellerKeyState, { label: string; tone: BadgeTone }> = {
  ok: { label: msg('Работает'), tone: 'ok' },
  no_credits: { label: msg('Закончились деньги'), tone: 'danger' },
  invalid_key: { label: msg('Ключ не принят'), tone: 'danger' },
  rate_limited: { label: msg('Предел запросов'), tone: 'warn' },
  error: { label: msg('Провайдер отказал'), tone: 'warn' },
};
import {
  restoreVersionAction,
  assigneeAction,
  dialogModeAction,
  nextStepAction,
  noteAction,
  llmKeyCheckAction,
  llmKeySaveAction,
  whatsappCheckAction,
  whatsappSaveAction,
  replyAction,
  sandboxAction,
  savePromptAction,
  uploadKnowledgeAction,
  type SandboxResult,
  type LlmKeyResult,
  type PromptResult,
  type SimpleResult,
  type WhatsAppResult,
} from './actions';

/**
 * Инструкция продавцу одним окном (макет владельца 26.09.2026, ADR-097): кто он, тон, языки, правила и частые
 * вопросы — своими словами. «Сохранить и применить» записывает текст и сразу отправляет продавцу. `readOnly` — почему
 * менять нельзя (сотрудник или срок расширения вышел, ADR-083): текст виден, кнопки нет.
 */
export function SellerPromptForm({
  initial,
  max,
  readOnly,
  note,
}: {
  initial: string;
  max: number;
  readOnly: string | null;
  /** Состояние рядом с кнопкой: применено или только сохранено */
  note: string | null;
}) {
  const [state, action, pending] = useActionState<PromptResult | null, FormData>(
    savePromptAction,
    null,
  );
  const t = useT();
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="stack"
      data-testid="seller-prompt-form"
    >
      <Textarea
        name="text"
        aria-labelledby="seller-prompt-title"
        rows={10}
        maxLength={max}
        required
        disabled={readOnly !== null}
        defaultValue={state?.text || initial}
        data-testid="seller-prompt-text"
      />
      {readOnly ? (
        <Notice tone="muted" data-testid="seller-read-only">
          {t(readOnly)}
        </Notice>
      ) : (
        <Row>
          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            data-testid="seller-prompt-save"
          >
            {pending ? t('Отправляю…') : t('Сохранить и применить')}
          </Button>
          {note && (
            <span className="sub" data-testid="seller-prompt-state">
              {note}
            </span>
          )}
        </Row>
      )}
      {state?.error && <Alert data-testid="seller-prompt-error">{state.error}</Alert>}
      {state?.warning && (
        <Alert tone="warning" data-testid="seller-prompt-warning">
          {state.warning}
        </Alert>
      )}
      {state?.message && <Notice data-testid="seller-prompt-result">{state.message}</Notice>}
    </form>
  );
}

/** «Знания»: загрузка документа в базу знаний продавца */
type SimpleAction = (prev: SimpleResult | null, form: FormData) => Promise<SimpleResult>;

/**
 * Формы диалога и знаний — общие для обоих ботов: «ИИ-продавец» и «Платформа → Техподдержка» (ADR-083, Э3).
 * Действие передаётся параметром; без него — действие раздела продавца.
 */
export function KnowledgeUploadForm({ upload = uploadKnowledgeAction }: { upload?: SimpleAction }) {
  const [state, action, pending] = useActionState<SimpleResult | null, FormData>(upload, null);
  const t = useT();
  return (
    <form key={state?.attempt ?? 0} action={action} className="stack stack--sm form-narrow">
      <Field label={t('Документ: md, txt, pdf, docx или xlsx, до 10 МБ')}>
        <Input
          type="file"
          name="file"
          accept=".md,.txt,.pdf,.docx,.xlsx"
          required
          data-testid="knowledge-file"
        />
      </Field>
      <Row>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="knowledge-upload">
          {pending ? t('Загружаю…') : t('Загрузить')}
        </Button>
      </Row>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.message && <Notice data-testid="knowledge-result">{state.message}</Notice>}
    </form>
  );
}

/** «Перехватить» и «Вернуть боту» в карточке диалога */
export function DialogModeButtons({
  id,
  mode,
  switchMode = dialogModeAction,
}: {
  id: string;
  mode: string;
  switchMode?: (id: string, action: 'takeover' | 'release') => Promise<SimpleResult>;
}) {
  const [result, setResult] = useState<SimpleResult | null>(null);
  const [pending, start] = useTransition();
  const t = useT();
  const run = (action: 'takeover' | 'release') =>
    start(async () => setResult(await switchMode(id, action)));
  return (
    <Stack gap="sm">
      <Row>
        {mode === 'owner_takeover' ? (
          <Button
            type="button"
            tone="secondary"
            onClick={() => run('release')}
            disabled={pending}
            aria-busy={pending}
            data-testid="dialog-release"
          >
            {pending ? t('Возвращаю…') : t('Вернуть боту')}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => run('takeover')}
            disabled={pending}
            aria-busy={pending}
            data-testid="dialog-takeover"
          >
            {pending ? t('Перехватываю…') : t('Перехватить')}
          </Button>
        )}
      </Row>
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.message && <Notice data-testid="dialog-mode-result">{result.message}</Notice>}
    </Stack>
  );
}

/** Ответ гостю от человека — тем же путём, что ответ бота */
export function DialogReplyForm({
  id,
  reply = replyAction,
  label = msg('Ответ гостю'),
}: {
  id: string;
  reply?: (id: string, prev: SimpleResult | null, form: FormData) => Promise<SimpleResult>;
  /** Кому отвечают: гостю — в разделе продавца, пользователю платформы — в «Техподдержке» */
  label?: string;
}) {
  const [state, action, pending] = useActionState<SimpleResult | null, FormData>(
    reply.bind(null, id),
    null,
  );
  const t = useT();
  return (
    <form key={state?.attempt ?? 0} action={action} className="stack stack--sm">
      <Field label={t(label)}>
        <Textarea name="text" rows={3} maxLength={4000} required data-testid="dialog-reply-text" />
      </Field>
      <Row>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="dialog-reply">
          {pending ? t('Отправляю…') : t('Ответить')}
        </Button>
      </Row>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.message && <Notice data-testid="dialog-reply-result">{state.message}</Notice>}
    </form>
  );
}

/** Вернуть версию инструкции (SALES2.7): одна кнопка в строке истории, результат словами рядом */
export function RestoreVersionButton({ id, label }: { id: string; label: string }) {
  const t = useT();
  const [result, setResult] = useState<SimpleResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <span>
      <Button
        type="button"
        tone="secondary"
        size="sm"
        disabled={pending}
        aria-busy={pending}
        aria-label={t('Вернуть версию: {label}', { label })}
        data-testid={`prompt-restore-${id}`}
        onClick={() => start(async () => setResult(await restoreVersionAction(id)))}
      >
        {pending ? t('Возвращаю…') : t('Вернуть')}
      </Button>
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.message && <Notice data-testid="prompt-restore-result">{result.message}</Notice>}
    </span>
  );
}

/** Ответственный и следующий шаг (S2.6). Без права действовать — только чтение, формы нет */
export function DialogHandling({
  id,
  assignee,
  nextStep,
  canAct,
}: {
  id: string;
  assignee: string | null;
  nextStep: string | null;
  canAct: boolean;
}) {
  const [result, setResult] = useState<SimpleResult | null>(null);
  const [pending, start] = useTransition();
  const [state, action, saving] = useActionState<SimpleResult | null, FormData>(nextStepAction.bind(null, id), null);
  const run = (who: 'me' | null) => start(async () => setResult(await assigneeAction(id, who)));
  const t = useT();
  return (
    <Stack gap="sm" data-testid="dialog-handling">
      <p data-testid="dialog-assignee">
        <b>{t('Ответственный:')}</b> {assignee ?? t('не назначен')}
      </p>
      {canAct ? (
        <>
          <Row>
            <Button type="button" tone="secondary" size="sm" onClick={() => run('me')} disabled={pending} data-testid="dialog-assign-me">
              {t('Взять себе')}
            </Button>
            {assignee && (
              <Button type="button" tone="ghost" size="sm" onClick={() => run(null)} disabled={pending} data-testid="dialog-unassign">
                {t('Снять')}
              </Button>
            )}
          </Row>
          <form key={state?.attempt ?? 0} action={action} className="stack stack--sm">
            <Field label={t('Следующий шаг')}>
              <Input name="nextStep" maxLength={200} defaultValue={nextStep ?? ''} placeholder={t('Например, перезвонить до 18:00')} data-testid="dialog-next-step" />
            </Field>
            <Row>
              <Button type="submit" tone="secondary" size="sm" disabled={saving} aria-busy={saving} data-testid="dialog-next-step-save">
                {t('Сохранить шаг')}
              </Button>
            </Row>
            {state?.error && <Alert>{state.error}</Alert>}
          </form>
          {result?.error && <Alert>{result.error}</Alert>}
        </>
      ) : (
        <p data-testid="dialog-next-step-read">
          <b>{t('Следующий шаг:')}</b> {nextStep ?? t('не задан')}
        </p>
      )}
    </Stack>
  );
}

/** Добавить внутреннюю заметку (S2.6) */
export function DialogNoteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<SimpleResult | null, FormData>(noteAction.bind(null, id), null);
  const t = useT();
  return (
    <form key={state?.attempt ?? 0} action={action} className="stack stack--sm">
      <Field label={t('Новая заметка')}>
        <Textarea name="text" rows={3} maxLength={2000} required data-testid="dialog-note-text" />
      </Field>
      <Row>
        <Button type="submit" tone="secondary" size="sm" disabled={pending} aria-busy={pending} data-testid="dialog-note-add">
          {pending ? t('Добавляю…') : t('Добавить заметку')}
        </Button>
      </Row>
      {state?.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

/** «Проверка»: поговорить с продавцом до публикации. Разговор — в песочнице, в диалоги сайта он не попадает */
/** Слова «Проверки»: у продавца спрашивает «гость», у помощника — пользователь стойки */
export interface SandboxWords {
  asker: string;
  bot: string;
  field: string;
  placeholder: string;
  button: string;
  pending: string;
  human: string;
  label: string;
}

const SELLER_SANDBOX_WORDS: SandboxWords = {
  asker: msg('Гость'),
  bot: msg('Продавец'),
  field: msg('Сообщение как от гостя'),
  placeholder: msg('Здравствуйте, есть места на выходные?'),
  button: msg('Спросить продавца'),
  pending: msg('Жду ответ продавца…'),
  human: msg('Продавец позвал бы человека'),
  label: msg('Проверка продавца'),
};

export function SandboxForm({
  ask = sandboxAction,
  words = SELLER_SANDBOX_WORDS,
}: {
  ask?: (prev: SandboxResult | null, form: FormData) => Promise<SandboxResult>;
  words?: SandboxWords;
}) {
  const [state, action, pending] = useActionState<SandboxResult | null, FormData>(ask, null);
  const history = state?.history ?? [];
  const t = useT();
  return (
    <Stack>
      {history.length > 0 && (
        <ol className="seller-transcript" data-testid="sandbox-history" aria-label={t(words.label)}>
          {history.map((h, i) => (
            <li key={i}>
              <p className="seller-transcript__guest">
                <b>{t(words.asker)}:</b> {h.question}
              </p>
              <p className="seller-transcript__bot">
                <b>{t(words.bot)}:</b> {h.reply ?? t('ответа нет')}
              </p>
              {h.needsHuman && (
                <p className="settings-note">
                  {t(words.human)}
                  {h.reasons.length ? `: ${h.reasons.join('; ')}` : ''}.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      <form key={state?.attempt ?? 0} action={action} className="stack stack--sm">
        <Field label={t(words.field)}>
          <Textarea
            name="text"
            rows={2}
            maxLength={2000}
            required
            placeholder={t(words.placeholder)}
            data-testid="sandbox-text"
          />
        </Field>
        <Row>
          <Button type="submit" disabled={pending} aria-busy={pending} data-testid="sandbox-send">
            {pending ? t(words.pending) : t(words.button)}
          </Button>
        </Row>
        {state?.error && <Alert data-testid="sandbox-error">{state.error}</Alert>}
      </form>
    </Stack>
  );
}

/**
 * Окно «Модель» (С2, Q-186): API-ключ модели самого партнёра — расход на нём. Ключ хранит только бот,
 * шифрованным; здесь он вводится, проверяется живым вызовом и сохраняется, обратно не читается —
 * видны лишь последние 4 знака. Ключ снят — продавцу этой гостиницы нечем отвечать, если у платформы своего ключа нет.
 */
export function LlmKeyForm({
  status,
  readOnly,
  checkedLabel = null,
  save = llmKeySaveAction,
  check = llmKeyCheckAction,
}: {
  status: SellerLlmKeyStatus;
  readOnly: string | null;
  /** Время последней проверки по поясу объекта: считает сервер, строка одна на сервере и в браузере */
  checkedLabel?: string | null;
  save?: (prev: LlmKeyResult | null, form: FormData) => Promise<LlmKeyResult>;
  check?: (prev: LlmKeyResult | null, form: FormData) => Promise<LlmKeyResult>;
}) {
  const [saved, saveAction, saving] = useActionState<LlmKeyResult | null, FormData>(save, null);
  const [checked, checkAction, checking] = useActionState<LlmKeyResult | null, FormData>(check, null);
  // снятие — своя форма со скрытым полем: name на кнопке с formAction-функцией React затирает
  const [cleared, clearAction, clearing] = useActionState<LlmKeyResult | null, FormData>(save, null);
  const busy = saving || checking || clearing;
  const t = useT();
  // состояние — серверное: удачное действие зовёт refresh(), и props приходят свежими
  return (
    <Stack>
      <p data-testid="seller-llm-key-state">
        {status.set ? (
          <>
            {t('Ключ установлен, оканчивается на')} <b>····{status.last4}</b>. {t('Расход модели — на ключе партнёра.')}
          </>
        ) : (
          <>{t('Ключ не задан: продавец ходит ключом платформы.')}</>
        )}
      </p>
      <div data-testid="seller-llm-key-health" className="stack stack--sm">
        <Row>
          <span>{t('Состояние:')}</span>
          {status.state ? (
            <Badge tone={KEY_STATE[status.state].tone}>{t(KEY_STATE[status.state].label)}</Badge>
          ) : (
            <Badge>{t('Ещё не проверялся')}</Badge>
          )}
          {checkedLabel && <span className="settings-note">{t('проверено {when}', { when: checkedLabel })}</span>}
        </Row>
        {status.reason && status.state !== 'ok' && (
          <Alert data-testid="seller-llm-key-health-reason">{status.reason}</Alert>
        )}
      </div>
      <p className="settings-note">
        {t('Остаток денег на счёте провайдер по API не сообщает: здесь видно, отвечает ли модель с этим ключом. Пустое поле и «Проверить» проверяют сохранённый ключ, введённый ключ проверяется без сохранения. Сохранённый секрет не показывается повторно.')}
      </p>
      <form key={saved?.attempt ?? 0} className="stack stack--sm">
        <Field label={t('API-ключ модели')}>
          <Input
            name="key"
            type="password"
            maxLength={200}
            autoComplete="off"
            placeholder={status.set ? t('Ключ сохранён, введите новый только для замены') : t('Вставьте ключ модели')}
            data-testid="seller-llm-key-input"
            disabled={readOnly !== null}
          />
        </Field>
        <Row>
          <Button
            type="submit"
            formAction={checkAction}
            tone="secondary"
            disabled={busy || readOnly !== null}
            aria-busy={checking}
            data-testid="seller-llm-key-check"
          >
            {checking ? t('Проверяем…') : t('Проверить')}
          </Button>
          <Button
            type="submit"
            formAction={saveAction}
            disabled={busy || readOnly !== null}
            aria-busy={saving}
            data-testid="seller-llm-key-save"
          >
            {saving ? t('Сохраняем…') : t('Сохранить')}
          </Button>
        </Row>
        {readOnly !== null && <p className="settings-note">{t(readOnly)}</p>}
        {(saved?.message || checked?.message) && (
          <Notice data-testid="seller-llm-key-message">{saved?.message ?? checked?.message}</Notice>
        )}
        {(saved?.error || checked?.error) && (
          <Alert data-testid="seller-llm-key-error">{saved?.error ?? checked?.error}</Alert>
        )}
      </form>
      {status.set && (
        <form action={clearAction} className="stack stack--sm">
          <input type="hidden" name="clear" value="1" />
          <Row>
            <Button
              type="submit"
              tone="danger"
              disabled={busy || readOnly !== null}
              aria-busy={clearing}
              data-testid="seller-llm-key-clear"
            >
              {t('Снять ключ')}
            </Button>
          </Row>
        </form>
      )}
      {cleared?.message && (
        <Notice data-testid="seller-llm-key-cleared">{cleared.message}</Notice>
      )}
      {cleared?.error && <Alert data-testid="seller-llm-key-error">{cleared.error}</Alert>}
      <p className="settings-note">
        {t('Ключ хранит только продавец — шифрованным; здесь видны лишь последние 4 знака. Ключ недействителен или кончились средства — продавец гостиницы молчит и раздел предупредит, ключ платформы вместо партнёрского не подставляется.')}
      </p>
    </Stack>
  );
}

/**
 * Окно «WhatsApp» (С3, Q-185 (а)): номер и приложение Meta заводит партнёр, бот хранит токен
 * и секрет шифрованными и назад не отдаёт. После подключения экран показывает адрес вебхука
 * и проверочное слово — их партнёр вписывает в консоль Meta. Бот только отвечает написавшим.
 */
export function WhatsAppForm({
  status,
  readOnly,
  save = whatsappSaveAction,
  check = whatsappCheckAction,
}: {
  status: SellerWhatsAppView;
  readOnly: string | null;
  save?: (prev: WhatsAppResult | null, form: FormData) => Promise<WhatsAppResult>;
  check?: (prev: WhatsAppResult | null, form: FormData) => Promise<WhatsAppResult>;
}) {
  const [saved, saveAction, saving] = useActionState<WhatsAppResult | null, FormData>(save, null);
  const [checked, checkAction, checking] = useActionState<WhatsAppResult | null, FormData>(check, null);
  const [off, offAction, offing] = useActionState<WhatsAppResult | null, FormData>(save, null);
  const busy = saving || checking || offing;
  const t = useT();
  return (
    <Stack>
      <p data-testid="seller-whatsapp-state">
        {status.set ? (
          <>
            {t('Подключён номер')} <b>{status.phoneNumberId}</b>: {t('бот отвечает написавшим в WhatsApp.')}
          </>
        ) : (
          <>{t('WhatsApp не подключён. Понадобятся номер, аккаунт Meta Business с проверкой и постоянный токен — их заводит партнёр.')}</>
        )}
      </p>
      {status.set && status.webhookUrl && (
        <div data-testid="seller-whatsapp-meta" className="stack stack--sm">
          <p className="settings-note">{t('В консоли Meta (WhatsApp → Configuration → Webhook) впишите:')}</p>
          <ul className="settings-note">
            <li>
              Callback URL: <code>{status.webhookUrl}</code>
            </li>
            <li>
              Verify token: <code>{status.verifyToken}</code>
            </li>
          </ul>
        </div>
      )}
      <form key={saved?.attempt ?? 0} className="stack stack--sm">
        <Field label="phone_number_id">
          <Input
            name="phoneNumberId"
            inputMode="numeric"
            maxLength={64}
            placeholder={t('из консоли Meta, только цифры')}
            data-testid="seller-whatsapp-phone-id"
            disabled={readOnly !== null}
          />
        </Field>
        <Field label={t('Постоянный токен')}>
          <Input
            name="token"
            type="password"
            maxLength={512}
            autoComplete="off"
            placeholder="EAAG…"
            data-testid="seller-whatsapp-token"
            disabled={readOnly !== null}
          />
        </Field>
        <Field label={t('Секрет приложения (App secret)')}>
          <Input
            name="appSecret"
            type="password"
            maxLength={200}
            autoComplete="off"
            data-testid="seller-whatsapp-secret"
            disabled={readOnly !== null}
          />
        </Field>
        <Row>
          <Button
            type="submit"
            formAction={checkAction}
            tone="secondary"
            disabled={busy || readOnly !== null}
            aria-busy={checking}
            data-testid="seller-whatsapp-check"
          >
            {checking ? t('Проверяем…') : t('Проверить')}
          </Button>
          <Button
            type="submit"
            formAction={saveAction}
            disabled={busy || readOnly !== null}
            aria-busy={saving}
            data-testid="seller-whatsapp-save"
          >
            {saving ? t('Подключаем…') : t('Подключить')}
          </Button>
        </Row>
        {readOnly !== null && <p className="settings-note">{t(readOnly)}</p>}
        {(saved?.message || checked?.message) && (
          <Notice data-testid="seller-whatsapp-message">{saved?.message ?? checked?.message}</Notice>
        )}
        {(saved?.error || checked?.error) && (
          <Alert data-testid="seller-whatsapp-error">{saved?.error ?? checked?.error}</Alert>
        )}
      </form>
      {status.set && (
        <form action={offAction} className="stack stack--sm">
          <input type="hidden" name="disconnect" value="1" />
          <Row>
            <Button
              type="submit"
              tone="danger"
              disabled={busy || readOnly !== null}
              aria-busy={offing}
              data-testid="seller-whatsapp-disconnect"
            >
              {t('Отключить')}
            </Button>
          </Row>
        </form>
      )}
      {off?.message && <Notice data-testid="seller-whatsapp-off">{off.message}</Notice>}
      {off?.error && <Alert data-testid="seller-whatsapp-error">{off.error}</Alert>}
      <p className="settings-note">
        {t('Токен и секрет приложения хранит только продавец — шифрованными, назад они не показываются. Бот отвечает написавшим в течение суток после их сообщения (окно Cloud API), первым не пишет. Переписка гостей — персональные данные: канал на сайты партнёров включается при базе бота в Казахстане (ADR-009).')}
      </p>
    </Stack>
  );
}
