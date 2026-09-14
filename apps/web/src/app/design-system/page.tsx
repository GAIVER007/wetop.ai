import type { ReactNode } from 'react';
import { AmountBadge } from '../../components/amount-badge';
import { Icon } from '../../components/icon';
import { Page } from '../../components/page';
import { developmentOnly } from '../../lib/dev-only';
import { Alert, Badge, Button, Field, Input, Notice, Select, Stat, Stats, Table, cx } from '../../components/ui';
import { LiveActionMenu, LiveConfirm, LiveToast, LiveTooltip, StaticToast } from './showcase';

/**
 * Страница компонентов дизайн-системы (DESIGN.md §8; план design-system-2026-09-14, шаг 4).
 * Только при разработке: в production-сборке отвечает 404 (`notFound`, документация Next «functions/not-found»).
 * 31 компонент из DESIGN.md, у интерактивных — восемь состояний. Снимки страницы — эталон Playwright
 * (`design/reference/kit`), данные вымышленные (ADR-010).
 */
export const metadata = { title: 'Дизайн-система · WETOP' };

const STATES = [
  ['normal', 'обычное'],
  ['hover', 'наведение'],
  ['active', 'нажатие'],
  ['focus', 'фокус'],
  ['disabled', 'отключено'],
  ['loading', 'загрузка'],
  ['error', 'ошибка'],
  ['selected', 'выбрано'],
] as const;
type StateKey = (typeof STATES)[number][0];
type Cells = Record<StateKey, ReactNode>;

/** Восемь состояний интерактивного компонента. Строка вместо образца — объяснение, почему состояния нет. */
function States({ cells }: { cells: Partial<Cells> & Record<StateKey, ReactNode | string> }) {
  return (
    <div className="ds-states">
      {STATES.map(([key, name]) => {
        const cell = cells[key];
        return (
          <div key={key} className="ds-state" data-state={key}>
            <span className="ds-state__name">{name}</span>
            {typeof cell === 'string' ? <span className="ds-state__note">{cell}</span> : cell}
          </div>
        );
      })}
    </div>
  );
}

function Section({
  id,
  name,
  note,
  interactive,
  children,
}: {
  id: string;
  name: string;
  note: ReactNode;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className="ds-section" data-component={id} data-interactive={interactive ? 'true' : undefined}>
      <h2>{name}</h2>
      <p>{note}</p>
      {children}
    </section>
  );
}

const stay = (status: 'confirmed' | 'checked-in' | 'checked-out' | 'tentative', word: string, name: string, extra?: string) => (
  <a href="#cell" className={cx('board__stay')} style={{ background: `var(--st-${status})` }} data-status={status}>
    <b>{name}</b>
    <small>· {word}</small>
    {extra && <small>· {extra}</small>}
  </a>
);

const COMPONENTS = [
  'sidebar', 'page-title', 'search', 'button', 'cell', 'unit-row', 'category-row', 'date-header', 'booking-card', 'guest-card',
  'booking-form', 'day-tile', 'table', 'tabs', 'view-switch', 'date-picker', 'dropdown', 'drawer', 'announcement', 'unassigned-row',
  'channel-badge', 'sync-indicator', 'tasks-block', 'housekeeping-block', 'skeleton', 'empty-state', 'action-menu', 'confirm-dialog',
  'toast', 'tooltip', 'amount-badge',
] as const;

