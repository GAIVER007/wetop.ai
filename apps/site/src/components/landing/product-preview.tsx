import Image from 'next/image';
import styles from './hero-preview.module.css';

type Vertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
const previews = {
  HOSPITALITY: '/design-only/hospitality.svg',
  BEAUTY: '/design-only/beauty.svg',
  FOOD_SERVICE: '/design-only/restaurant.svg',
} as const;
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
    </div>
  );
}
