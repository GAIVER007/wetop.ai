'use client';
import { MEMBERSHIP_ROLES, type InviteRole } from '@pms/domain';
import { Select } from '../../components/ui';
import type { AuthAccessStructure } from '../../lib/api';
import type { ScopeModel } from './scope-model';

/**
 * Редактор области доступа (DATA_MODEL §31.1, Q-286, Q-287). Две формы:
 * - `fixedRole`: приглашение, одна должность на всё: отмечаются филиалы и бизнесы целиком (флажки);
 * - иначе: правка сотрудника, у каждого места своя роль (списки «нет доступа», «администратор», «управляющий»).
 * Радио «Вся организация» снимает ограничение. Защита только в API: здесь лишь собираем выбор.
 */
export function ScopeEditor({
  structure,
  roles,
  restricted,
  onRestricted,
  model,
  onModel,
  fixedRole,
}: {
  structure: AuthAccessStructure;
  roles: readonly InviteRole[];
  restricted: boolean;
  onRestricted: (value: boolean) => void;
  model: ScopeModel;
  onModel: (next: ScopeModel) => void;
  fixedRole?: InviteRole | undefined;
}) {
  const set = (key: string, role: InviteRole | '') => onModel({ ...model, [key]: role });
  const capital = (r: InviteRole) =>
    MEMBERSHIP_ROLES[r].charAt(0).toLocaleUpperCase('ru') + MEMBERSHIP_ROLES[r].slice(1);
  const place = (key: string, label: string, aria: string) =>
    fixedRole ? (
      <label className="team-scope__row" key={key}>
        <input
          type="checkbox"
          checked={!!model[key]}
          onChange={(e) => set(key, e.target.checked ? fixedRole : '')}
        />
        {label}
      </label>
    ) : (
      <div className="team-scope__row" key={key}>
        <span>{label}</span>
        <Select
          aria-label={aria}
          value={model[key] ?? ''}
          onChange={(e) => set(key, e.target.value as InviteRole | '')}
        >
          <option value="">Нет доступа</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {capital(r)}
            </option>
          ))}
        </Select>
      </div>
    );
  return (
    <fieldset className="team-scope" data-testid="scope-editor">
      <legend>Доступ</legend>
      <label className="team-scope__row">
        <input
          type="radio"
          name="scope-mode"
          checked={!restricted}
          onChange={() => onRestricted(false)}
        />
        Вся организация
      </label>
      <label className="team-scope__row">
        <input
          type="radio"
          name="scope-mode"
          checked={restricted}
          onChange={() => onRestricted(true)}
        />
        Выбранные филиалы
      </label>
      {restricted && (
        <div className="team-scope__tree">
          {structure.businesses.map((b) => (
            <fieldset key={b.id} className="team-scope__business">
              <legend>{b.name}</legend>
              {place(`b:${b.id}`, `Весь бизнес: ${b.name}`, `Весь бизнес ${b.name}: роль`)}
              {!model[`b:${b.id}`] &&
                b.locations.map((l) => place(`l:${l.id}`, l.name, `${l.name}: роль`))}
            </fieldset>
          ))}
          <p className="muted">
            Управлять командой, ролями и общим журналом можно только без ограничения по филиалам.
          </p>
        </div>
      )}
    </fieldset>
  );
}
