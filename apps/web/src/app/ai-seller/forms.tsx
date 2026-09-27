'use client';
import { useActionState, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Field,
  Input,
  Notice,
  Row,
  Stack,
  Textarea,
} from '../../components/ui';
import type { SellerWhatsAppView } from '../../lib/api';
import {
  dialogModeAction,
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
        rows={16}
        maxLength={max}
        required
        disabled={readOnly !== null}
        defaultValue={state?.text || initial}
        data-testid="seller-prompt-text"
      />
      {readOnly ? (
        <Notice tone="muted" data-testid="seller-read-only">
          {readOnly}
        </Notice>
      ) : (
        <Row>
          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            data-testid="seller-prompt-save"
          >
            {pending ? 'Отправляю…' : 'Сохранить и применить'}
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
  return (
    <form key={state?.attempt ?? 0} action={action} className="stack stack--sm form-narrow">
      <Field label="Документ: md, txt, pdf, docx или xlsx, до 10 МБ">
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
          {pending ? 'Загружаю…' : 'Загрузить'}
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
            {pending ? 'Возвращаю…' : 'Вернуть боту'}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => run('takeover')}
            disabled={pending}
            aria-busy={pending}
            data-testid="dialog-takeover"
          >
            {pending ? 'Перехватываю…' : 'Перехватить'}
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
  label = 'Ответ гостю',
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
  return (
    <form key={state?.attempt ?? 0} action={action} className="stack stack--sm">
      <Field label={label}>
        <Textarea name="text" rows={3} maxLength={4000} required data-testid="dialog-reply-text" />
      </Field>
      <Row>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="dialog-reply">
          {pending ? 'Отправляю…' : 'Ответить'}
        </Button>
      </Row>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.message && <Notice data-testid="dialog-reply-result">{state.message}</Notice>}
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
  asker: 'Гость',
  bot: 'Продавец',
  field: 'Сообщение как от гостя',
  placeholder: 'Здравствуйте, есть места на выходные?',
  button: 'Спросить продавца',
  pending: 'Жду ответ продавца…',
  human: 'Продавец позвал бы человека',
  label: 'Проверка продавца',
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
  return (
    <Stack>
      {history.length > 0 && (
        <ol className="seller-transcript" data-testid="sandbox-history" aria-label={words.label}>
          {history.map((h, i) => (
            <li key={i}>
              <p className="seller-transcript__guest">
                <b>{words.asker}:</b> {h.question}
              </p>
              <p className="seller-transcript__bot">
                <b>{words.bot}:</b> {h.reply ?? 'ответа нет'}
              </p>
              {h.needsHuman && (
                <p className="settings-note">
                  {words.human}
                  {h.reasons.length ? `: ${h.reasons.join('; ')}` : ''}.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      <form key={state?.attempt ?? 0} action={action} className="stack stack--sm">
        <Field label={words.field}>
          <Textarea
            name="text"
            rows={2}
            maxLength={2000}
            required
            placeholder={words.placeholder}
            data-testid="sandbox-text"
          />
        </Field>
        <Row>
          <Button type="submit" disabled={pending} aria-busy={pending} data-testid="sandbox-send">
            {pending ? words.pending : words.button}
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
  save = llmKeySaveAction,
  check = llmKeyCheckAction,
}: {
  status: { set: boolean; last4: string | null };
  readOnly: string | null;
  save?: (prev: LlmKeyResult | null, form: FormData) => Promise<LlmKeyResult>;
  check?: (prev: LlmKeyResult | null, form: FormData) => Promise<LlmKeyResult>;
}) {
  const [saved, saveAction, saving] = useActionState<LlmKeyResult | null, FormData>(save, null);
  const [checked, checkAction, checking] = useActionState<LlmKeyResult | null, FormData>(check, null);
  // снятие — своя форма со скрытым полем: name на кнопке с formAction-функцией React затирает
  const [cleared, clearAction, clearing] = useActionState<LlmKeyResult | null, FormData>(save, null);
  const busy = saving || checking || clearing;
  // состояние — серверное: удачное действие зовёт refresh(), и props приходят свежими
  return (
    <Stack>
      <p data-testid="seller-llm-key-state">
        {status.set ? (
          <>
            Ключ установлен, оканчивается на <b>····{status.last4}</b>. Расход модели — на ключе
            партнёра.
          </>
        ) : (
          <>Ключ не задан: продавец ходит ключом платформы.</>
        )}
      </p>
      <form key={saved?.attempt ?? 0} className="stack stack--sm">
        <Field label="API-ключ модели">
          <Input
            name="key"
            type="password"
            maxLength={200}
            autoComplete="off"
            placeholder="sk-…"
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
            {checking ? 'Проверяем…' : 'Проверить'}
          </Button>
          <Button
            type="submit"
            formAction={saveAction}
            disabled={busy || readOnly !== null}
            aria-busy={saving}
            data-testid="seller-llm-key-save"
          >
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </Row>
        {readOnly !== null && <p className="settings-note">{readOnly}</p>}
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
              Снять ключ
            </Button>
          </Row>
        </form>
      )}
      {cleared?.message && (
        <Notice data-testid="seller-llm-key-cleared">{cleared.message}</Notice>
      )}
      {cleared?.error && <Alert data-testid="seller-llm-key-error">{cleared.error}</Alert>}
      <p className="settings-note">
        Ключ хранит только продавец — шифрованным; здесь видны лишь последние 4 знака. Ключ
        недействителен или кончились средства — продавец гостиницы молчит и раздел предупредит,
        ключ платформы вместо партнёрского не подставляется.
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
  return (
    <Stack>
      <p data-testid="seller-whatsapp-state">
        {status.set ? (
          <>
            Подключён номер <b>{status.phoneNumberId}</b>: бот отвечает написавшим в WhatsApp.
          </>
        ) : (
          <>WhatsApp не подключён. Понадобятся номер, аккаунт Meta Business с проверкой и постоянный токен —
          их заводит партнёр.</>
        )}
      </p>
      {status.set && status.webhookUrl && (
        <div data-testid="seller-whatsapp-meta" className="stack stack--sm">
          <p className="settings-note">В консоли Meta (WhatsApp → Configuration → Webhook) впишите:</p>
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
            placeholder="из консоли Meta, только цифры"
            data-testid="seller-whatsapp-phone-id"
            disabled={readOnly !== null}
          />
        </Field>
        <Field label="Постоянный токен">
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
        <Field label="Секрет приложения (App secret)">
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
            {checking ? 'Проверяем…' : 'Проверить'}
          </Button>
          <Button
            type="submit"
            formAction={saveAction}
            disabled={busy || readOnly !== null}
            aria-busy={saving}
            data-testid="seller-whatsapp-save"
          >
            {saving ? 'Подключаем…' : 'Подключить'}
          </Button>
        </Row>
        {readOnly !== null && <p className="settings-note">{readOnly}</p>}
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
              Отключить
            </Button>
          </Row>
        </form>
      )}
      {off?.message && <Notice data-testid="seller-whatsapp-off">{off.message}</Notice>}
      {off?.error && <Alert data-testid="seller-whatsapp-error">{off.error}</Alert>}
      <p className="settings-note">
        Токен и секрет приложения хранит только продавец — шифрованными, назад они не показываются.
        Бот отвечает написавшим в течение суток после их сообщения (окно Cloud API), первым не пишет.
        Переписка гостей — персональные данные: канал на сайты партнёров включается при базе бота
        в Казахстане (ADR-009).
      </p>
    </Stack>
  );
}
