'use client';
import Link from 'next/link';
import { useActionState, useState, useTransition, type ReactNode } from 'react';
import {
  Alert,
  Button,
  Field,
  Grid,
  Input,
  Notice,
  Row,
  Stack,
  Textarea,
} from '../../components/ui';
import {
  FAQ_MAX,
  LIST_MAX,
  SELLER_FAQ_SUGGESTIONS,
  SELLER_SETUP_STEPS,
  type SellerProfileStep,
} from '../../lib/ai-seller';
import type { SellerProfileBody } from '../../lib/api';
import {
  applySellerAction,
  dialogModeAction,
  replyAction,
  sandboxAction,
  saveSellerStepAction,
  uploadKnowledgeAction,
  type SandboxResult,
  type SellerFormResult,
  type SimpleResult,
} from './actions';

export interface Choice {
  value: string;
  label: string;
}

/** Варианты «Манеры»: подпись — словами домена, пример — как это звучит у продавца */
export interface MannerChoice {
  value: string;
  label: string;
  example: string;
}

/**
 * Шаг настройки продавца (`plans/ai-seller-setup-wizard-2026-09-25.md`): поля шага и внизу «Назад» и «Сохранить и
 * дальше» — обе кнопки сохраняют. Варианты и пределы — модели бота `SellerProfile` (ADR-081): чего бот не примет,
 * форма не предлагает. Над полями — `children`: то, что шаг показывает только для чтения (цены по тарифу сайта).
 *
 * `readOnly` — почему менять нельзя (сотрудник или срок расширения вышел, ADR-083): поля видны, но выключены, а внизу
 * вместо «Сохранить и дальше» — переход по шагам.
 */
export function SellerStepForm({
  stepKey,
  initial,
  first,
  languages,
  addressForms,
  emojis,
  replyLengths,
  children,
  readOnly = null,
}: {
  stepKey: SellerProfileStep;
  initial: SellerProfileBody;
  first: boolean;
  languages: Array<{ value: string; label: string }>;
  addressForms: MannerChoice[];
  emojis: MannerChoice[];
  replyLengths: MannerChoice[];
  children?: ReactNode;
  readOnly?: string | null;
}) {
  const [state, action, pending] = useActionState<SellerFormResult | null, FormData>(
    saveSellerStepAction.bind(null, stepKey),
    null,
  );
  const values = state?.values ?? initial;
  const fields = (
    <>
      {stepKey === 'intro' && <IntroFields values={values} languages={languages} />}
      {stepKey === 'manner' && (
        <Stack>
          <MannerGroup
            legend="Обращение к гостю"
            name="addressForm"
            value={values.addressForm}
            choices={addressForms}
          />
          <MannerGroup legend="Эмодзи" name="emoji" value={values.emoji} choices={emojis} />
          <MannerGroup
            legend="Длина ответов"
            name="replyLength"
            value={values.replyLength}
            choices={replyLengths}
          />
        </Stack>
      )}
      {stepKey === 'prices' && <PricesFields values={values} />}
      {stepKey === 'rules' && <RulesFields values={values} />}
      {stepKey === 'faq' && <FaqRows initial={values.faq} />}
    </>
  );
  if (readOnly) {
    const step = SELLER_SETUP_STEPS.findIndex((s) => s.key === stepKey) + 1;
    return (
      <div className="stack" data-testid={`seller-step-${stepKey}`}>
        {children}
        <Notice tone="muted" data-testid="seller-read-only">
          {readOnly}
        </Notice>
        <fieldset disabled className="seller-readonly">
          {fields}
        </fieldset>
        <div className="form-footer">
          {first ? (
            <span />
          ) : (
            <Link className="btn btn--secondary" href={`/ai-seller?step=${step - 1}`}>
              Назад
            </Link>
          )}
          <Link className="btn" href={`/ai-seller?step=${step + 1}`} data-testid="seller-step-next">
            Дальше
          </Link>
        </div>
      </div>
    );
  }
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="stack"
      data-testid={`seller-step-${stepKey}`}
    >
      {children}
      {fields}
      {state?.error && <Alert data-testid="seller-step-error">{state.error}</Alert>}
      <div className="form-footer">
        {first ? (
          <span />
        ) : (
          <Button
            type="submit"
            name="go"
            value="back"
            tone="secondary"
            disabled={pending}
            data-testid="seller-step-back"
          >
            Назад
          </Button>
        )}
        <Button
          type="submit"
          name="go"
          value="next"
          disabled={pending}
          aria-busy={pending}
          data-testid="seller-step-next"
        >
          {pending ? 'Сохраняю…' : 'Сохранить и дальше'}
        </Button>
      </div>
    </form>
  );
}

