'use client';
import { useActionState, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Field,
  Grid,
  Input,
  Notice,
  Panel,
  Row,
  SectionTitle,
  Select,
  Stack,
  Textarea,
} from '../../components/ui';
import { FAQ_MAX, LIST_MAX } from '../../lib/ai-seller';
import type { SellerProfileBody } from '../../lib/api';
import {
  applySellerAction,
  dialogModeAction,
  replyAction,
  sandboxAction,
  uploadKnowledgeAction,
  type SandboxResult,
  type SellerFormResult,
  type SimpleResult,
} from './actions';

export interface Choice {
  value: string;
  label: string;
}

/**
 * «Настройки» продавца (ТЗ §4.1): личность и правила продаж полями. «Применить» сохраняет и сразу отправляет продавцу;
 * если продавец не ответил — настройки всё равно сохранены, отправит служба сверки. Варианты и пределы — модели бота
 * `SellerProfile` (ADR-081): чего бот не примет, форма не предлагает.
 */
export function SellerProfileForm({
  initial,
  languages,
  addressForms,
  emojis,
  replyLengths,
}: {
  initial: SellerProfileBody;
  languages: Choice[];
  addressForms: Choice[];
  emojis: Choice[];
  replyLengths: Choice[];
}) {
  const [state, action, pending] = useActionState<SellerFormResult | null, FormData>(
    applySellerAction,
    null,
  );
  const values = state?.values ?? initial;
  return (
    <form key={state?.attempt ?? 0} action={action} className="stack" data-testid="seller-profile">
      <Panel>
        <SectionTitle first>Как говорит продавец</SectionTitle>
        <Stack>
          <Grid min={200}>
            <Field label="Имя бота">
              <Input
                name="botName"
                defaultValue={values.botName ?? ''}
                maxLength={40}
                placeholder="Без имени"
              />
            </Field>
            <Field label="Обращение к гостю">
              <Select name="addressForm" defaultValue={values.addressForm}>
                {addressForms.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Длина реплик">
              <Select name="replyLength" defaultValue={values.replyLength}>
                {replyLengths.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Эмодзи">
              <Select name="emoji" defaultValue={values.emoji}>
                {emojis.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </Grid>
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
          <Field label="Приветствие">
            <Textarea name="greeting" rows={2} maxLength={300} defaultValue={values.greeting} />
          </Field>
        </Stack>
      </Panel>

      <Panel>
        <SectionTitle first>Правила продаж</SectionTitle>
        <Grid min={280}>
          <Field label="Что входит в цену">
            <Textarea
              name="includedInPrice"
              rows={3}
              maxLength={1000}
              defaultValue={values.includedInPrice}
            />
          </Field>
          <Field label="Что за доплату">
            <Textarea
              name="extraCharges"
              rows={3}
              maxLength={1000}
              defaultValue={values.extraCharges}
            />
          </Field>
          <Field label="Правила проживания">
            <Textarea name="houseRules" rows={4} maxLength={2000} defaultValue={values.houseRules} />
          </Field>
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
              rows={3}
              defaultValue={values.callHumanWhen.join('\n')}
              placeholder={'Группа от 6 человек\nОплата по счёту'}
            />
          </Field>
        </Grid>
        <p className="settings-note">
          В списках — до {LIST_MAX} строк, строка до 300 знаков. Жалобы, возврат денег, изменение и отмену брони продавец
          передаёт человеку и без этого списка.
        </p>
      </Panel>

      <FaqRows initial={values.faq} />

      <p className="settings-note">
        Адрес, время заезда, категории и цены продавец берёт из карточки объекта и тарифов — здесь их
        не перепечатывают. Правила ядра — не считать деньги, не обещать того, чего он не делает, звать
        человека — задаёт сам продавец: в настройках их нет, и стереть их нельзя.
      </p>
      <Row>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="seller-apply">
          {pending ? 'Применяю…' : 'Применить'}
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

/** Частые вопросы с ответами: строки добавляются и убираются; пустая строка при отправке отбрасывается */
function FaqRows({ initial }: { initial: Array<{ question: string; answer: string }> }) {
  const [rows, setRows] = useState(initial.length > 0 ? initial : []);
  const update = (i: number, key: 'question' | 'answer', value: string) =>
    setRows((all) => all.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  return (
    <Panel data-testid="seller-faq">
      <SectionTitle first>Частые вопросы</SectionTitle>
      <input type="hidden" name="faqCount" value={rows.length} />
      <Stack>
        {rows.length === 0 && (
          <p className="settings-note">Вопросов нет. Добавьте то, о чём гости спрашивают чаще всего.</p>
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
            disabled={rows.length >= FAQ_MAX}
            onClick={() => setRows((all) => [...all, { question: '', answer: '' }])}
            data-testid="seller-faq-add"
          >
            Добавить вопрос
          </Button>
          {rows.length >= FAQ_MAX && <span className="settings-note">Не больше {FAQ_MAX}.</span>}
        </Row>
      </Stack>
    </Panel>
  );
}

/** «Знания»: загрузка документа в базу знаний продавца */
export function KnowledgeUploadForm() {
  const [state, action, pending] = useActionState<SimpleResult | null, FormData>(
    uploadKnowledgeAction,
    null,
  );
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
export function DialogModeButtons({ id, mode }: { id: string; mode: string }) {
  const [result, setResult] = useState<SimpleResult | null>(null);
  const [pending, start] = useTransition();
  const run = (action: 'takeover' | 'release') =>
    start(async () => setResult(await dialogModeAction(id, action)));
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
export function DialogReplyForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<SimpleResult | null, FormData>(
    replyAction.bind(null, id),
    null,
  );
  return (
    <form key={state?.attempt ?? 0} action={action} className="stack stack--sm">
      <Field label="Ответ гостю">
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
export function SandboxForm() {
  const [state, action, pending] = useActionState<SandboxResult | null, FormData>(
    sandboxAction,
    null,
  );
  const history = state?.history ?? [];
  return (
    <Stack>
      {history.length > 0 && (
        <ol className="seller-transcript" data-testid="sandbox-history" aria-label="Проверка продавца">
          {history.map((h, i) => (
            <li key={i}>
              <p className="seller-transcript__guest">
                <b>Гость:</b> {h.question}
              </p>
              <p className="seller-transcript__bot">
                <b>Продавец:</b> {h.reply ?? 'ответа нет'}
              </p>
              {h.needsHuman && (
                <p className="settings-note">
                  Продавец позвал бы человека{h.reasons.length ? `: ${h.reasons.join('; ')}` : ''}.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      <form key={state?.attempt ?? 0} action={action} className="stack stack--sm">
        <Field label="Сообщение как от гостя">
          <Textarea
            name="text"
            rows={2}
            maxLength={2000}
            required
            placeholder="Здравствуйте, есть места на выходные?"
            data-testid="sandbox-text"
          />
        </Field>
        <Row>
          <Button type="submit" disabled={pending} aria-busy={pending} data-testid="sandbox-send">
            {pending ? 'Жду ответ продавца…' : 'Спросить продавца'}
          </Button>
        </Row>
        {state?.error && <Alert data-testid="sandbox-error">{state.error}</Alert>}
      </form>
    </Stack>
  );
}
