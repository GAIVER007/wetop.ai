'use client';
import { useId } from 'react';
import {
  accessLevelInfo,
  defaultAccessLevel,
  type AccessLevel,
} from '@pms/domain';

/**
 * «Доступ в WETOP» в форме «Новый сотрудник» всех направлений (решение владельца 20.10.2026,
 * docs/decisions/2026-10-20-staff-access-levels.md): четыре уровня карточками-радиокнопками, у выбранного «увидит» и
 * «не увидит»; для уровня с входом «где работает» (только этот филиал или все). Права решает API, здесь только выбор.
 */
export interface StaffAccessDraft {
  level: AccessLevel;
  allBranches: boolean;
}

/**
 * Уровень по умолчанию: от назначения (специалист в кабинет), но вход без почты невозможен, поэтому пока почты нет,
 * «Без входа»: добавить мастера можно сразу, а кабинет включится, как только владелец впишет почту.
 */
export const staffAccessDraft = (kind: string | null | undefined, email = 'x'): StaffAccessDraft => ({
  level: email.trim() ? defaultAccessLevel(kind) : 'NONE',
  allBranches: false,
});

export function StaffAccessPicker({
  vertical,
  levels,
  value,
  onChange,
  branchName,
  canAllBranches,
  email,
  disabled = false,
  showWhere = true,
  name,
}: {
  vertical: string;
  /** уровни, которые может выдать вошедший (`accessLevelsFor`) */
  levels: readonly AccessLevel[];
  value: StaffAccessDraft;
  onChange: (next: StaffAccessDraft) => void;
  branchName: string | null;
  /** «Все филиалы» видит только владелец и сотрудник без ограничения по филиалам */
  canAllBranches: boolean;
  /** почта из формы: на неё уйдёт приглашение */
  email: string;
  disabled?: boolean;
  /** «Где работает» своим блоком; гостиница выбирает места своим редактором области (несколько филиалов) */
  showWhere?: boolean;
  /** имя поля уровня в форме (иначе своё на каждый экземпляр) */
  name?: string;
}) {
  const id = useId();
  const info = accessLevelInfo(vertical);
  const chosen = info[value.level];
  const withLogin = value.level !== 'NONE';
  return (
    <fieldset className="staff-access" data-testid="staff-access" disabled={disabled}>
      <legend className="staff-access__legend">Доступ в WETOP</legend>
      <div className="staff-access__levels" role="radiogroup" aria-label="Уровень доступа">
        {levels.map((level) => (
          <label
            key={level}
            className={`staff-access__level${value.level === level ? ' is-active' : ''}`}
            data-level={level}
          >
            <input
              type="radio"
              name={name ?? `${id}-level`}
              value={level}
              checked={value.level === level}
              onChange={() => onChange({ ...value, level })}
            />
            <span className="staff-access__title">{info[level].label}</span>
            <span className="staff-access__hint">{info[level].hint}</span>
          </label>
        ))}
      </div>
      {withLogin && (
        <div className="staff-access__details" data-testid="staff-access-details">
          <div>
            <p className="staff-access__caption">Увидит</p>
            <ul>
              {chosen.sees.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          {chosen.denies.length > 0 && (
            <div>
              <p className="staff-access__caption">Не увидит</p>
              <ul className="staff-access__denies">
                {chosen.denies.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {withLogin && showWhere && (
        <div className="staff-access__where" role="radiogroup" aria-label="Где работает">
          <label>
            <input
              type="radio"
              name={`${id}-where`}
              checked={!value.allBranches}
              onChange={() => onChange({ ...value, allBranches: false })}
            />
            {branchName ? `Только филиал «${branchName}»` : 'Только этот филиал'}
          </label>
          {canAllBranches && (
            <label>
              <input
                type="radio"
                name={`${id}-where`}
                checked={value.allBranches}
                onChange={() => onChange({ ...value, allBranches: true })}
              />
              Все филиалы
            </label>
          )}
        </div>
      )}
      {withLogin && (
        <p className="staff-access__invite" data-testid="staff-access-invite">
          {email.trim()
            ? `Приглашение придёт на ${email.trim()}. После принятия вход сам привяжется к этому сотруднику.`
            : 'Укажите почту выше: на неё придёт приглашение для входа.'}
        </p>
      )}
    </fieldset>
  );
}