function IntroFields({
  values,
  languages,
}: {
  values: SellerProfileBody;
  languages: Array<{ value: string; label: string }>;
}) {
  return (
    <Stack>
      <Field label="Имя бота">
        <Input
          name="botName"
          defaultValue={values.botName ?? ''}
          maxLength={40}
          placeholder="Например, Айгерим"
        />
      </Field>
      <p className="settings-note">Пусто — продавец говорит от лица гостиницы, без имени.</p>
      <Field label="Приветствие">
        <Textarea
          name="greeting"
          rows={3}
          maxLength={300}
          defaultValue={values.greeting}
          placeholder="Здравствуйте! Помогу выбрать номер и расскажу о ценах. На какие даты смотрите?"
        />
      </Field>
      <p className="settings-note">Первое сообщение гостю в чате. До 300 знаков.</p>
      <fieldset className="seller-choices">
        <legend className="seller-choices__legend">
          Языки — первый отмеченный продавец считает основным
        </legend>
        <div className="seller-choices__list">
          {languages.map((l) => (
            <label key={l.value} className="check">
              <input
                type="checkbox"
                name="languages"
                value={l.value}
                defaultChecked={values.languages.includes(l.value)}
              />{' '}
              {l.label}
            </label>
          ))}
        </div>
      </fieldset>
    </Stack>
  );
}

