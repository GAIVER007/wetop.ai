import { Icon } from '../icon';

const items = [
  { href: '#features', label: 'Система', icon: 'grid' as const },
  { href: '#sales', label: 'Продажи', icon: 'channels' as const },
  { href: '#ai-sellers', label: 'ИИ', icon: 'spark' as const },
  { href: '#start', label: 'Начать', icon: 'arrowRight' as const },
];

export function MobileHomeNav() {
  return (
    <nav className="mobile-home-nav" aria-label="Разделы главной">
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href}>
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
