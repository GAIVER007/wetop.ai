'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { useToast } from '../../components/toast';
import { Alert, Button } from '../../components/ui';
import { useConfirm } from '../../components/use-confirm';
import type { StayAvailability, UnassignedStay } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { assignUnitAction, previewAction } from '../reservations/actions';
import { stayAvailabilityAction } from './actions';
import {
  crossCategoryQuestion,
  freeChoice,
  unassignedCard,
  unassignedSummary,
  type CrossCategoryQuestion,
  type UnassignedCard,
} from './unassigned-plan';

const HASH = '#unassigned-stays';
type Category = { code: string; name: string };
/** Свободные места по датам брони: грузятся, пришли или не загрузились */
type Loaded = { state: 'loading' } | { state: 'ok'; data: StayAvailability } | { state: 'error' };
const datesKey = (c: UnassignedCard) => `${c.arrivalDate}|${c.departureDate}`;

/**
 * Брони без размещения (ТЗ «Шахматка v2» §11–12, §64). Над сеткой — одна строка «⚠ 2 брони без
 * назначенного места» и «Разместить»; нет таких броней — строки нет. «Разместить» открывает ящик:
 * карточка на каждое проживание без ячейки — гость, даты, категория, свободные места на весь срок и
 * «Назначить R07». Места грузятся по выбранной карточке, а не для каждой (условие владельца: без N+1);
 * первая выбрана сама. Своих мест нет — «Посмотреть другие категории»: размещение там переоценит
 * проживание, поэтому сначала вопрос с разницей стоимости. «Только чтение» (ADR-102) — места видны,
 * назначить нельзя. Якорь `#unassigned-stays` (плашка «Продано сверх мест», «Назначить» с Главной)
 * открывает ящик сразу.
 */
