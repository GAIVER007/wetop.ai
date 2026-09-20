/**
 * Вход дизайн-системы WETOP для Claude Design.
 *
 * Зачем он есть: компоненты стойки живут внутри приложения Next (`apps/web`), а не в отдельном
 * пакете с `dist/`. Если дать конвертеру синтезировать вход из всей папки `components/`, он затянет
 * серверные части оболочки (`shell/account-menu.tsx` импортирует server action) и сборка в браузер
 * упадёт. Поэтому состав задан здесь списком — ровно рабочий набор из DESIGN.md §8.
 *
 * Что НЕ входит и почему: `Sidebar`, `TopNav`, `GlobalSearch`, `DataFreshness`, `RouteDrawer`,
 * `RefreshButton`, `AccountMenu` — каркас конкретного приложения, завязан на роутер Next и на меню
 * WETOP; макет рисует свою навигацию.
 *
 * Правка этого файла — правка состава дизайн-системы. Новый компонент сначала описывается
 * строкой в DESIGN.md §8 (ADR-048), потом попадает сюда.
 */

// --- Примитивы: кнопки, поля, панели, таблицы, статусы, состояния (ui.tsx) ---
export {
  cx,
  Help,
  Button,
  Input,
  Select,
  Textarea,
  Field,
  Panel,
  PanelTitle,
  SectionTitle,
  Stats,
  Stat,
  Fact,
  Table,
  Badge,
  StatusBadge,
  Alert,
  Notice,
  Row,
  Stack,
  Grid,
  Legend,
  EmptyState,
  Skeleton,
  LoadingState,
} from '../../apps/web/src/components/ui';
export type { ButtonTone, BadgeTone } from '../../apps/web/src/components/ui';

// --- Иконки (DESIGN.md §7) ---
export { Icon, iconNames } from '../../apps/web/src/components/icon';
export type { IconName } from '../../apps/web/src/components/icon';

// --- Каркас экрана и разделы ---
export { Page } from '../../apps/web/src/components/page';
export { SectionCards, FeaturePending } from '../../apps/web/src/components/section-cards';
export { RecordTabs } from '../../apps/web/src/components/record-tabs';

// --- Деньги ---
export { AmountChip } from '../../apps/web/src/components/amount-chip';
export type { AmountTone } from '../../apps/web/src/components/amount-chip';

// --- Слои: окна, меню, подсказки, уведомления ---
export { Overlay } from '../../apps/web/src/components/overlay';
export { ConfirmDialog } from '../../apps/web/src/components/confirm-dialog';
export { useConfirm } from '../../apps/web/src/components/use-confirm';
export { ActionMenu } from '../../apps/web/src/components/action-menu';
export type { ActionMenuItem } from '../../apps/web/src/components/action-menu';
export { Tooltip } from '../../apps/web/src/components/tooltip';
export { ToastRegion, ToastProvider, useToast } from '../../apps/web/src/components/toast';
export type { ToastTone, ToastInput } from '../../apps/web/src/components/toast';

// --- Сбой загрузки ---
export { ErrorState } from '../../apps/web/src/components/error-state';
export { LoadError } from '../../apps/web/src/components/load-error';

// --- Тема (светлая / тёмная) ---
export { ThemeProvider, useTheme } from '../../apps/web/src/components/theme-provider';
export type { Theme } from '../../apps/web/src/components/theme-provider';
