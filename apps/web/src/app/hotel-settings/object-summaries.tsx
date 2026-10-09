import Link from 'next/link';
import { amenityLabel, type withCardDefaults } from './card-model';
import { Icon } from '../../components/icon';
import { Badge, Panel } from '../../components/ui';

type Card = ReturnType<typeof withCardDefaults>;

function Facts({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="settings-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * «Продажи и каналы» (верстка владельца, ADR-156): готовность карточки объекта для сайта и каналов продаж и переходы к
 * настройке каналов. Ничего не отправляет в Channex: это сводка по сведениям, которые уже есть в стойке.
 */
export function SalesSummary({ property: p }: { property: Card }) {
  const rows: Array<[string, boolean, string]> = [
    ['Краткое описание', !!p.description, p.description ? 'Заполнено' : 'Не заполнено'],
    ['Адрес и город', !!p.address && !!p.city, p.address && p.city ? 'Заполнено' : 'Не заполнено'],
    ['Телефон и почта', !!p.phone && !!p.email, p.phone && p.email ? 'Заполнено' : 'Не заполнено'],
    ['Сайт', !!p.website, p.website ? 'Заполнено' : 'Не заполнено'],
    [
      'Удобства',
      p.amenities.length > 0,
      p.amenities.length > 0
        ? `${p.amenities.length}: ${p.amenities.slice(0, 3).map(amenityLabel).join(', ')}${p.amenities.length > 3 ? '…' : ''}`
        : 'Не выбраны',
    ],
    ['Тип размещения', !!p.channexPropertyType, p.channexPropertyType ? 'Выбран' : 'Не выбран'],
  ];
  return (
    <div className="obj-grid obj-grid--two" data-testid="sales-summary">
      <div className="obj-col">
        <Panel className="settings-block obj-card" aria-labelledby="sales-ready">
          <header className="obj-card__head">
            <span className="obj-card__icon" aria-hidden="true">
              <Icon name="channels" width={20} height={20} />
            </span>
            <div>
              <h2 id="sales-ready">Что видят гости и каналы продаж</h2>
              <p className="obj-card__sub">
                Сведения объекта, которые попадают на сайт и в каналы. Правятся на вкладке «Основное».
              </p>
            </div>
          </header>
          <ul className="obj-checklist">
            {rows.map(([label, ok, text]) => (
              <li key={label}>
                <span>{label}</span>
                <Badge tone={ok ? 'ok' : 'warn'}>{text}</Badge>
              </li>
            ))}
          </ul>
          <Link className="btn btn--secondary" href="/hotel-settings">
            Открыть «Основное»
          </Link>
        </Panel>
      </div>
      <div className="obj-col">
        <Panel className="settings-block obj-card" aria-labelledby="sales-links">
          <header className="obj-card__head">
            <span className="obj-card__icon" aria-hidden="true">
              <Icon name="external" width={20} height={20} />
            </span>
            <div>
              <h2 id="sales-links">Где настраиваются продажи</h2>
              <p className="obj-card__sub">Каналы, подключения и сайт объекта живут в своих разделах.</p>
            </div>
          </header>
          <ul className="obj-links">
            <li>
              <Link href="/channels">Каналы продаж</Link>
              <span>Каналы, сопоставление категорий и тарифов, события.</span>
            </li>
            <li>
              <Link href="/connections">Подключения</Link>
              <span>Менеджер каналов и его состояние.</span>
            </li>
            <li>
              <Link href="/marketing">Маркетинг и сайт</Link>
              <span>Сайт объекта, бронирование с сайта и аналитика.</span>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/**
 * «Документы» (верстка владельца, ADR-156): как объект выглядит в договоре и счёте гостя. Реквизиты те же, что на
 * вкладке «Основное»; здесь только чтение и переход к правке.
 */
export function DocumentsSummary({ property: p, owner }: { property: Card; owner: boolean }) {
  return (
    <div className="obj-grid obj-grid--two" data-testid="documents-summary">
      <div className="obj-col">
        <Panel className="settings-block obj-card" aria-labelledby="docs-party">
          <header className="obj-card__head">
            <span className="obj-card__icon" aria-hidden="true">
              <Icon name="file" width={20} height={20} />
            </span>
            <div>
              <h2 id="docs-party">Реквизиты в договоре и счёте</h2>
              <p className="obj-card__sub">Так объект подписан в печатных формах для гостя.</p>
            </div>
          </header>
          <Facts
            rows={[
              ['Исполнитель', p.publicName || p.name],
              ['Юридическое лицо', p.legalName],
              ...(owner ? [['ИИН/БИН', p.bin] as [string, string | null | undefined]] : []),
              ['Адрес', p.address],
              ['Телефон', p.phone],
              ['Почта', p.email],
              ['Заезд и выезд', `с ${p.checkInTime} до ${p.checkOutTime}`],
            ]}
          />
          <Link className="btn btn--secondary" href="/hotel-settings">
            Изменить реквизиты
          </Link>
        </Panel>
      </div>
      <div className="obj-col">
        <Panel className="settings-block obj-card" aria-labelledby="docs-forms">
          <header className="obj-card__head">
            <span className="obj-card__icon" aria-hidden="true">
              <Icon name="receipt" width={20} height={20} />
            </span>
            <div>
              <h2 id="docs-forms">Печатные формы</h2>
              <p className="obj-card__sub">Договор и счёт гостя на русском и казахском.</p>
            </div>
          </header>
          <p className="settings-note">
            Печатаются из карточки брони. Банк, расчётный счёт и подписант пока в формах стоят
            прочерком: они не хранятся в настройках объекта.
          </p>
          <Link className="btn btn--secondary" href="/reservations">
            Открыть брони
          </Link>
        </Panel>
      </div>
    </div>
  );
}
