import {
  verticalDefinition,
  type BusinessVertical,
} from '../../../../../packages/domain/src/verticals/registry';
import { getDictionary } from '../../i18n';

/** Presentation only: canonical availability remains owned by the domain registry. */
export function VerticalStatus({ id }: { id: BusinessVertical }) {
  const { intro } = getDictionary();
  const available = verticalDefinition(id).availability === 'AVAILABLE';
  return (
    <span className={`verticals__status${available ? ' verticals__status--available' : ''}`}>
      {available ? intro.available : intro.pilot}
    </span>
  );
}
