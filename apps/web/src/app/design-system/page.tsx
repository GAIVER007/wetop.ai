import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Page } from '../../components/page';
import { AmountChip } from '../../components/amount-chip';
import { Icon, iconNames } from '../../components/icon';
import { RecordTabs } from '../../components/record-tabs';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Legend,
  LoadingState,
  Notice,
  Panel,
  Select,
  Skeleton,
  Stat,
  Stats,
  StatusBadge,
  Table,
} from '../../components/ui';
import { Tooltip } from '../../components/tooltip';
import { ConfirmDemo, ErrorDemo, MenuDemo, ToastDemo, ToastStatic, TooltipDemo } from './demos';
import './kit.css';

/**
 * Страница компонентов (DESIGN.md, план шаг 4). Только при разработке: в production-сборке — 404.
 * Показывает токены и все компоненты §8 в восьми состояниях, в светлой и тёмной теме на одном
 * экране. Снимки секций — эталон Playwright (design/reference/kit, tests/ui/design-system.spec.ts).
 * Состояния «наведение», «фокус» и «нажатие» — живые: наведите, нажмите Tab, удерживайте кнопку;
 * тест снимает их сам.
 */
export const dynamic = 'force-static';

const STATES = [
  ['default', 'обычное'],
  ['hover', 'наведение'],
  ['focus', 'фокус'],
  ['active', 'нажатие'],
  ['disabled', 'отключено'],
  ['loading', 'загрузка'],
  ['error', 'ошибка'],
  ['selected', 'выбрано'],
] as const;
export type StateName = (typeof STATES)[number][0];

const COLOR_TOKENS = [
  ['bg', 'фон страницы'],
  ['surface', 'панель'],
  ['surface-muted', 'приглушённая'],
  ['surface-elevated', 'над страницей'],
  ['border', 'граница'],
  ['border-soft', 'линия строки'],
  ['border-input', 'граница поля'],
  ['text', 'текст'],
  ['text-2', 'второстепенный'],
  ['muted', 'подсказка'],
  ['primary', 'акцент'],
  ['primary-soft', 'бледный акцент'],
  ['success', 'норма'],
  ['success-soft', ''],
  ['warning', 'внимание'],
  ['warning-soft', ''],
  ['danger', 'тревога'],
  ['danger-soft', ''],
  ['chip-bg', 'нейтральный бейдж'],
  ['row-hover', 'строка под курсором'],
  ['focus', 'кольцо фокуса'],
] as const;
const STATUS_TOKENS = [
  ['st-confirmed', 'подтверждена', '•'],
  ['st-checked-in', 'заселён', '✓'],
  ['st-checked-out', 'выселен', '✕'],
  ['st-tentative', 'предварительная', '?'],
  ['st-blocked', 'блокировка', '▨'],
] as const;

function State({ name, children, note }: { name: StateName; children: ReactNode; note?: string }) {
  const label = STATES.find(([n]) => n === name)![1];
  return (
    <div className="kit-state" data-state={name}>
      <div className="kit-state__label">
        {label}
        {note && <span className="kit-state__note"> — {note}</span>}
      </div>
      <div className="kit-state__body">{children}</div>
    </div>
  );
}

function Component({
  id,
  title,
  where,
  interactive,
  children,
}: {
  id: string;
  title: string;
  where: string;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="kit-component"
      data-component={id}
      data-interactive={interactive ? 'true' : undefined}
      aria-labelledby={`kit-${id}`}
    >
      <h3 id={`kit-${id}`} className="kit-component__title">
        {title}
      </h3>
      <p className="kit-component__where">{where}</p>
      <div className="kit-states">{children}</div>
    </section>
  );
}

