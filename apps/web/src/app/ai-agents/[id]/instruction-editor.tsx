'use client';
import type { BusinessVertical } from '@pms/domain';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Alert, Button, Field, Notice, Panel, Row, Stack, Textarea } from '../../../components/ui';
import type { AgentInstructionPreview, AgentInstructionView } from '../../../lib/api';
import { generateAgentInstruction, saveAgentInstruction } from './actions';

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: {resultIndex: number; results: ArrayLike<{isFinal: boolean; 0: {transcript: string}}>}) => void) | null;
  onerror: ((event: {error: string}) => void) | null;
  onend: (() => void) | null;
};

export function InstructionEditor({id, initial, readOnly = false, vertical = null}: {id: string; initial: AgentInstructionView; readOnly?: boolean; vertical?: BusinessVertical | null}) {
  const hospitality = vertical === 'HOSPITALITY';
  const placeholder = hospitality ? 'Назови бота Ася. Отвечай дружелюбно и коротко. Рассказывай о правилах отеля и помогай выбрать размещение…' : vertical === 'BEAUTY' ? 'Назови бота Ася. Рассказывай об услугах салона, ценах каталога и длительности. Для записи приглашай администратора.' : vertical === 'FOOD_SERVICE' ? 'Назови бота Ася. Рассказывай о периодах обслуживания ресторана. Для бронирования приглашай администратора.' : 'Опишите стиль общения и когда приглашать сотрудника.';
  const [step, setStep] = useState(initial.saved ? 2 : 1);
  const [story, setStory] = useState('');
  const [text, setText] = useState(initial.text);
  const [saved, setSaved] = useState(initial.text);
  const [preview, setPreview] = useState<AgentInstructionPreview | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const dirty = text !== saved;
  useEffect(() => () => { if (recognition.current) { recognition.current.onend = null; recognition.current.onresult = null; recognition.current.onerror = null; recognition.current.abort(); } }, []);
  useEffect(() => {
    if (!dirty && !story && !preview) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, story, preview]);

  function changeStep(next: number) {
    if (next !== 1 && listening) {
      recognition.current?.stop();
      setListening(false);
    }
    setStep(next);
  }
  function dictate() {
    if (recognition.current && listening) { recognition.current.stop(); return; }
    const browser = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { setError('В этом браузере диктовка недоступна. Введите рассказ текстом или воспользуйтесь системной диктовкой.'); return; }
    setError('');
    const recorder = new Constructor(); recognition.current = recorder;
    recorder.lang = 'ru-RU'; recorder.continuous = true; recorder.interimResults = false;
    recorder.onresult = (event) => {
      const parts: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index]; if (result?.isFinal) parts.push(result[0].transcript);
      }
      if (parts.length) setStory(previous => `${previous}${previous ? ' ' : ''}${parts.join(' ')}`.slice(0, 4000));
    };
    recorder.onerror = (event) => { setListening(false); setError(event.error === 'not-allowed' ? 'Доступ к микрофону не разрешён. Разрешите его в браузере или введите текст.' : 'Не удалось распознать речь. Проверьте микрофон или продолжите текстом.'); };
    recorder.onend = () => setListening(false);
    try { recorder.start(); setListening(true); } catch { setError('Не удалось начать диктовку. Попробуйте ещё раз или введите текст.'); }
  }
  function generate() {
    setError(''); setNotice('');
    startTransition(async () => {
      const result = await generateAgentInstruction(id, story);
      if (!result.ok) { setError(result.error); return; }
      setPreview(result.value); setStep(2);
    });
  }
  function save() {
    setError(''); setNotice('');
    const submitted = text;
    startTransition(async () => {
      const result = await saveAgentInstruction(id, submitted);
      if (!result.ok) { setError(result.error); return; }
      setSaved(result.value.text);
      setText(result.value.text);
      setNotice('Инструкция сохранена у этого агента.');
    });
  }
  return <div className="agent-wizard">
    <nav className="agent-wizard__steps" aria-label="Шаги настройки агента">
      <div className="agent-wizard__step"><span>✓</span><b>Объект</b><small>Выбран</small></div>
      <button type="button" className="agent-wizard__step" aria-current={step === 1 ? 'step' : undefined} onClick={() => changeStep(1)}><span>02</span><b>Ваш рассказ</b><small>Текст или голос</small></button>
      <button type="button" className="agent-wizard__step" aria-current={step === 2 ? 'step' : undefined} onClick={() => changeStep(2)}><span>03</span><b>Инструкция</b><small>{dirty ? 'Есть изменения' : saved ? 'Сохранена' : 'Редактирование'}</small></button>
      <div className="agent-wizard__step" aria-disabled="true"><span>04</span><b>Тестовый чат</b><small>После подключения агента</small></div>
      <div className="agent-wizard__step" aria-disabled="true"><span>05</span><b>WhatsApp и запуск</b><small>После проверки</small></div>
    </nav>
    <div className="agent-wizard__body">
      <Stack>
        {error && <Alert boxed>{error}</Alert>}
        {notice && <div role="status"><Notice>{notice}</Notice></div>}
        {step === 1 ? <Panel title="Расскажите, каким должен быть продавец">
          <p className="muted">Как представляться, что предлагать, как общаться и когда звать сотрудника. Можно написать своими словами.</p>
          <Field label="Ваш рассказ"><Textarea rows={9} value={story} maxLength={4000} disabled={pending || readOnly || listening} onChange={e => setStory(e.target.value)} placeholder={placeholder} /></Field>
          <Row><Button type="button" tone="secondary" disabled={pending || readOnly} onClick={dictate} aria-pressed={listening}>{listening ? 'Остановить диктовку' : 'Надиктовать'}</Button><span className="muted" aria-live="polite">{listening ? 'Слушаю…' : `${story.length} / 4000`}</span></Row>
          <small className="muted">Диктовку обрабатывает сервис браузера. Проверьте расшифровку перед генерацией.</small>
          <Row><Button type="button" disabled={pending || readOnly || listening || story.trim().length < 10} onClick={generate}>{pending ? 'Готовлю инструкцию…' : 'Сгенерировать инструкцию'}</Button><Button type="button" tone="ghost" disabled={listening} onClick={() => changeStep(2)}>Написать вручную</Button></Row>
        </Panel> : <>
          {preview && <Panel title="Предложенная редакция" className="agent-wizard__preview">
            <p className="muted">Текущий текст пока не изменён. Проверьте предложение перед заменой.</p>
            <Field label="Предпросмотр инструкции"><Textarea readOnly rows={8} value={preview.text} /></Field>
            {preview.warnings.map(warning => <small className="muted" key={warning}>{warning}</small>)}
            <Row><Button type="button" disabled={readOnly} onClick={() => {setText(preview.text); setPreview(null); setNotice('Редакция принята. Отредактируйте и сохраните инструкцию.');}}>Использовать эту редакцию</Button><Button type="button" tone="secondary" onClick={() => setPreview(null)}>Оставить текущую</Button></Row>
          </Panel>}
          <Panel title="Инструкция вашего продавца">
            <Field label="Как агент должен отвечать"><Textarea rows={16} maxLength={20000} value={text} disabled={pending || readOnly} onChange={e => {setText(e.target.value); setNotice('');}} placeholder="Введите свою инструкцию или вернитесь к рассказу и сгенерируйте её." /></Field>
            <Row className="agent-wizard__save"><span className="muted">{text.length} / 20 000</span><span className="muted">{dirty ? 'Не сохранено' : saved ? 'Сохранено' : 'Пустая инструкция'}</span><Button type="button" onClick={save} disabled={pending || readOnly || !text.trim() || !dirty}>{pending ? 'Сохраняю…' : 'Сохранить инструкцию'}</Button></Row>
          </Panel>
        </>}
      </Stack>
      <aside className="agent-wizard__rules" aria-label={hospitality ? 'Правила бронирования агента' : 'Границы инструментов агента'}>
        <Panel title={hospitality ? 'Правила бронирования' : 'Границы инструментов'}>
          <p className="muted">Обязательная логика платформы. Пользовательская инструкция не должна её отменять.</p>
          {hospitality ? <ol><li>Уточнить даты и количество гостей.</li><li>Получить наличие и стоимость из системы.</li><li>Показать выбранный вариант и итоговую цену.</li><li>Получить явное подтверждение гостя.</li><li>Создать одну бронь и вернуть подтверждение из системы.</li></ol> : <ul><li>Использовать только инструменты выбранного бизнеса.</li><li>{vertical === 'BEAUTY' ? 'Сообщать сохранённые цены каталога и длительность услуг.' : vertical === 'FOOD_SERVICE' ? 'Сообщать сохранённые периоды обслуживания.' : 'При недоступном направлении приглашать сотрудника.'}</li><li>Не обещать наличие, запись или оплату. Для оформления пригласить администратора.</li></ul>}
          <Notice tone="muted">{hospitality ? 'Запись брони через WhatsApp ещё проходит подключение и проверку.' : 'Инструменты Beauty/Food доступны только для чтения.'} Сохранение инструкции само по себе не запускает бота.</Notice>
        </Panel>
      </aside>
    </div>
  </div>;
}
