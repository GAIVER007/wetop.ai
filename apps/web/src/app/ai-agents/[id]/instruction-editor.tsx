'use client';
import type { BusinessVertical } from '@pms/domain';
import { useEffect, useState, useTransition } from 'react';
import { Alert, Button, Field, Notice, Panel, Row, Stack, Textarea } from '../../../components/ui';
import type { AgentInstructionPreview, AgentInstructionView } from '../../../lib/api';
import { appendDictated, useDictation } from '../../../lib/use-dictation';
import { generateAgentInstruction, saveAgentInstruction } from './actions';
import { useT } from '../../../i18n/locale-provider';

export function InstructionEditor({id, initial, readOnly = false, vertical = null}: {id: string; initial: AgentInstructionView; readOnly?: boolean; vertical?: BusinessVertical | null}) {
  const t = useT();
  const hospitality = vertical === 'HOSPITALITY';
  const placeholder = hospitality ? t('Назови бота Ася. Отвечай дружелюбно и коротко. Рассказывай о правилах отеля и помогай выбрать размещение…') : vertical === 'BEAUTY' ? t('Назови бота Ася. Рассказывай об услугах салона, ценах каталога и длительности. Для записи приглашай администратора.') : vertical === 'FOOD_SERVICE' ? t('Назови бота Ася. Рассказывай о периодах обслуживания ресторана. Для бронирования приглашай администратора.') : t('Опишите стиль общения и когда приглашать сотрудника.');
  const [step, setStep] = useState(initial.saved || !hospitality ? 2 : 1);
  const [story, setStory] = useState('');
  const [text, setText] = useState(initial.text);
  const [saved, setSaved] = useState(initial.text);
  const [preview, setPreview] = useState<AgentInstructionPreview | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  // диктовка общим хуком стойки (SITE-1): тот же сервис браузера, что в чате первого экрана сайта
  const dictation = useDictation({
    onText: (phrase) => setStory((previous) => appendDictated(previous, phrase, 4000)),
    onError: setError,
  });
  const listening = dictation.listening;
  const dirty = text !== saved;
  useEffect(() => {
    if (!dirty && !story && !preview) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, story, preview]);

  function changeStep(next: number) {
    if (next !== 1 && listening) dictation.stop();
    setStep(next);
  }
  function dictate() {
    if (!listening) setError('');
    dictation.toggle();
  }
  function generate() {
    if (!hospitality) return;
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
      setNotice(t('Инструкция сохранена у этого агента.'));
    });
  }
  return <div className="agent-wizard">
    <nav className="agent-wizard__steps" aria-label={t('Шаги настройки агента')}>
      <div className="agent-wizard__step"><span>✓</span><b>{t('Объект')}</b><small>{t('Выбран')}</small></div>
      <button type="button" className="agent-wizard__step" disabled={!hospitality} aria-current={step === 1 ? 'step' : undefined} onClick={() => changeStep(1)}><span>02</span><b>{t('Ваш рассказ')}</b><small>{hospitality ? t('Текст или голос') : t('Пока недоступно')}</small></button>
      <button type="button" className="agent-wizard__step" aria-current={step === 2 ? 'step' : undefined} onClick={() => changeStep(2)}><span>03</span><b>{t('Инструкция')}</b><small>{dirty ? t('Есть изменения') : saved ? t('Сохранена') : t('Редактирование')}</small></button>
      <div className="agent-wizard__step" aria-disabled="true"><span>04</span><b>{t('Тестовый чат')}</b><small>{t('После подключения агента')}</small></div>
      <div className="agent-wizard__step" aria-disabled="true"><span>05</span><b>{t('WhatsApp и запуск')}</b><small>{t('После проверки')}</small></div>
    </nav>
    <div className="agent-wizard__body">
      <Stack>
        {error && <Alert boxed>{error}</Alert>}
        {notice && <div role="status"><Notice>{notice}</Notice></div>}
        {step === 1 ? <Panel title={t('Расскажите, каким должен быть продавец')}>
          <p className="muted">{t('Как представляться, что предлагать, как общаться и когда звать сотрудника. Можно написать своими словами.')}</p>
          <Field label={t('Ваш рассказ')}><Textarea rows={9} value={story} maxLength={4000} disabled={pending || readOnly || listening} onChange={e => setStory(e.target.value)} placeholder={placeholder} /></Field>
          <Row><Button type="button" tone="secondary" disabled={pending || readOnly} onClick={dictate} aria-pressed={listening}>{listening ? t('Остановить диктовку') : t('Надиктовать')}</Button><span className="muted" aria-live="polite">{listening ? t('Слушаю…') : `${story.length} / 4000`}</span></Row>
          <small className="muted">{t('Диктовку обрабатывает сервис браузера. Проверьте расшифровку перед генерацией.')}</small>
          <Row><Button type="button" disabled={pending || readOnly || listening || story.trim().length < 10} onClick={generate}>{pending ? t('Готовлю инструкцию…') : t('Сгенерировать инструкцию')}</Button><Button type="button" tone="ghost" disabled={listening} onClick={() => changeStep(2)}>{t('Написать вручную')}</Button></Row>
        </Panel> : <>
          {preview && <Panel title={t('Предложенная редакция')} className="agent-wizard__preview">
            <p className="muted">{t('Текущий текст пока не изменён. Проверьте предложение перед заменой.')}</p>
            <Field label={t('Предпросмотр инструкции')}><Textarea readOnly rows={8} value={preview.text} /></Field>
            {preview.warnings.map(warning => <small className="muted" key={warning}>{warning}</small>)}
            <Row><Button type="button" disabled={readOnly} onClick={() => {setText(preview.text); setPreview(null); setNotice(t('Редакция принята. Отредактируйте и сохраните инструкцию.'));}}>{t('Использовать эту редакцию')}</Button><Button type="button" tone="secondary" onClick={() => setPreview(null)}>{t('Оставить текущую')}</Button></Row>
          </Panel>}
          <Panel title={t('Инструкция вашего продавца')}>
            {!hospitality && <Notice tone="muted">{t('Для этого направления напишите инструкцию вручную. Генерация пока доступна гостиницам.')}</Notice>}
            <Field label={t('Как агент должен отвечать')}><Textarea rows={16} maxLength={20000} value={text} disabled={pending || readOnly} onChange={e => {setText(e.target.value); setNotice('');}} placeholder={hospitality ? t('Введите свою инструкцию или вернитесь к рассказу и сгенерируйте её.') : placeholder} /></Field>
            <Row className="agent-wizard__save"><span className="muted">{text.length} / 20 000</span><span className="muted">{dirty ? t('Не сохранено') : saved ? t('Сохранено') : t('Пустая инструкция')}</span><Button type="button" onClick={save} disabled={pending || readOnly || !text.trim() || !dirty}>{pending ? t('Сохраняю…') : t('Сохранить инструкцию')}</Button></Row>
          </Panel>
        </>}
      </Stack>
      <aside className="agent-wizard__rules" aria-label={hospitality ? t('Правила бронирования агента') : t('Границы инструментов агента')}>
        <Panel title={hospitality ? t('Правила бронирования') : t('Границы инструментов')}>
          <p className="muted">{t('Обязательная логика платформы. Пользовательская инструкция не должна её отменять.')}</p>
          {hospitality ? <ol><li>{t('Уточнить даты и количество гостей.')}</li><li>{t('Получить наличие и стоимость из системы.')}</li><li>{t('Показать выбранный вариант и итоговую цену.')}</li><li>{t('Получить явное подтверждение гостя.')}</li><li>{t('Создать одну бронь и вернуть подтверждение из системы.')}</li></ol> : <ul><li>{t('Использовать только инструменты выбранного бизнеса.')}</li><li>{vertical === 'BEAUTY' ? t('Сообщать сохранённые цены каталога и длительность услуг.') : vertical === 'FOOD_SERVICE' ? t('Сообщать сохранённые периоды обслуживания.') : t('При недоступном направлении приглашать сотрудника.')}</li><li>{t('Не обещать наличие, запись или оплату. Для оформления пригласить администратора.')}</li></ul>}
          <Notice tone="muted">{hospitality ? t('Запись брони через WhatsApp ещё проходит подключение и проверку.') : t('Инструменты Beauty/Food доступны только для чтения.')}{' '}{t('Сохранение инструкции само по себе не запускает бота.')}</Notice>
        </Panel>
      </aside>
    </div>
  </div>;
}