function Kit() {
  return (
    <>
      <section className="kit-component" data-component="tokens" aria-labelledby="kit-tokens">
        <h3 id="kit-tokens" className="kit-component__title">
          Токены
        </h3>
        <p className="kit-component__where">
          design/tokens.json → tokens.css. Цвет через семантику, отступы из шкалы, радиус по уровню.
        </p>
        <div className="kit-swatches">
          {COLOR_TOKENS.map(([name, label]) => (
            <div key={name} className="kit-swatch">
              <span className="kit-swatch__color" style={{ background: `var(--${name})` }} />
              <code>--{name}</code>
              {label && <span className="kit-swatch__label">{label}</span>}
            </div>
          ))}
        </div>
        <div className="kit-row">
          {STATUS_TOKENS.map(([name, label, glyph]) => (
            <span key={name} className="kit-status" style={{ background: `var(--${name})` }}>
              <b>{glyph}</b> {label}
            </span>
          ))}
        </div>
        <div className="kit-row kit-spaces">
          {[1, 2, 4, 6, 8, 10, 12, 16].map((n) => (
            <span key={n} className="kit-space" title={`--space-${n}`}>
              <i style={{ width: `var(--space-${n})` }} />
              <code>{n * 4}</code>
            </span>
          ))}
        </div>
        <div className="kit-row">
          {(['xs', 'sm', 'control', '', 'lg'] as const).map((r) => (
            <span
              key={r || 'md'}
              className="kit-radius"
              style={{ borderRadius: `var(--radius${r ? `-${r}` : ''})` }}
            >
              --radius{r ? `-${r}` : ''}
            </span>
          ))}
        </div>
        <div className="kit-type">
          {(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'] as const).map((s) => (
            <div key={s} style={{ fontSize: `var(--text-${s})` }}>
              <code>--text-{s}</code> Ақбота Әбдіғаппарова · 12 500 ₸ · 20.09.2026
            </div>
          ))}
        </div>
      </section>

      <section className="kit-component" data-component="icons" aria-labelledby="kit-icons">
        <h3 id="kit-icons" className="kit-component__title">
          Иконки
        </h3>
        <p className="kit-component__where">
          Lucide через components/icon.tsx: 20 px, линия 1,7; 16 px в тексте.
        </p>
        <div className="kit-icons">
          {iconNames.map((n) => (
            <span key={n} className="kit-icon">
              <Icon name={n} />
              <code>{n}</code>
            </span>
          ))}
        </div>
      </section>

      <Component
        id="button"
        title="Кнопка"
        where="ui.tsx · Button; 38 px, sm 30, xs 24; залита только главная"
        interactive
      >
        <State name="default">
          <div className="row">
            <Button type="button">Создать бронь</Button>
            <Button type="button" tone="secondary">
              Отмена
            </Button>
            <Button type="button" tone="danger">
              Отменить бронь
            </Button>
            <Button type="button" tone="warning">
              Незаезд
            </Button>
            <Button type="button" tone="success">
              Заселить
            </Button>
            <Button type="button" tone="info">
              Подробнее
            </Button>
            <Button type="button" tone="secondary" size="sm">
              Малая
            </Button>
            <Button type="button" tone="secondary" size="xs">
              Крошечная
            </Button>
          </div>
        </State>
        <State name="hover" note="наведите">
          <Button type="button" data-live="hover">
            Создать бронь
          </Button>
        </State>
        <State name="focus" note="Tab">
          <Button type="button" data-live="focus">
            Создать бронь
          </Button>
        </State>
        <State name="active" note="удерживайте">
          <Button type="button" data-live="active">
            Создать бронь
          </Button>
        </State>
        <State name="disabled">
          <Button type="button" disabled>
            Создать бронь
          </Button>
        </State>
        <State name="loading" note="текст на кнопке, без крутилки">
          <Button type="button" disabled aria-busy="true">
            Сохраняю…
          </Button>
        </State>
        <State name="error">
          <div className="row">
            <Button type="button">Создать бронь</Button>
            <Alert>Ячейка R01 уже занята на 16–19 сент.</Alert>
          </div>
        </State>
        <State name="selected" note="переключатель вида">
          <span className="seg">
            <a href="#week" className="is-on" aria-current="page">
              Неделя
            </a>
            <a href="#two-weeks">14 дней</a>
            <a href="#month">Месяц</a>
          </span>
        </State>
      </Component>

      <Component
        id="input"
        title="Поле, выбор, текст"
        where="ui.tsx · Input / Select / Textarea / Field; 38 px, на телефоне 16 px"
        interactive
      >
        <State name="default">
          <div className="row">
            <Field label="Заезд">
              <Input type="date" defaultValue="2026-09-20" />
            </Field>
            <Field label="Категория">
              <Select defaultValue="ROOM">
                <option value="ROOM">Двухместный номер</option>
                <option value="MALE">Мужской общий</option>
              </Select>
            </Field>
            <Field label="Фамилия">
              <Input placeholder="Фамилия" />
            </Field>
          </div>
        </State>
        <State name="hover" note="наведите">
          <Input placeholder="Фамилия" data-live="hover" aria-label="Фамилия" />
        </State>
        <State name="focus" note="Tab">
          <Input placeholder="Фамилия" data-live="focus" aria-label="Фамилия" />
        </State>
        <State name="active" note="ввод">
          <Input defaultValue="Әбдіғаппар" aria-label="Фамилия" />
        </State>
        <State name="disabled">
          <Input defaultValue="20260913-TESTAA" disabled aria-label="Номер брони" />
        </State>
        <State name="loading">
          <Input
            defaultValue="Проверяю доступность…"
            readOnly
            aria-busy="true"
            aria-label="Ячейка"
          />
        </State>
        <State name="error">
          <Field label="Гражданство">
            <Input defaultValue="" aria-invalid="true" aria-describedby="kit-inp-err" />
            <Alert id="kit-inp-err">Заселение без гражданства не пройдёт</Alert>
          </Field>
        </State>
        <State name="selected">
          <label className="check">
            <input type="checkbox" defaultChecked /> завтрак включён
          </label>
        </State>
      </Component>

      <Component
        id="badge"
        title="Бейдж статуса"
        where="ui.tsx · Badge / StatusBadge; точка + слово"
      >
        <State name="default">
          <div className="row">
            <StatusBadge status="TENTATIVE" label="предварительная" />
            <StatusBadge status="CONFIRMED" label="подтверждена" />
            <StatusBadge status="CHECKED_IN" label="заселён" />
            <StatusBadge status="CHECKED_OUT" label="выселен" />
            <StatusBadge status="CANCELLED" label="отменена" />
            <StatusBadge status="NO_SHOW" label="незаезд" />
            <Badge>стойка</Badge>
            <Badge tone="info">Booking.com</Badge>
          </div>
        </State>
      </Component>

      <Component
        id="amount-chip"
        title="Плашка суммы"
        where="amount-chip.tsx · AmountChip; слово + сумма, тиыны только когда есть"
      >
        <State name="default">
          <div className="row">
            <AmountChip minor="1250000" tone="due" />
            <AmountChip minor="2400000" tone="paid" />
            <AmountChip minor="800000" tone="refund" />
            <AmountChip minor="1250050" />
            <AmountChip minor="0" tone="paid" label="долга нет" />
          </div>
        </State>
      </Component>

      <Component
        id="stat"
        title="Плитка показателя"
        where="ui.tsx · Stat; белая, цвет только у значения, когда нужно действие"
      >
        <State name="default">
          <Stats min={150}>
            <Stat label="Заезды" value="20" hint="10 ожидают заселения" />
            <Stat label="Свободно" value="19" hint="номеров и коек" />
            <Stat label="Не заселены" value="4" tone="warn" hint="после 18:00 — незаезд" />
            <Stat label="Долг уезжающих" value="155 357 ₸" tone="alarm" hint="проверьте расчёт" />
          </Stats>
        </State>
      </Component>

      <Component id="panel" title="Панель" where="ui.tsx · Panel; рамка 1 px, радиус 16, без тени">
        <State name="default">
          <Panel title="Заметки и источник">
            <p className="hint">Пожелание: тихая комната. Источник — телефон.</p>
          </Panel>
        </State>
        <State name="loading" note="скелетон">
          <div className="skeleton skeleton-row" aria-hidden="true" />
        </State>
        <State name="error" note="пустое состояние">
          <div className="empty-state">
            <Icon name="booking" />
            <h3>Броней на эту дату нет</h3>
            <p>Выберите другой день или создайте бронь.</p>
          </div>
        </State>
      </Component>

      <Component
        id="table"
        title="Таблица"
        where="ui.tsx · Table; шапка 42 px, строка 38–42, прокрутка внутри с фокусом"
        interactive
      >
        <State name="default">
          <Table size="sm" aria-label="Брони дня">
            <thead>
              <tr>
                <th>Гость</th>
                <th>Проживание</th>
                <th>Статус</th>
                <th className="num">К оплате</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <a href="#g1">Ақбота Әбдіғаппарова</a>
                  <br />
                  <span className="mono small muted">20260916-DSG-TENT</span>
                </td>
                <td>17 сент. → 20 сент. · 3 ночи</td>
                <td>
                  <StatusBadge status="TENTATIVE" label="предварительная" />
                </td>
                <td className="num">
                  <AmountChip minor="3600000" tone="due" />
                </td>
              </tr>
              <tr className="is-active">
                <td>
                  <a href="#g2">Гость Стойка</a>
                </td>
                <td>15 сент. → 17 сент. · 2 ночи</td>
                <td>
                  <StatusBadge status="CHECKED_IN" label="заселён" />
                </td>
                <td className="num">
                  <AmountChip minor="0" tone="paid" label="оплачено" />
                </td>
              </tr>
              <tr className="is-void">
                <td>
                  <a href="#g3">Посетитель Отменённый</a>
                </td>
                <td>16 сент. → 18 сент. · 2 ночи</td>
                <td>
                  <StatusBadge status="CANCELLED" label="отменена" />
                </td>
                <td className="num">—</td>
              </tr>
            </tbody>
          </Table>
        </State>
        <State name="hover" note="наведите на строку">
          <Table size="sm" aria-label="Строка под курсором">
            <tbody>
              <tr data-live="hover">
                <td>Гость Стойка</td>
                <td>15 сент. → 17 сент.</td>
              </tr>
            </tbody>
          </Table>
        </State>
        <State name="focus" note="Tab на область прокрутки">
          <Table size="sm" aria-label="Фокус на таблице" data-live="focus">
            <tbody>
              <tr>
                <td>Гость Стойка</td>
                <td>15 сент. → 17 сент.</td>
              </tr>
            </tbody>
          </Table>
        </State>
        <State name="active" note="строка-ссылка">
          <Table size="sm" aria-label="Нажатие">
            <tbody>
              <tr>
                <td>
                  <a href="#g2" data-live="active">
                    Гость Стойка
                  </a>
                </td>
              </tr>
            </tbody>
          </Table>
        </State>
        <State name="disabled" note="строка отменённой брони">
          <Table size="sm" aria-label="Отменённая">
            <tbody>
              <tr className="is-void">
                <td>Посетитель Отменённый</td>
                <td>16 сент. → 18 сент.</td>
              </tr>
            </tbody>
          </Table>
        </State>
        <State name="loading">
          <div className="skeleton skeleton-row" aria-hidden="true" />
        </State>
        <State name="error">
          <Alert boxed>Не удалось загрузить брони: ответ сервера не получен</Alert>
        </State>
        <State name="selected">
          <Table size="sm" aria-label="Выбранная">
            <tbody>
              <tr className="is-active">
                <td>Гость Стойка</td>
                <td>15 сент. → 17 сент.</td>
              </tr>
            </tbody>
          </Table>
        </State>
      </Component>

      <Component
        id="tabs"
        title="Вкладки"
        where="record-tabs.tsx · RecordTabs; стрелки, Home/End; счётчик в подписи"
        interactive
      >
        <State name="default">
          <RecordTabs
            label="Разделы карточки"
            tabs={[
              {
                id: 'overview',
                label: 'Обзор',
                content: <p className="hint">Даты, гости, заказчик.</p>,
              },
              {
                id: 'folio',
                label: 'Счета · 2',
                content: <p className="hint">Два счёта, долг 12 500 ₸.</p>,
              },
              {
                id: 'actions',
                label: 'Действия',
                content: <p className="hint">Заселить, продлить, переселить.</p>,
              },
            ]}
          />
        </State>
        <State name="hover" note="наведите">
          <div className="record-tab-list" role="presentation">
            <button type="button" data-live="hover">
              Обзор
            </button>
          </div>
        </State>
        <State name="focus" note="Tab">
          <div className="record-tab-list" role="presentation">
            <button type="button" data-live="focus">
              Обзор
            </button>
          </div>
        </State>
        <State name="active" note="нажатие">
          <div className="record-tab-list" role="presentation">
            <button type="button" data-live="active">
              Обзор
            </button>
          </div>
        </State>
        <State name="disabled">
          <div className="record-tab-list" role="presentation">
            <button type="button" disabled>
              История
            </button>
          </div>
        </State>
        <State name="loading">
          <div className="record-tab-list" role="presentation">
            <button type="button" aria-busy="true">
              Счета · …
            </button>
          </div>
        </State>
        <State name="error">
          <div className="record-tab-list" role="presentation">
            <button type="button">
              Счета · <span className="danger-text">ошибка</span>
            </button>
          </div>
        </State>
        <State name="selected">
          <div className="record-tab-list" role="tablist" aria-label="Выбранная вкладка">
            <button type="button" aria-selected="true" role="tab">
              Счета · 2
            </button>
          </div>
        </State>
      </Component>

      <Component
        id="alert"
        title="Сообщения"
        where="ui.tsx · Alert (role=alert) / Notice; плашка-объявление — Alert boxed"
      >
        <State name="default">
          <div className="stack stack--sm">
            <Alert>Ячейка R01 уже занята на 16–19 сент.</Alert>
            <Alert boxed>Не удалось сохранить: ответ сервера не получен</Alert>
            <Alert boxed tone="warning">
              Webhook Channex не отвечает 12 минут — брони подбирает опрос ленты
            </Alert>
            <Notice>Бронь создана, ячейка R04 назначена</Notice>
            <Notice tone="muted">Данные обновлены 15:44</Notice>
          </div>
        </State>
      </Component>

      <Component
        id="states"
        title="Пусто, загрузка, сбой"
        where="ui.tsx · EmptyState, LoadingState, Skeleton; error-state.tsx · ErrorState (экран и панель, error.tsx)"
      >
        <State name="default" note="пусто: что пусто и что сделать, действие — ссылкой или кнопкой">
          <EmptyState
            icon={<Icon name="booking" />}
            title="Бронирований не найдено"
            actions={
              <>
                <Button tone="secondary">Все статусы</Button>
                <Button tone="secondary">Сбросить фильтры</Button>
              </>
            }
          >
            На 20 сент., статус «Проживают», бронирований нет. Уберите условие или выберите другой
            день.
          </EmptyState>
        </State>
        <State
          name="loading"
          note="скелетоны формы содержимого, aria-busy и живая подпись; без крутилки"
        >
          <LoadingState label="Загружаем список броней…">
            <Skeleton variant="title" />
            <Skeleton />
            <Skeleton />
            <Skeleton variant="text" />
          </LoadingState>
        </State>
        <State
          name="error"
          note="нет связи — повтор и путь к подключениям; отклонённый запрос — проверить адрес, повтор не поможет"
        >
          <div className="stack stack--sm">
            <ErrorDemo digest="API_503" />
            <ErrorDemo digest="API_404" />
          </div>
        </State>
      </Component>

      <Component
        id="action-menu"
        title="Меню действий"
        where="action-menu.tsx · ActionMenu; замена перетаскиванию: Переселить / Продлить / Отменить"
        interactive
      >
        <State name="default">
          <MenuDemo />
        </State>
        <State name="hover" note="наведите на кнопку">
          <button
            type="button"
            className="btn btn--secondary action-menu__button"
            aria-label="Действия"
            data-live="hover"
          >
            <Icon name="more" />
          </button>
        </State>
        <State name="focus" note="Tab">
          <button
            type="button"
            className="btn btn--secondary action-menu__button"
            aria-label="Действия"
            data-live="focus"
          >
            <Icon name="more" />
          </button>
        </State>
        <State name="active" note="нажатие">
          <button
            type="button"
            className="btn btn--secondary action-menu__button"
            aria-label="Действия"
            data-live="active"
          >
            <Icon name="more" />
          </button>
        </State>
        <State name="disabled">
          <button
            type="button"
            className="btn btn--secondary action-menu__button"
            aria-label="Действия"
            disabled
          >
            <Icon name="more" />
          </button>
        </State>
        <State name="loading" note="пока команда идёт">
          <button
            type="button"
            className="btn btn--secondary action-menu__button"
            aria-label="Действия"
            disabled
            aria-busy="true"
          >
            <Icon name="more" />
          </button>
        </State>
        <State name="error" note="пункт недоступен — с причиной">
          <div className="action-menu__list is-open kit-static" role="presentation">
            <span className="action-menu__item" aria-disabled="true">
              Заселить — нет гражданства
            </span>
            <span className="action-menu__item action-menu__item--danger">Отменить бронь…</span>
          </div>
        </State>
        <State name="selected" note="открытое меню, пункт под курсором">
          <div className="action-menu__list is-open kit-static" role="presentation">
            <span className="action-menu__item">Переселить…</span>
            <span className="action-menu__item kit-hover">Продлить на ночь</span>
            <span className="action-menu__item action-menu__item--danger">Отменить бронь…</span>
          </div>
        </State>
      </Component>

      <Component
        id="confirm-dialog"
        title="Окно подтверждения"
        where="confirm-dialog.tsx · ConfirmDialog; только для необратимого, кнопка названа действием"
        interactive
      >
        <State name="default" note="статичный показ">
          <div className="confirm-dialog confirm-dialog--static" role="presentation">
            <div className="confirm-dialog__body">
              <div className="confirm-dialog__title">Переселить в R04 на 16–19 сент.?</div>
              <div className="confirm-dialog__text">
                Категория та же, цена не меняется: <strong>24 000 ₸</strong> за 3 ночи.
              </div>
              <div className="confirm-dialog__actions">
                <Button type="button" tone="secondary">
                  Оставить как есть
                </Button>
                <Button type="button">Переселить</Button>
              </div>
            </div>
          </div>
        </State>
        <State name="hover" note="живое окно: наведите на кнопку внутри">
          <ConfirmDemo />
        </State>
        <State name="focus" note="в живом окне фокус на «Оставить как есть», Escape — отказ">
          <span className="hint">см. живое окно выше</span>
        </State>
        <State name="active" note="нажатие на кнопку действия в живом окне">
          <span className="hint">см. живое окно выше</span>
        </State>
        <State name="disabled" note="во время команды обе кнопки отключены">
          <div className="confirm-dialog confirm-dialog--static" role="presentation">
            <div className="confirm-dialog__body">
              <div className="confirm-dialog__title">Отменить бронь 20260913-TESTAA?</div>
              <div className="confirm-dialog__actions">
                <Button type="button" tone="secondary" disabled>
                  Оставить как есть
                </Button>
                <Button type="button" tone="danger" disabled>
                  Выполняю…
                </Button>
              </div>
            </div>
          </div>
        </State>
        <State name="loading" note="то же: «Выполняю…»">
          <span className="hint">см. «отключено»</span>
        </State>
        <State name="error" note="ошибка команды остаётся в окне">
          <div className="confirm-dialog confirm-dialog--static" role="presentation">
            <div className="confirm-dialog__body">
              <div className="confirm-dialog__title">Отменить бронь 20260913-TESTAA?</div>
              <Alert>Ответ сервера не получен. Обновите данные и проверьте результат.</Alert>
              <div className="confirm-dialog__actions">
                <Button type="button" tone="secondary">
                  Оставить как есть
                </Button>
                <Button type="button" tone="danger">
                  Отменить бронь
                </Button>
              </div>
            </div>
          </div>
        </State>
        <State name="selected" note="со штрафом: сумма в окне">
          <div className="confirm-dialog confirm-dialog--static" role="presentation">
            <div className="confirm-dialog__body">
              <div className="confirm-dialog__title">Отменить бронь 20260913-TESTAA?</div>
              <div className="confirm-dialog__text">
                По политике тарифа будет начислен штраф <strong>8 000 ₸</strong>; предоплата 24 000
                ₸ останется на счёте.
              </div>
              <div className="confirm-dialog__actions">
                <Button type="button" tone="secondary">
                  Оставить как есть
                </Button>
                <Button type="button" tone="danger">
                  Отменить бронь
                </Button>
              </div>
            </div>
          </div>
        </State>
      </Component>

      <Component
        id="toast"
        title="Уведомление"
        where="toast.tsx · ToastProvider / useToast; правый верх, 4 с, aria-live"
        interactive
      >
        <State name="default" note="четыре тона">
          <ToastStatic />
        </State>
        <State name="hover" note="живые: нажмите и наведите на ×">
          <ToastDemo />
        </State>
        <State name="focus" note="Tab на ×">
          <div className="toast-region toast-region--static">
            <div className="toast toast--success">
              <span className="toast__text">Гость заселён, R01</span>
              <button
                type="button"
                className="toast__close"
                aria-label="Закрыть уведомление"
                data-live="focus"
              >
                <Icon name="close" width={16} height={16} />
              </button>
            </div>
          </div>
        </State>
        <State name="active" note="нажатие на ×">
          <div className="toast-region toast-region--static">
            <div className="toast toast--success">
              <span className="toast__text">Гость заселён, R01</span>
              <button
                type="button"
                className="toast__close"
                aria-label="Закрыть уведомление"
                data-live="active"
              >
                <Icon name="close" width={16} height={16} />
              </button>
            </div>
          </div>
        </State>
        <State name="disabled" note="у уведомления нет отключённого состояния">
          <span className="hint">—</span>
        </State>
        <State name="loading" note="действие ещё идёт — уведомления нет, текст на кнопке">
          <span className="hint">—</span>
        </State>
        <State name="error" note="без таймера, закрывается рукой">
          <div className="toast-region toast-region--static">
            <div className="toast toast--danger" role="status">
              <span className="toast__text">
                Ответ сервера не получен. Обновите данные и проверьте результат.
              </span>
              <button type="button" className="toast__close" aria-label="Закрыть уведомление">
                <Icon name="close" width={16} height={16} />
              </button>
            </div>
          </div>
        </State>
        <State name="selected" note="успех">
          <div className="toast-region toast-region--static">
            <div className="toast toast--success" role="status">
              <span className="toast__text">Остаток отправлен в Channex</span>
              <button type="button" className="toast__close" aria-label="Закрыть уведомление">
                <Icon name="close" width={16} height={16} />
              </button>
            </div>
          </div>
        </State>
      </Component>

      <Component
        id="tooltip"
        title="Подсказка"
        where="tooltip.tsx · Tooltip; наведение и фокус, Escape закрывает"
        interactive
      >
        <State name="default" note="закрытая">
          <TooltipDemo />
        </State>
        <State name="hover" note="наведите">
          <span className="hint">см. выше</span>
        </State>
        <State name="focus" note="Tab">
          <span className="hint">см. выше</span>
        </State>
        <State name="active" note="открытая, статично">
          <span className="tooltip-host kit-tooltip-open">
            <Button type="button" tone="secondary">
              Оплачено каналом
            </Button>
            <span className="tooltip tooltip--top is-open" role="presentation">
              Предоплата 24 000 ₸ пришла из Booking.com 12 сент.
            </span>
          </span>
        </State>
        <State name="disabled" note="подсказка у отключённой кнопки объясняет, почему">
          <Tooltip text="Заселение без гражданства не пройдёт">
            <span tabIndex={0} className="kit-disabled-host">
              <Button type="button" disabled>
                Заселить
              </Button>
            </span>
          </Tooltip>
        </State>
        <State name="loading" note="нет">
          <span className="hint">—</span>
        </State>
        <State name="error" note="нет: ошибка — не подсказка, а alert">
          <span className="hint">—</span>
        </State>
        <State name="selected" note="снизу">
          <span className="tooltip-host kit-tooltip-open">
            <span className="badge badge--warn">нет гражданства</span>
            <span className="tooltip tooltip--bottom is-open" role="presentation">
              Поле обязательно с 12.09
            </span>
          </span>
        </State>
      </Component>

      <Component
        id="legend"
        title="Легенда шахматки"
        where="ui.tsx · Legend; цветные квадраты + слово (глифы добавит срез 7.1)"
      >
        <State name="default">
          <Legend
            items={[
              { color: 'var(--st-confirmed)', label: 'подтверждена' },
              { color: 'var(--st-checked-in)', label: 'заселён' },
              { color: 'var(--st-checked-out)', label: 'выселен' },
              { color: 'var(--st-tentative)', label: 'предварительная' },
              { color: 'var(--st-blocked)', label: 'блокировка' },
            ]}
          />
        </State>
      </Component>
    </>
  );
}

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Page
      title="Дизайн-система"
      subtitle="Компоненты стойки в восьми состояниях, светлая и тёмная тема. Правила — DESIGN.md. Только при разработке."
      width="full"
    >
      <div className="kit-themes">
        <div className="kit-theme" data-theme="light" data-testid="kit-light">
          <h2 className="kit-theme__title">Светлая тема</h2>
          <Kit />
        </div>
        <div className="kit-theme" data-theme="dark" data-testid="kit-dark">
          <h2 className="kit-theme__title">Тёмная тема</h2>
          <Kit />
        </div>
      </div>
    </Page>
  );
}

export { STATES };
