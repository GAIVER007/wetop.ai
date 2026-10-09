import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  Bed,
  Building2,
  CalendarDays,
  Check,
  FileText,
  Globe,
  KeyRound,
  LayoutGrid,
  Mail,
  MapPin,
  Monitor,
  Phone,
  Receipt,
  Scissors,
  Share2,
  Shield,
  Sparkles,
  Tag,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

/*
 * Иконки сайта: Lucide (решение владельца 09.10.2026, LAND2): линейные 24×24, цвет currentColor,
 * штрих 1.8 как у прежнего самодельного набора. Имена свои, короткие: компоненты и словарь знают
 * `IconName`, а не названия Lucide, поэтому замена набора остаётся правкой одного файла.
 */
const icons = {
  grid: LayoutGrid,
  calendar: CalendarDays,
  guest: Users,
  channels: Share2,
  tag: Tag,
  receipt: Receipt,
  site: Monitor,
  shield: Shield,
  migrate: ArrowRightLeft,
  bed: Bed,
  building: Building2,
  scissors: Scissors,
  food: UtensilsCrossed,
  key: KeyRound,
  article: FileText,
  location: MapPin,
  globe: Globe,
  spark: Sparkles,
  mail: Mail,
  phone: Phone,
  chart: BarChart3,
  check: Check,
  arrowRight: ArrowRight,
  arrowDown: ArrowDown,
  arrowLeft: ArrowLeft,
};

export type IconName = keyof typeof icons;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const Glyph = icons[name];
  return <Glyph className="icon" size={size} strokeWidth={1.8} aria-hidden focusable="false" />;
}
