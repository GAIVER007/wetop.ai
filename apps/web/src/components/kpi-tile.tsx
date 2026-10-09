import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Delta } from '../lib/dashboard-format';
import { Icon, type IconName } from './icon';
import { cx } from './ui';

/**
 * Плитка показателя хаба «Продажи» (макет владельца 09.10.2026): значок и подпись сверху, крупное число с цветным
 * изменением рядом, поясняющая строка внизу. Плитка-ссылка целиком. Неизвестное число это знак пропуска и причина в
 * поясняющей строке, а изменение рисуется только при настоящем сравнении. Цвет изменения всегда сопровождён знаком
 * и словами («+6 п.п.»), цветом одним смысл не передаётся.
 */
export function KpiTile({
  icon,
  label,
  value,
  delta,
  caption,
  href,
  testId,
}: {
  icon: IconName;
  label: ReactNode;
  value: ReactNode;
  delta?: Delta | undefined;
  caption?: ReactNode;
  href?: string | undefined;
  testId?: string | undefined;
}) {
  const body = (
    <>
      <span className="kpi-tile__head">
        <span className="kpi-tile__icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
        <span className="kpi-tile__label">{label}</span>
      </span>
      <span className="kpi-tile__row">
        <span className="kpi-tile__value" data-testid={testId}>
          {value}
        </span>
        {delta && delta.direction && (
          <span className="kpi-tile__delta" data-direction={delta.direction}>
            {delta.text}
          </span>
        )}
      </span>
      {caption && <span className="kpi-tile__caption">{caption}</span>}
    </>
  );
  return href ? (
    <Link href={href} prefetch={false} className={cx('kpi-tile', 'kpi-tile--link')}>
      {body}
    </Link>
  ) : (
    <div className="kpi-tile">{body}</div>
  );
}