export default function DesignSystemPage() {
  developmentOnly();
  return (
    <Page
      title="Дизайн-система"
      subtitle={`${COMPONENTS.length} компонент из DESIGN.md §8 в восьми состояниях. Только при разработке; данные вымышленные.`}
      width="full"
    >
      <nav className="ds-nav" aria-label="Компоненты">
        {COMPONENTS.map((c) => (
          <a key={c} href={`#${c}`}>
            {c}
          </a>
        ))}
      </nav>

      <Section id="palette" name="Токены: цвета" note="Семантика из design/tokens.json; примитивы в CSS не выходят. Имя = переменная.">
        <div className="ds-swatches" data-testid="palette">
          {['bg', 'surface', 'surface-muted', 'surface-elevated', 'border', 'border-input', 'text', 'text-2', 'muted', 'primary', 'primary-soft', 'ring-color', 'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft', 'st-confirmed', 'st-checked-in', 'st-checked-out', 'st-tentative', 'st-blocked', 'chip-bg'].map((v) => (
            <div key={v} className="ds-swatch">
              <i style={{ background: `var(--${v})` }} />
              --{v}
            </div>
          ))}
        </div>
      </Section>

      <Section id="sidebar" name="Боковое меню" note="Пункт меню: значок и слово; активный — подложкой акцента и полосой слева. Группы без капса (DESIGN.md §14 — сейчас капс, шаг 4)." interactive>
        <States
          cells={{
            normal: <div className="ds-sidebar"><a className="workspace-link" href="#sidebar"><Icon name="board" />Шахматка</a></div>,
            hover: <div className="ds-sidebar"><a className="workspace-link is-hover" href="#sidebar"><Icon name="board" />Шахматка</a></div>,
            active: 'то же, что наведение: переход происходит сразу',
            focus: <div className="ds-sidebar"><a className="workspace-link is-focus" href="#sidebar"><Icon name="board" />Шахматка</a></div>,
            disabled: <div className="ds-sidebar"><span className="workspace-link" aria-disabled="true" style={{ opacity: 0.55 }}><Icon name="channels" />Интеграции <Badge>ещё не подключено</Badge></span></div>,
            loading: 'нет: меню не грузится отдельно от страницы',
            error: 'нет: ошибка показывается на странице, не в меню',
            selected: <div className="ds-sidebar"><a className="workspace-link is-active" aria-current="page" href="#sidebar"><Icon name="board" />Шахматка</a></div>,
          }}
        />
      </Section>

      <Section id="page-title" name="Заголовок страницы" note="Одна строка h1 (на неё стоят e2e), подзаголовок с числами дня, действия справа. Без подписи капсом над заголовком.">
        <div className="ds-sample">
          <header className="page__head">
            <div className="page__heading">
              <h3 className="page__title" style={{ margin: 0 }}>Шахматка</h3>
              <div className="page__subtitle">14 сент. — 20 сент. · Номера и койки · 88 мест</div>
            </div>
            <nav className="page__actions">
              <Button type="button"><Icon name="plus" />Новая бронь</Button>
            </nav>
          </header>
        </div>
      </Section>

      <Section id="search" name="Поиск" note="Поле с лупой в шапке: гость, бронь, номер. ⌘K / Ctrl+K открывает быстрый поиск (§12)." interactive>
        <States
          cells={{
            normal: <Input placeholder="Поиск гостя, брони, номера…" aria-label="Поиск" />,
            hover: <Input className="is-hover" placeholder="Поиск гостя, брони, номера…" aria-label="Поиск" />,
            active: 'то же, что фокус',
            focus: <Input className="is-focus" defaultValue="Әбдірахманова" aria-label="Поиск" />,
            disabled: <Input disabled placeholder="Поиск недоступен без API" aria-label="Поиск" />,
            loading: <Input defaultValue="Әбдір" aria-label="Поиск" aria-busy="true" placeholder="Ищем…" />,
            error: <Input aria-invalid="true" defaultValue="%%%" aria-label="Поиск" aria-describedby="search-err" />,
            selected: 'нет: результат выбирается в списке под полем',
          }}
        />
        <p id="search-err" className="ds-freshness" style={{ marginTop: 8 }}>ошибка: запрос из символов, которых нет в именах и номерах</p>
      </Section>

      <Section id="button" name="Кнопка" note="Залита только главная (DESIGN.md §8: сейчас залиты все тона — шаг 4); остальные — белые с цветной подписью. Загрузка — текстом на кнопке." interactive>
        <States
          cells={{
            normal: <Button type="button">Принять оплату</Button>,
            hover: <Button type="button" className="is-hover">Принять оплату</Button>,
            active: <Button type="button" className="is-active">Принять оплату</Button>,
            focus: <Button type="button" className="is-focus">Принять оплату</Button>,
            disabled: <Button type="button" disabled>Принять оплату</Button>,
            loading: <Button type="button" disabled aria-busy="true">Принимаю…</Button>,
            error: <Button type="button" tone="danger">Повторить</Button>,
            selected: <Button type="button" tone="info" aria-pressed="true">Сегодня</Button>,
          }}
        />
        <div className="ds-inline" style={{ marginTop: 16 }}>
          <Button type="button" tone="secondary">Второстепенная</Button>
          <Button type="button" tone="danger">Отменить со штрафом</Button>
          <Button type="button" tone="success">Заселить</Button>
          <Button type="button" tone="warning">Незаезд</Button>
          <Button type="button" tone="ghost">Снять</Button>
          <Button type="button" size="sm">Маленькая</Button>
          <Button type="button" size="xs">Крошечная</Button>
          <button type="button" className="icon-button" aria-label="Обновить"><Icon name="refresh" /></button>
        </div>
      </Section>

      <Section id="cell" name="Клетка брони" note="Полоса с заезда до последней ночи: заливка статуса плюс слово (DESIGN.md §9). Перетаскивание дублируется меню действий." interactive>
        <States
          cells={{
            normal: <table className="ds-board"><tbody><tr><td>{stay('confirmed', 'ждём', 'Сериков Арман')}</td></tr></tbody></table>,
            hover: <table className="ds-board"><tbody><tr><td>{stay('confirmed', 'ждём', 'Сериков Арман')}</td></tr></tbody></table>,
            active: <table className="ds-board"><tbody><tr><td><a href="#cell" className="board__stay is-active" style={{ background: 'var(--st-checked-in)', outline: '2px dashed var(--primary)' }}><b>Ким Дана</b><small>· переносим</small></a></td></tr></tbody></table>,
            focus: <table className="ds-board"><tbody><tr><td><a href="#cell" className="board__stay is-focus" style={{ background: 'var(--st-confirmed)' }}><b>Сериков Арман</b><small>· ждём</small></a></td></tr></tbody></table>,
            disabled: <table className="ds-board"><tbody><tr><td>{stay('checked-out', 'выехал', 'Smith John')}</td></tr></tbody></table>,
            loading: <table className="ds-board"><tbody><tr><td><a href="#cell" className="board__stay" style={{ background: 'var(--st-confirmed)', outline: '2px dotted var(--muted)' }} aria-busy="true"><b>Сериков Арман</b><small>· переселяем…</small></a></td></tr></tbody></table>,
            error: <table className="ds-board"><tbody><tr><td><a href="#cell" className="board__stay" style={{ background: 'var(--st-tentative)' }}><b>Бекболатов Дәулет</b><small>· не подтверждена</small></a></td></tr></tbody></table>,
            selected: <table className="ds-board"><tbody><tr><td><a href="#cell" className="board__stay is-focus" aria-current="true" style={{ background: 'var(--st-checked-in)' }}><b>Ким Дана</b><small>· заселён</small><AmountBadge amountMinor="1600000" kind="due" /></a></td></tr></tbody></table>,
          }}
        />
        <p className="ds-freshness" style={{ marginTop: 8 }}>наведение и обычное состояние клетки совпадают намеренно: полосу выделяет только фокус и рамка при наведении на компьютере</p>
      </Section>

      <Section id="unit-row" name="Строка номера и койки" note="Код ячейки, вид (номер / койка) и статус уборки словом. Код — основным шрифтом, не моноширинным (§14).">
        <div className="ds-sample ds-sample--tight">
          <table className="ds-board">
            <tbody>
              <tr>
                <td style={{ width: 200 }}><a href="#unit-row"><Icon name="inventory" width={16} height={16} /> R01</a> <span className="muted-2">номер</span> <Badge tone="warn">грязно</Badge></td>
                <td>{stay('checked-in', 'заселён', 'Гость Тестовый')}</td>
                <td />
                <td />
              </tr>
              <tr>
                <td><a href="#unit-row"><Icon name="bed" width={16} height={16} /> M03</a> <span className="muted-2">койка</span> <Badge tone="ok">убрано</Badge></td>
                <td />
                <td>{stay('confirmed', 'ждём', 'Constantinopolous-Wentworth Alexandria')}</td>
                <td />
              </tr>
              <tr>
                <td><a href="#unit-row"><Icon name="inventory" width={16} height={16} /> R09</a> <span className="muted-2">номер</span> <Badge tone="info">проверено</Badge></td>
                <td><span className="ds-block" title="ремонт: кондиционер" /></td>
                <td><span className="ds-block" /></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="category-row" name="Строка категории" note="Сворачивает ячейки категории и показывает свободные места по ночам; ноль — красным и словом «нет».">
        <div className="ds-sample ds-sample--tight">
          <table className="ds-board">
            <tbody>
              <tr className="board__group">
                <td style={{ width: 200 }}><button type="button" className="board-group-toggle" aria-expanded="true"><Icon name="down" width={16} height={16} /> Мужской общий номер <span className="muted">36</span></button></td>
                <td className="board__group-free">11</td>
                <td className="board__group-free is-full" title="мест нет">0 · нет</td>
                <td className="board__group-free">14</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="date-header" name="Заголовок даты" note="Число крупно, день недели мелко, занято/всего. Сегодня — подложкой акцента; выходные — нейтральные (не зелёные, §9).">
        <div className="ds-sample ds-sample--tight">
          <table className="ds-board">
            <thead>
              <tr>
                <th style={{ width: 200 }}>Номер / койка</th>
                <th><span className="board__d">13</span> <span className="board__wd">вс</span><div className="board__occ">64 / 88</div></th>
                <th style={{ background: 'var(--primary-soft)' }}><span className="board__d" style={{ color: 'var(--primary)' }}>14</span> <span className="board__wd">пн · сегодня</span><div className="board__occ">42 / 88</div></th>
                <th><span className="board__d">15</span> <span className="board__wd">вт</span><div className="board__occ">9 / 88</div></th>
              </tr>
            </thead>
          </table>
        </div>
      </Section>

      <Section id="booking-card" name="Карточка брони" note="Панель сбоку: номер, статус словом, гость, вкладки Обзор / Счета / Действия / История, сумма и остаток плашкой.">
        <div className="ds-sample">
          <div className="ds-inline"><strong>Бронь 20260913-SHOWTN</strong> <Badge tone="warn">не подтверждена</Badge> <Badge tone="info">Booking.com</Badge></div>
          <p style={{ margin: '8px 0' }}>Әбдірахманова Гүлнұр Қайратқызы · 14.09.2026 → 16.09.2026 · 2 ночи · R06</p>
          <div className="ds-inline"><AmountBadge amountMinor="2400000" kind="prepaid" /><AmountBadge amountMinor="0" kind="paid" /></div>
        </div>
      </Section>

      <Section id="guest-card" name="Карточка гостя" note="Профиль, документы (номер маскирован), история проживаний. Гражданство обязательно к заселению.">
        <div className="ds-sample">
          <div className="ds-inline"><strong>Нұрсұлтанұлы Ерғали</strong> <Badge>KAZ</Badge> <Badge tone="warn">нет документа</Badge></div>
          <p style={{ margin: '8px 0', color: 'var(--text-2)' }}>Телефон не указан · 3 проживания · последнее 12.09.2026</p>
        </div>
      </Section>

      <Section id="booking-form" name="Форма брони" note="Одно размещение или группа: категория, тариф, гостей, мест, ячейка. Шаги «01/02» — только для шагов формы (§14).">
        <div className="ds-sample">
          <div className="ds-inline">
            <Field label="Категория *"><Select defaultValue="MALE"><option value="MALE">Мужской общий номер (свободно 11)</option></Select></Field>
            <Field label="Тариф *"><Select defaultValue="BASE"><option value="BASE">Базовый (KZT)</option></Select></Field>
            <Field label="Гостей"><Input type="number" defaultValue={1} min={1} max={2} className="inp--w64" /></Field>
            <Field label="Количество мест"><Input type="number" defaultValue={3} min={1} className="inp--w64" /></Field>
          </div>
          <p className="ds-freshness" style={{ marginTop: 8 }}>3 проживания на первых свободных ячейках по номеру</p>
        </div>
      </Section>

      <Section id="day-tile" name="Плитка сводки дня" note="Число крупно, подпись, подсказка; тревога — красным словом и числом. Без значка в цветном квадрате (§15).">
        <Stats min={180}>
          <Stat label="Проживают" value="55" hint="активных размещений" />
          <Stat label="Заезды сегодня" value="24" hint="17 ожидают заселения" />
          <Stat label="Долг уезжающих" value="16 000 ₸" hint="1 счёт" tone="alarm" />
          <Stat label="Свободно" value="33" hint="номеров и коек" size="compact" />
        </Stats>
      </Section>

      <Section id="table" name="Таблица" note="Плотная, 13 px; строка под курсором подложкой; выбранная — подложкой акцента. Прокрутка по горизонтали — область с фокусом." interactive>
        <Table size="sm" dense nowrap aria-label="Пример таблицы">
          <thead><tr><th>Состояние</th><th>Бронь</th><th>Гость</th><th>Статус</th><th className="num">Сумма</th></tr></thead>
          <tbody>
            <tr data-state="normal"><td>обычное</td><td>20260913-SHOWDK</td><td>Сериков Арман</td><td><Badge tone="info">ждём</Badge></td><td className="num">8 000 ₸</td></tr>
            <tr className="is-hover" data-state="hover"><td>наведение</td><td>20260913-SHOWHW</td><td>Оганесян-Петросянц Александра</td><td><Badge tone="ok">заселён</Badge></td><td className="num">40 000 ₸</td></tr>
            <tr data-state="active"><td>нажатие</td><td colSpan={4}>то же, что наведение: строка открывает карточку сразу</td></tr>
            <tr data-state="focus"><td>фокус</td><td><a href="#table" className="is-focus">20260913-SHOWOS</a></td><td>Ким Дана</td><td><Badge tone="info">ждём</Badge></td><td className="num">16 000 ₸</td></tr>
            <tr data-state="disabled" style={{ color: 'var(--muted)' }}><td>отключено</td><td>20260913-SHOWCX</td><td>Нұрсұлтанұлы Ерғали</td><td><Badge tone="danger">отменена</Badge></td><td className="num">—</td></tr>
            <tr data-state="loading"><td>загрузка</td><td colSpan={4}><span className="skeleton skeleton-row" style={{ display: 'block', height: 18 }} /></td></tr>
            <tr data-state="error"><td>ошибка</td><td colSpan={4}><span role="alert" className="alert">Не удалось загрузить список: API не ответил за 60 с</span></td></tr>
            <tr className="is-selected" data-state="selected" aria-selected="true"><td>выбрано</td><td>20260913-SHOWTN</td><td>Әбдірахманова Гүлнұр</td><td><Badge tone="warn">не подтверждена</Badge></td><td className="num">24 000 ₸</td></tr>
          </tbody>
        </Table>
      </Section>

      <Section id="tabs" name="Вкладки со счётчиком" note="Активная — подчёркиванием акцента; счётчик у вкладки списка (заезды 24). Стрелки переключают (§12)." interactive>
        <States
          cells={{
            normal: <div className="record-tab-list" role="tablist"><button type="button" role="tab" aria-selected="false">Выезды <Badge>27</Badge></button></div>,
            hover: <div className="record-tab-list" role="tablist"><button type="button" role="tab" aria-selected="false" style={{ color: 'var(--text)' }}>Выезды <Badge>27</Badge></button></div>,
            active: 'то же, что выбрано: вкладка переключается сразу',
            focus: <div className="record-tab-list" role="tablist"><button type="button" role="tab" aria-selected="false" className="is-focus">Выезды <Badge>27</Badge></button></div>,
            disabled: <div className="record-tab-list" role="tablist"><button type="button" role="tab" aria-selected="false" disabled>Счета <Badge>0</Badge></button></div>,
            loading: <div className="record-tab-list" role="tablist"><button type="button" role="tab" aria-selected="false">История <Badge>…</Badge></button></div>,
            error: 'нет: ошибка показывается в содержимом вкладки',
            selected: <div className="record-tab-list" role="tablist"><button type="button" role="tab" aria-selected="true">Заезды <Badge tone="info">24</Badge></button></div>,
          }}
        />
      </Section>

      <Section id="view-switch" name="Переключатель вида" note="Неделя / 14 дней / Месяц (ADR-039). Выбранное — поверхностью с тенью, `aria-current`." interactive>
        <States
          cells={{
            normal: <span className="seg"><a href="#view-switch">Неделя</a><a href="#view-switch">14 дней</a><a href="#view-switch">Месяц</a></span>,
            hover: <span className="seg"><a href="#view-switch">Неделя</a><a href="#view-switch" className="is-hover">14 дней</a><a href="#view-switch">Месяц</a></span>,
            active: 'то же, что выбрано',
            focus: <span className="seg"><a href="#view-switch">Неделя</a><a href="#view-switch" className="is-focus">14 дней</a><a href="#view-switch">Месяц</a></span>,
            disabled: 'нет: все три вида всегда доступны',
            loading: 'нет: вид меняется адресом страницы, загрузка — скелетон сетки',
            error: 'нет',
            selected: <span className="seg"><a href="#view-switch" className="is-on" aria-current="true">Неделя</a><a href="#view-switch">14 дней</a><a href="#view-switch">Месяц</a></span>,
          }}
        />
      </Section>

      <Section id="date-picker" name="Выбор даты с «Сегодня» и стрелками" note="Поле даты, стрелки на период, кнопка «Сегодня». Показ — 14.09.2026 (§14; нативное поле показывает формат ОС — шаг 7.4)." interactive>
        <States
          cells={{
            normal: <div className="ds-inline"><button type="button" className="icon-button" aria-label="Предыдущая неделя"><Icon name="chevron" style={{ transform: 'rotate(180deg)' }} /></button><Input type="date" defaultValue="2026-09-14" aria-label="Дата" /><button type="button" className="icon-button" aria-label="Следующая неделя"><Icon name="chevron" /></button><Button type="button" tone="secondary">Сегодня</Button></div>,
            hover: <div className="ds-inline"><Input type="date" defaultValue="2026-09-14" className="is-hover" aria-label="Дата" /><Button type="button" tone="secondary" className="is-hover">Сегодня</Button></div>,
            active: 'то же, что фокус: открывается календарь ОС',
            focus: <div className="ds-inline"><Input type="date" defaultValue="2026-09-14" className="is-focus" aria-label="Дата" /></div>,
            disabled: <div className="ds-inline"><Input type="date" defaultValue="2026-09-14" disabled aria-label="Дата" /></div>,
            loading: 'нет: дата применяется кнопкой, загрузка — на кнопке «Применить»',
            error: <div className="ds-inline"><Input type="date" defaultValue="2026-09-20" aria-invalid="true" aria-label="Дата" /><span className="ds-freshness">выезд раньше заезда</span></div>,
            selected: <div className="ds-inline"><Button type="button" tone="info" aria-pressed="true">Сегодня</Button></div>,
          }}
        />
      </Section>

      <Section id="dropdown" name="Выпадающий фильтр" note="Select и чипы: статус, источник или канал. Способа гарантии и тегов нет (Q-131)." interactive>
        <States
          cells={{
            normal: <Select defaultValue="ALL" aria-label="Статус"><option value="ALL">Все статусы</option><option>ждём</option><option>заселён</option></Select>,
            hover: <Select defaultValue="ALL" aria-label="Статус" className="is-hover"><option value="ALL">Все статусы</option></Select>,
            active: 'то же, что фокус: список открыт',
            focus: <Select defaultValue="ALL" aria-label="Статус" className="is-focus"><option value="ALL">Все статусы</option></Select>,
            disabled: <Select disabled defaultValue="ALL" aria-label="Статус"><option value="ALL">Все статусы</option></Select>,
            loading: <Select disabled defaultValue="…" aria-label="Статус" aria-busy="true"><option value="…">Загружаем справочник…</option></Select>,
            error: <Select aria-invalid="true" defaultValue="ALL" aria-label="Статус"><option value="ALL">Справочник не загрузился</option></Select>,
            selected: <div className="ds-inline"><button type="button" className="filter-chip is-selected" aria-pressed="true">Занятые</button><button type="button" className="filter-chip">Свободные</button></div>,
          }}
        />
      </Section>

      <Section id="drawer" name="Панель сбоку" note="Карточка брони поверх шахматки: 480 px, затемнение, тень слоя, Escape закрывает и возвращает фокус. Живой пример — любая клетка на /chessboard.">
        <div className="ds-sample" style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 0, padding: 0, overflow: 'hidden', minHeight: 140 }}>
          <div style={{ background: 'var(--overlay)' }} aria-label="шахматка под затемнением" role="img" />
          <div style={{ background: 'var(--surface-elevated)', boxShadow: 'var(--shadow-floating)', padding: 16 }}>
            <div className="ds-inline" style={{ justifyContent: 'space-between' }}><strong>Бронирование</strong><button type="button" className="icon-button" aria-label="Закрыть: Бронирование"><Icon name="close" /></button></div>
            <p className="ds-freshness">панель сбоку · Escape закрывает</p>
          </div>
        </div>
      </Section>

      <Section id="announcement" name="Плашка-объявление" note="Ошибка — role=alert (на нём e2e); предупреждение и успех — тоном. Текст говорит, что делать.">
        <div style={{ display: 'grid', gap: 8 }}>
          <Alert boxed>Не удалось сохранить: место уже занято. Выберите другую ячейку.</Alert>
          <Alert tone="warning" boxed>Каналы могут не знать об остатках: ошибок отправки 1. Нажмите «Отправить очередь сейчас».</Alert>
          <Alert tone="success" boxed>Полная выгрузка отправлена: 500 дней, 3 задачи.</Alert>
          <Notice>Сохранено изменений: 1</Notice>
        </div>
      </Section>

      <Section id="unassigned-row" name="Строка «Без ячейки»" note="Проживание без койки в диапазоне доски (паритет с «Без номера» Exely) — конфликт по Д3, действие «Назначить». Станет строкой сетки на шаге 7.1.">
        <div className="ds-sample">
          <div className="ds-inline">
            <Icon name="incidents" width={16} height={16} style={{ color: 'var(--warning)' }} />
            <strong style={{ color: 'var(--warning)' }}>Без ячейки: 1</strong>
            <span>Мужской общий номер · <a href="#unassigned-row" style={{ textDecoration: 'underline' }}>20260913-SHOWUN</a> · 14.09.2026 → 17.09.2026 · ждём</span>
            <Button type="button" size="sm" tone="secondary">Назначить</Button>
          </div>
        </div>
      </Section>

      <Section id="channel-badge" name="Бейдж канала" note="Каналы различаются названием и значком, не цветом (документ). Стойка и сайт — тоже словом.">
        <div className="ds-inline">
          {['Booking.com', 'Trip.com', 'Agoda', 'Expedia', 'Hostelworld', 'Ostrovok', 'стойка', 'сайт', 'телефон'].map((c) => (
            <Badge key={c}><Icon name={['стойка', 'телефон'].includes(c) ? 'phone' : c === 'сайт' ? 'external' : 'channels'} width={12} height={12} /> {c}</Badge>
          ))}
        </div>
      </Section>

      <Section id="sync-indicator" name="Индикатор синхронизации Channex" note="Строка свежести в меню: время последней синхронизации Exely, событие Channex, очередь. Задержка — словом и цветом внимания.">
        <div style={{ display: 'grid', gap: 8 }}>
          <span className="ds-freshness">Exely 22:35 · Channex 22:31 · очередь 0</span>
          <span className="ds-freshness ds-freshness--warn">Exely 21:10 (25 мин назад) · Channex — · очередь 2, ошибок 1</span>
          <span className="ds-freshness ds-freshness--warn">Нет связи с API</span>
        </div>
      </Section>

      <Section id="tasks-block" name="Блок задач смены = «Требуют внимания»" note="Считается из данных дня: без ячейки, без гражданства, долг уезжающих. Задач со сроками нет (Q-132).">
        <section className="attention-card" style={{ maxWidth: 420 }}>
          <div className="attention-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0, fontSize: 14 }}>Требуют внимания</h3><span className="attention-count" style={{ display: 'inline-grid', placeItems: 'center', borderRadius: 999 }}>2</span></div>
          <div className="attention-list">
            <a href="#tasks-block" className="attention-item" style={{ display: 'flex', alignItems: 'center' }}><span className="attention-icon" style={{ display: 'inline-grid', placeItems: 'center', borderRadius: 8 }}><Icon name="guests" /></span><span><strong>Бекболатов Дәулет</strong><br /><small>назначить койку</small></span></a>
            <a href="#tasks-block" className="attention-item" style={{ display: 'flex', alignItems: 'center' }}><span className="attention-icon" style={{ display: 'inline-grid', placeItems: 'center', borderRadius: 8 }}><Icon name="money" /></span><span><strong>Клиент Пример</strong><br /><small>к оплате 16 000 ₸</small></span></a>
          </div>
        </section>
      </Section>

      <Section id="housekeeping-block" name="Блок уборки" note="Три статуса словом: грязно, убрано, проверено; ремонт — блокировка с причиной, не статус уборки (§9).">
        <div className="ds-inline">
          <Badge tone="warn">грязно</Badge>
          <Badge tone="ok">убрано</Badge>
          <Badge tone="info">проверено</Badge>
          <Badge tone="danger">ремонт: кондиционер</Badge>
          <Button type="button" size="sm" tone="secondary">Отметить убранной</Button>
        </div>
      </Section>

      <Section id="skeleton" name="Скелетон" note="Единственная анимация без действия — загрузка (§13). Форма повторяет плитку, строку и заголовок.">
        <div style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
          <span className="skeleton skeleton-title" style={{ display: 'block' }} />
          <span className="skeleton skeleton-row" style={{ display: 'block' }} />
          <span className="skeleton skeleton-row" style={{ display: 'block' }} />
        </div>
      </Section>

      <Section id="empty-state" name="Пустое состояние" note="Значок, заголовок, что сделать. Пусто и ошибка — разные состояния (пусто не значит сбой).">
        <div className="empty-state" style={{ border: '1px dashed var(--border)' }}>
          <Icon name="check" />
          <h3>Заездов на сегодня нет</h3>
          <p>Следующий заезд — завтра, 15.09.2026: 12 проживаний.</p>
          <Button type="button" tone="secondary" size="sm">Открыть завтра</Button>
        </div>
      </Section>

      <Section id="action-menu" name="Меню действий" note="Кнопка «Действия» или «⋯» → Переселить, Продлить, Заселить, Отменить со штрафом. Замена перетаскиванию (§12). Роли menu / menuitem." interactive>
        <div className="ds-sample" style={{ minHeight: 200 }}>
          <LiveActionMenu />
        </div>
        <States
          cells={{
            normal: <span className="btn btn--secondary">Действия <Icon name="down" width={16} height={16} /></span>,
            hover: <span className="btn btn--secondary is-hover">Действия <Icon name="down" width={16} height={16} /></span>,
            active: <div className="action-menu__list" style={{ position: 'static' }}><span className="action-menu__item is-hover"><Icon name="bed" width={16} height={16} /><span>Переселить</span></span><span className="action-menu__item"><Icon name="plus" width={16} height={16} /><span>Продлить на ночь</span></span></div>,
            focus: <div className="action-menu__list" style={{ position: 'static' }}><span className="action-menu__item is-focus"><Icon name="bed" width={16} height={16} /><span>Переселить</span></span></div>,
            disabled: <div className="action-menu__list" style={{ position: 'static' }}><span className="action-menu__item" aria-disabled="true"><Icon name="arrival" width={16} height={16} /><span>Заселить<small>нет гражданства</small></span></span></div>,
            loading: 'нет: действие уходит в окно подтверждения или на кнопку с текстом «…»',
            error: 'нет: ошибка действия показывается уведомлением',
            selected: <div className="action-menu__list" style={{ position: 'static' }}><span className="action-menu__item action-menu__item--danger is-hover"><Icon name="incidents" width={16} height={16} /><span>Отменить со штрафом</span></span></div>,
          }}
        />
      </Section>

      <Section id="confirm-dialog" name="Окно подтверждения" note="Только для необратимого: переселение в другую категорию, отмена со штрафом. Сумма и последствие видны до нажатия (Д5). Заменяет window.confirm." interactive>
        <div className="ds-sample">
          <LiveConfirm />
        </div>
        <States
          cells={{
            normal: <span className="ds-state__note">кнопка «Отменить со штрафом» — образец выше</span>,
            hover: 'кнопки окна — как у компонента «Кнопка»',
            active: 'кнопки окна — как у компонента «Кнопка»',
            focus: 'при открытии фокус на главной кнопке окна; Escape = отмена',
            disabled: 'обе кнопки заблокированы, пока идёт действие',
            loading: <span className="btn" aria-busy="true">Отменяю…</span>,
            error: <span role="alert" className="alert">Штраф не начислен: политика тарифа не задана (Q-103)</span>,
            selected: 'нет: окно либо подтверждено, либо закрыто',
          }}
        />
      </Section>

      <Section id="toast" name="Уведомление" note="Результат действия виден: «Проживание продлено», «Оплата принята». Уходит через 6 с; ошибка — до закрытия. role=status." interactive>
        <div className="ds-sample">
          <LiveToast />
        </div>
        <States
          cells={{
            normal: <StaticToast item={{ tone: 'ok', text: 'Проживание продлено до 17.09.2026' }} />,
            hover: 'нет: уведомление не реагирует на наведение, у кнопки закрытия — как у значка',
            active: 'нет',
            focus: 'фокус — на кнопке «Закрыть уведомление», как у значка',
            disabled: 'нет',
            loading: <StaticToast item={{ tone: 'info', text: 'Отправляем остаток в Channex…' }} />,
            error: <StaticToast item={{ tone: 'danger', text: 'Не удалось отправить остаток в Channex: очередь ждёт повтора' }} />,
            selected: <StaticToast item={{ tone: 'warn', text: 'Бронь без ячейки на сегодня', action: { label: 'Назначить', href: '#toast' } }} />,
          }}
        />
      </Section>

      <Section id="tooltip" name="Подсказка" note="Открывается наведением и фокусом, закрывается Escape, связана aria-describedby. Только для пояснений — смысл пишется словом рядом." interactive>
        <div className="ds-sample" style={{ minHeight: 96, display: 'flex', alignItems: 'flex-end' }}>
          <LiveTooltip />
        </div>
        <States
          cells={{
            normal: <button type="button" className="icon-button" aria-label="Карточка гостя"><Icon name="guests" /></button>,
            hover: <span className="tooltip-anchor"><button type="button" className="icon-button is-hover" aria-label="Карточка гостя"><Icon name="guests" /></button><span role="tooltip" className="tooltip tooltip--bottom">Открыть карточку гостя</span></span>,
            active: 'то же, что наведение',
            focus: <span className="tooltip-anchor"><button type="button" className="icon-button is-focus" aria-label="Карточка гостя"><Icon name="guests" /></button><span role="tooltip" className="tooltip tooltip--bottom">Открыть карточку гостя</span></span>,
            disabled: 'у отключённого элемента подсказка объясняет, почему: «нет гражданства»',
            loading: 'нет',
            error: 'нет',
            selected: 'нет',
          }}
        />
      </Section>

      <Section id="amount-badge" name="Плашка суммы" note="Остаток словом и знаком: к оплате, оплачено, предоплата, штраф, к возврату. Деньги — «12 500 ₸», без копеек, если их нет (§14).">
        <div className="ds-inline">
          <AmountBadge amountMinor="1600000" kind="due" />
          <AmountBadge amountMinor="0" kind="paid" />
          <AmountBadge amountMinor="2400000" kind="prepaid" />
          <AmountBadge amountMinor="800000" kind="penalty" />
          <AmountBadge amountMinor="123450" kind="refund" />
        </div>
      </Section>

      <Section id="keys" name="Клавиатура" note="Обязательные сочетания (§12); сочетания для действий стойки — после ответа Q-133.">
        <div className="ds-inline">
          <span><kbd className="ds-kbd">⌘</kbd> <kbd className="ds-kbd">K</kbd> поиск</span>
          <span><kbd className="ds-kbd">Esc</kbd> закрыть панель</span>
          <span><kbd className="ds-kbd">←</kbd> <kbd className="ds-kbd">→</kbd> вкладки карточки</span>
          <span><kbd className="ds-kbd">Tab</kbd> по всем действиям</span>
        </div>
      </Section>
    </Page>
  );
}