/** Группа вариантов «Манеры»: подпись и пример фразы — чтобы выбирать по звучанию, а не по слову */
function MannerGroup({
  legend,
  name,
  value,
  choices,
}: {
  legend: string;
  name: string;
  value: string;
  choices: MannerChoice[];
}) {
  return (
    <fieldset className="seller-choices">
      <legend className="seller-choices__legend">{legend}</legend>
      <div className="seller-manner">
        {choices.map((c) => (
          <label key={c.value} className="seller-manner__option">
            <span className="check">
              <input type="radio" name={name} value={c.value} defaultChecked={c.value === value} />{' '}
              {c.label}
            </span>
            <span className="sub">{c.example}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function PricesFields({ values }: { values: SellerProfileBody }) {
  return (
    <Grid min={280}>
      <Field label="Что входит в цену">
        <Textarea
          name="includedInPrice"
          rows={4}
          maxLength={1000}
          defaultValue={values.includedInPrice}
          placeholder="Постельное бельё, полотенца, Wi-Fi, общая кухня"
        />
      </Field>
      <Field label="Что за доплату">
        <Textarea
          name="extraCharges"
          rows={4}
          maxLength={1000}
          defaultValue={values.extraCharges}
          placeholder="Трансфер из аэропорта, поздний выезд, стирка"
        />
      </Field>
    </Grid>
  );
}

function RulesFields({ values }: { values: SellerProfileBody }) {
  return (
    <Stack>
      <Field label="Правила проживания">
        <Textarea
          name="houseRules"
          rows={4}
          maxLength={2000}
          defaultValue={values.houseRules}
          placeholder="Тишина с 23:00. Обувь снимаем у входа."
        />
      </Field>
      <Grid min={280}>
        <Field label="Запреты — по одному в строке">
          <Textarea
            name="prohibitions"
            rows={4}
            defaultValue={values.prohibitions.join('\n')}
            placeholder={'Не курить в номерах\nБез животных'}
          />
        </Field>
        <Field label="Когда звать человека — по одному в строке">
          <Textarea
            name="callHumanWhen"
            rows={4}
            defaultValue={values.callHumanWhen.join('\n')}
            placeholder={'Группа от 6 человек\nОплата по счёту'}
          />
        </Field>
      </Grid>
      <p className="settings-note">
        В списках — до {LIST_MAX} строк, строка до 300 знаков. Жалобы, возврат денег, изменение и
        отмену брони продавец передаёт человеку и без этого списка.
      </p>
    </Stack>
  );
}

/**
 * Частые вопросы с ответами: строки добавляются и убираются; пустая строка при отправке отбрасывается. Подсказки —
 * вопросы, которые гости задают чаще всего: щелчок добавляет строку с вопросом, ответ пишет владелец.
 */
function FaqRows({ initial }: { initial: Array<{ question: string; answer: string }> }) {
  const [rows, setRows] = useState(initial.length > 0 ? initial : []);
  const update = (i: number, key: 'question' | 'answer', value: string) =>
    setRows((all) => all.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const add = (question: string) => setRows((all) => [...all, { question, answer: '' }]);
  const asked = new Set(rows.map((r) => r.question.trim()));
  const suggestions = SELLER_FAQ_SUGGESTIONS.filter((q) => !asked.has(q));
  const full = rows.length >= FAQ_MAX;
  return (
    <Stack data-testid="seller-faq">
      <input type="hidden" name="faqCount" value={rows.length} />
      {rows.length === 0 && (
        <p className="settings-note">
          Вопросов нет. Добавьте то, о чём гости спрашивают чаще всего.
        </p>
      )}
      {rows.map((r, i) => (
        <Grid key={i} min={260} className="seller-faq__row">
          <Field label={`Вопрос ${i + 1}`}>
            <Input
              name={`faq-question-${i}`}
              value={r.question}
              maxLength={300}
              onChange={(e) => update(i, 'question', e.target.value)}
            />
          </Field>
          <Field label={`Ответ ${i + 1}`}>
            <Textarea
              name={`faq-answer-${i}`}
              rows={2}
              value={r.answer}
              maxLength={1000}
              onChange={(e) => update(i, 'answer', e.target.value)}
            />
          </Field>
          <Row>
            <Button
              type="button"
              tone="secondary"
              size="sm"
              onClick={() => setRows((all) => all.filter((_, j) => j !== i))}
            >
              Убрать вопрос {i + 1}
            </Button>
          </Row>
        </Grid>
      ))}
      <Row>
        <Button
          type="button"
          tone="secondary"
          disabled={full}
          onClick={() => add('')}
          data-testid="seller-faq-add"
        >
          Добавить вопрос
        </Button>
        {full && <span className="settings-note">Не больше {FAQ_MAX}.</span>}
      </Row>
      {!full && suggestions.length > 0 && (
        <div role="group" aria-label="Частые вопросы гостей" className="stack stack--sm">
          <p className="settings-note">
            Частые вопросы гостей — нажмите, чтобы добавить и написать ответ:
          </p>
          <Row>
            {suggestions.map((q) => (
              <Button key={q} type="button" tone="secondary" size="sm" onClick={() => add(q)}>
                {q}
              </Button>
            ))}
          </Row>
        </div>
      )}
    </Stack>
  );
}

/** «Применить» на шаге «Запуск»: отправить продавцу сохранённые настройки и данные объекта сейчас, а не через минуту */
export function ApplySellerForm() {
  const [state, action, pending] = useActionState<SellerFormResult | null, FormData>(
    applySellerAction,
    null,
  );
  return (
    <form key={state?.attempt ?? 0} action={action} className="stack stack--sm">
      <Row>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="seller-apply">
          {pending ? 'Отправляю…' : 'Применить — отправить продавцу'}
        </Button>
      </Row>
      {state?.error && <Alert data-testid="seller-apply-error">{state.error}</Alert>}
      {state?.warning && (
        <Alert tone="warning" data-testid="seller-apply-warning">
          {state.warning}
        </Alert>
      )}
      {state?.message && <Notice data-testid="seller-apply-result">{state.message}</Notice>}
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
