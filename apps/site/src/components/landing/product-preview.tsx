import Image from 'next/image';
import styles from './hero-preview.module.css';

type Vertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
const previews = {
  HOSPITALITY: '/design-only/hospitality.svg',
  BEAUTY: '/design-only/beauty.svg',
  FOOD_SERVICE: '/design-only/restaurant.svg',
} as const;
const sources = [
  ['Booking.com', 'Бронь 014'],
  ['Trip.com', 'Бронь 021'],
  ['Agoda', 'Бронь 025'],
  ['Стойка', 'Бронь 029'],
] as const;

export function ProductPreview({ vertical, label }: { vertical: Vertical; label: string }) {
  return (
    <div className={styles.preview}>
      <Image
        className={styles.image}
        src={previews[vertical]}
        alt={label}
        width={720}
        height={540}
        loading="eager"
        unoptimized
      />
      {vertical === 'HOSPITALITY' && (
        <div className={styles.sources}>
          <p className={styles.sourceHeading}>Источники бронирований</p>
          <ul className={styles.sourceList}>
            {sources.map(([source, booking]) => (
              <li key={source}>
                <strong>{source}</strong>
                <span>{booking}</span>
              </li>
            ))}
          </ul>
          <p className={styles.example}>Пример на вымышленных данных</p>
        </div>
      )}
    </div>
  );
}