export function UnassignedStays({
  stays,
  critical,
  categories,
  readOnly,
}: {
  stays: UnassignedStay[];
  critical: boolean;
  categories: Category[];
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [free, setFree] = useState<Record<string, Loaded>>({});
  // что только что размещено: уведомление в углу лежит под модальным ящиком, поэтому итог — и здесь
  const [done, setDone] = useState<string | null>(null);
  // одно окно подтверждения на весь ящик, а не в каждой карточке
  const { ask, dialog } = useConfirm();
  const cards = stays.map(unassignedCard);

  useEffect(() => {
    const sync = () => {
      if (window.location.hash === HASH) setOpen(true);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setDone(null);
    // якорь снимаем: иначе повторный щелчок по «Разрешить» не даст hashchange и ящик не откроется
    if (window.location.hash === HASH)
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
  }, []);

  // Что уже загружено — и в ref: решение «грузить ли» принимается сразу, не дожидаясь перерисовки.
  // Поколение растёт при сбросе после назначения: запоздавший ответ старого поколения не пишется.
  const loadedRef = useRef<Record<string, Loaded>>({});
  const generation = useRef(0);
  const remember = useCallback((next: Record<string, Loaded>) => {
    loadedRef.current = next;
    setFree(next);
  }, []);
  const load = useCallback(
    async (card: UnassignedCard, force = false) => {
      const key = datesKey(card);
      const was = loadedRef.current[key];
      if (!force && was && was.state !== 'error') return;
      const gen = generation.current;
      remember({ ...loadedRef.current, [key]: { state: 'loading' } });
      const data = await stayAvailabilityAction(card.arrivalDate, card.departureDate);
      if (gen !== generation.current) return;
      remember({
        ...loadedRef.current,
        [key]: data ? { state: 'ok', data } : { state: 'error' },
      });
    },
    [remember],
  );

  const pick = useCallback(
    (card: UnassignedCard) => {
      setSelected(card.key);
      void load(card);
    },
    [load],
  );

  // Открыт ящик, а выбранной карточки нет (первое открытие или бронь только что размещена) — выбираем
  // первую; все размещены — ящик закрывается вместе со строкой
  const keys = cards.map((c) => c.key).join(',');
  useEffect(() => {
    if (!open) return;
    if (cards.length === 0) {
      close();
      return;
    }
    if (!selected || !cards.some((c) => c.key === selected)) pick(cards[0]!);
    // cards пересобираются на каждой перерисовке — следим за составом (keys), а не за ссылкой
  }, [open, keys, selected]);

  if (cards.length === 0) return null;
  const summary = unassignedSummary(stays);
  return (
    <>
      <div
        id="unassigned-stays"
        data-testid="unassigned-stays"
        data-count={stays.length}
        data-tone={critical ? 'critical' : 'warning'}
        className="board-unassigned"
      >
        <Icon name="incidents" />
        <span className="board-unassigned-text">{summary.text}</span>
        <Button
          type="button"
          tone="ghost"
          size="sm"
          className="board-unassigned-open"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          Разместить
        </Button>
      </div>
      <Overlay
        open={open}
        onClose={close}
        title="Брони без размещения"
        drawer
        className="unassigned-drawer"
      >
        <p className="unassigned-drawer__lead" data-testid="unassigned-count">
          {summary.text}
          {summary.detail && <span className="muted">, {summary.detail}</span>}
        </p>
        {done && (
          <p className="unassigned-drawer__done" role="status" data-testid="unassigned-done">
            ✓ {done}
          </p>
        )}
        <ul className="unassigned-drawer__list">
          {cards.map((card) => (
            <UnassignedCardView
              key={card.key}
              card={card}
              selected={card.key === selected}
              loaded={free[datesKey(card)]}
              categories={categories}
              readOnly={readOnly}
              ask={ask}
              onPick={() => pick(card)}
              onRetry={() => void load(card, true)}
              onAssigned={(text) => {
                setDone(text);
                // место занято — прежние списки свободных мест устарели для всех карточек
                generation.current += 1;
                remember({});
                setSelected(null);
              }}
            />
          ))}
        </ul>
        {dialog}
      </Overlay>
    </>
  );
}

function UnassignedCardView({
  card,
  selected,
  loaded,
  categories,
  readOnly,
  ask,
  onPick,
  onRetry,
  onAssigned,
}: {
  card: UnassignedCard;
  selected: boolean;
  loaded: Loaded | undefined;
  categories: Category[];
  readOnly: boolean;
  ask: ReturnType<typeof useConfirm>['ask'];
  onPick: () => void;
  onRetry: () => void;
  onAssigned: (text: string) => void;
}) {
  const [chosen, setChosen] = useState<{ unit: string; category: Category } | null>(null);
  const [others, setOthers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  const choice = loaded?.state === 'ok' ? freeChoice(card, loaded.data, categories) : null;
  const own: Category = { code: card.categoryCode, name: card.category };
  // по умолчанию — первое свободное место своей категории (ТЗ §12: «Назначить 101»)
  const target = chosen ?? (choice?.own[0] ? { unit: choice.own[0], category: own } : null);

  const assign = async (unit: string, category: Category) => {
    if (!card.itemId || pending) return;
    if (category.code !== card.categoryCode) {
      const preview = await previewAction(card.number, card.itemId, {
        action: 'move',
        unitCode: unit,
      });
      const q = crossCategoryQuestion(card, unit, category.name, preview);
      if (
        !(await ask({
          title: q.title,
          body: <QuestionBody question={q} />,
          confirmLabel: 'Разместить',
          tone: 'primary',
        }))
      )
        return;
    }
    const fd = new FormData();
    fd.set('unitCode', unit);
    fd.set('fromDate', card.arrivalDate);
    setError(null);
    start(async () => {
      // server action сам делает revalidatePath('/chessboard') — строка и сетка перерисуются с сервера
      const r = await assignUnitAction(card.number, card.itemId!, { error: null }, fd);
      start(() => {
        if (r.error) {
          setError(`Не удалось назначить: ${r.error}`);
          return;
        }
        const text = `Бронь ${card.number} размещена: ${unit}`;
        toast({ text, tone: 'success' });
        onAssigned(text);
      });
    });
  };

  const units = (list: string[], category: Category) => (
    <div className="chips unassigned-card__units" role="group" aria-label={category.name}>
      {list.map((u) => (
        <button
          key={u}
          type="button"
          className="mono"
          aria-pressed={target?.unit === u}
          onClick={() => setChosen({ unit: u, category })}
        >
          {u}
        </button>
      ))}
    </div>
  );

  return (
    <li className="unassigned-card" data-testid="unassigned-card" data-selected={selected}>
      <p className="unassigned-card__guest">{card.guest}</p>
      <p className="unassigned-card__dates">
        <time dateTime={card.arrivalDate}>{displayDate(card.arrivalDate)}</time>
        {' → '}
        <time dateTime={card.departureDate}>{displayDate(card.departureDate)}</time>, {card.nights}
      </p>
      <p className="unassigned-card__meta">
        {card.category}, {card.status}, <span className="mono">{card.number}</span>
      </p>
      {selected && loaded?.state === 'loading' && (
        <p className="muted" role="status">
          Ищем свободные места…
        </p>
      )}
      {selected && loaded?.state === 'error' && (
        <p className="unassigned-card__problem" role="status">
          Свободные места не загрузились.{' '}
          <Button type="button" tone="ghost" size="sm" onClick={onRetry}>
            Повторить
          </Button>
        </p>
      )}
      {selected && choice && (
        <div className="unassigned-card__free">
          {choice.own.length > 0 ? (
            <>
              <p className="unassigned-card__label">Свободно</p>
              <div data-testid="unassigned-free">{units(choice.own, own)}</div>
            </>
          ) : (
            <>
              <p className="unassigned-card__problem">Нет доступных мест в категории</p>
              {!others && (
                <Button type="button" tone="secondary" size="sm" onClick={() => setOthers(true)}>
                  Посмотреть другие категории
                </Button>
              )}
            </>
          )}
          {others &&
            (choice.others.length > 0 ? (
              choice.others.map((c) => (
                <div key={c.code} data-testid="unassigned-other">
                  <p className="unassigned-card__label">{c.name}</p>
                  {units(c.units, c)}
                </div>
              ))
            ) : (
              <p className="muted">В других категориях на эти даты мест тоже нет</p>
            ))}
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      <div className="unassigned-card__actions">
        {!selected && (
          <Button type="button" tone="secondary" size="sm" onClick={onPick}>
            Подобрать место
          </Button>
        )}
        {selected && readOnly && choice && (
          <p className="muted">Только чтение: назначить место нельзя</p>
        )}
        {selected && !readOnly && target && card.itemId && (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => void assign(target.unit, target.category)}
          >
            {pending ? 'Назначаем…' : `Назначить ${target.unit}`}
          </Button>
        )}
        <Link
          className="btn btn--ghost btn--sm"
          href={`/reservations/${encodeURIComponent(card.number)}`}
        >
          Открыть бронь
        </Link>
      </div>
    </li>
  );
}

/** Тело вопроса перед размещением в другой категории — те же строки, что окно переселения §27 */
function QuestionBody({ question: q }: { question: CrossCategoryQuestion }) {
  return (
    <div className="move-question">
      <p className="move-question__guest">{q.guest}</p>
      {/* названия категорий — обычным шрифтом: моноширинный у переселения для кодов мест */}
      <p>{q.route}</p>
      <p>{q.dates}</p>
      <p className="move-question__money">{q.money}</p>
      <p className="move-question__note">{q.note}</p>
    </div>
  );
}
