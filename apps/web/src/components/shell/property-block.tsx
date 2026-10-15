'use client';
import { use, type ReactNode } from 'react';
import type { DeskShell } from '../../lib/desk-person';
import { Icon } from '../icon';
import { BranchSwitcher } from './branch-switcher';

/** Server-rendered text slots keep late metadata independent of the interactive shell. */
export interface PropertyIdentity {
  name: ReactNode;
  address: ReactNode;
}

/** Authenticated users select an accessible branch in place. API enforces membership scope. */
export function GrantedProperty({
  desk,
  ...props
}: {
  desk: Promise<DeskShell> | undefined;
  property?: PropertyIdentity | null | undefined;
  close: (() => void) | undefined;
  path: string;
}) {
  const shell = desk ? use(desk) : null;
  const settings = Boolean(shell?.person);
  return <PropertyBlock {...props} settings={settings} />;
}

/** Объект и филиал: в шапке рядом со знаком (ADR-134) и вверху меню телефона; вошедшему открыт переключатель филиала */
export function PropertyBlock({
  property,
  settings,
  close,
  path = '/today',
}: {
  property?: PropertyIdentity | null | undefined;
  settings: boolean;
  path?: string;
  close: (() => void) | undefined;
}) {
  const identity = (
    <>
      <span className="property-mark">
        <Icon name="inventory" />
      </span>
      <div>
        <strong>{property?.name ?? 'Объект не загружен'}</strong>
        <span>{property?.address ?? 'Настройки объекта'}</span>
      </div>
    </>
  );
  return settings ? (
    <BranchSwitcher path={path} close={close}>
      {identity}
    </BranchSwitcher>
  ) : (
    <div className="workspace-property">{identity}</div>
  );
}
