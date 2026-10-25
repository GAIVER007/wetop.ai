'use client';
import Link from 'next/link';
import { amenityLabel, type withCardDefaults } from './card-model';
import { Icon } from '../../components/icon';
import { Badge, Panel } from '../../components/ui';
import { formatPhone } from '../../lib/phone';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

type Card = ReturnType<typeof withCardDefaults>;

function Facts({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  const t = useT();
  return (
    <dl className="settings-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{t(label)}</dt>
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
  const t = useT();
  const filled = (ok: boolean) => (ok ? t('Заполнено') : t('Не заполнено'));
  const rows: Array<[string, boolean, string]> = [
    [msg('Краткое описание'), !!p.description, filled(!!p.description)],
    [msg('Адрес и город'), !!p.address && !!p.city, filled(!!p.address && !!p.city)],
    [msg('Телефон и почта'), !!p.phone && !!p.email, filled(!!p.phone && !!p.email)],
    [msg('Сайт'), !!p.website, filled(!!p.website)],
    [
      msg('Удобства'),
      p.amenities.length > 0,
      p.amenities.length > 0
        ? `${p.amenities.length}: ${p.amenities.slice(0, 3).map((a) => t(amenityLabel(a))).join(', ')}${p.amenities.length > 3 ? '…' : ''}`
        : t('Не выбраны'),
    ],
    [msg('Тип размещения'), !!p.channexPropertyType, p.channexPropertyType ? t('Выбран') : t('Не выбран')],
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
              <h2 id="sales-ready">{t('Что видят гости и каналы продаж')}</h2>
              <p className="obj-card__sub">
                {t('Сведения объекта, которые попадают на сайт и в каналы. Правятся на вкладке «Основное».')}
              </p>
            </div>
          </header>
          <ul className="obj-checklist">
            {rows.map(([label, ok, text]) => (
              <li key={label}>
                <span>{t(label)}</span>
                <Badge tone={ok ? 'ok' : 'warn'}>{text}</Badge>
              </li>
            ))}
          </ul>
          <Link className="btn btn--secondary" href="/hotel-settings">
            {t('Открыть «Основное»')}
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
              <h2 id="sales-links">{t('Где настраиваются продажи')}</h2>
              <p className="obj-card__sub">{t('Каналы, подключения и сайт объекта живут в своих разделах.')}</p>
            </div>
          </header>
          <ul className="obj-links">
            <li>
              <Link href="/channels">{t('Каналы продаж')}</Link>
              <span>{t('Каналы, сопоставление категорий и тарифов, события.')}</span>
            </li>
            <li>
              <Link href="/connections">{t('Подключения')}</Link>
              <span>{t('Менеджер каналов и его состояние.')}</span>
            </li>
            <li>
              <Link href="/marketing">{t('Маркетинг и сайт')}</Link>
              <span>{t('Сайт объекта, бронирование с сайта и аналитика.')}</span>
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
  const t = useT();
  return (
    <div className="obj-grid obj-grid--two" data-testid="documents-summary">
      <div className="obj-col">
        <Panel className="settings-block obj-card" aria-labelledby="docs-party">
          <header className="obj-card__head">
            <span className="obj-card__icon" aria-hidden="true">
              <Icon name="file" width={20} height={20} />
            </span>
            <div>
              <h2 id="docs-party">{t('Реквизиты в договоре и счёте')}</h2>
              <p className="obj-card__sub">{t('Так объект подписан в печатных формах для гостя.')}</p>
            </div>
          </header>
          <Facts
            rows={[
              [msg('Исполнитель'), p.publicName || p.name],
              [msg('Юридическое лицо'), p.legalName],
              ...(owner ? [[msg('ИИН/БИН'), p.bin] as [string, string | null | undefined]] : []),
              [msg('Адрес'), p.address],
              [msg('Телефон'), p.phone ? formatPhone(p.phone) : p.phone],
              [msg('Почта'), p.email],
              [msg('Заезд и выезд'), t('с {from} до {to}', { from: p.checkInTime, to: p.checkOutTime })],
            ]}
          />
          <Link className="btn btn--secondary" href="/hotel-settings">
            {t('Изменить реквизиты')}
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
              <h2 id="docs-forms">{t('Печатные формы')}</h2>
              <p className="obj-card__sub">{t('Договор и счёт гостя на русском и казахском.')}</p>
            </div>
          </header>
          <p className="settings-note">
            {t('Печатаются из карточки брони. Банк, расчётный счёт и подписант пока в формах стоят прочерком: они не хранятся в настройках объекта.')}
          </p>
          <Link className="btn btn--secondary" href="/reservations">
            {t('Открыть брони')}
          </Link>
        </Panel>
      </div>
    </div>
  );
}
