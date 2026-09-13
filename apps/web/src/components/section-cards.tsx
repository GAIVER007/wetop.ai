import Link from 'next/link';
import type { NavigationItem } from '../lib/navigation';
import { Icon, type IconName } from './icon';
import { Badge } from './ui';

export function SectionCards({ items }: { items: NavigationItem[] }) {
  return (
    <div className="section-cards">
      {items.map((item) => (
        <Link href={item.href} key={item.href} className="section-card">
          <span className="section-card-icon">
            <Icon name={item.icon} />
          </span>
          <div>
            <div className="section-card-title">{item.label}</div>
            {item.pending && <Badge>Ещё не подключено</Badge>}
          </div>
          <Icon name="arrow" className="section-card-arrow" />
        </Link>
      ))}
    </div>
  );
}
export function FeaturePending({ icon, text }: { icon: IconName; text: string }) {
  return (
    <section className="feature-pending">
      <span className="section-card-icon">
        <Icon name={icon} />
      </span>
      <Badge>Ещё не подключено</Badge>
      <p>{text}</p>
    </section>
  );
}
