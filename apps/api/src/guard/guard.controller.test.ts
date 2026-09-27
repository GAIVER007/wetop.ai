import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { accessDeniedMessage, type MembershipRole } from '@pms/domain';
import { GuardController } from './guard.controller';

/**
 * «Проверить сейчас» на экране «Неисправности» — работа смены (право `desk`), а полная сверка с Channex и починка полной
 * выгрузкой (`?all=1`) — дело каналов (ADR-104): администратору каналы закрыты. Роль берётся из `request.user`: обработчик
 * выполняется в служебном контексте `ChannelOperatorInterceptor`, и контекст запроса роли там уже не знает.
 */
function controller() {
  const tick = vi.fn(async () => ({ observed: [], resolved: 0 }));
  const guard = new GuardController({ tick } as never, {} as never, {} as never);
  return { guard, tick };
}
const as = (role: MembershipRole) => ({ user: { role } }) as never;

describe('«Проверить сейчас» и полная сверка', () => {
  it('обычную проверку запускает любая роль', async () => {
    const { guard, tick } = controller();
    await guard.tick(undefined, as('STAFF'));
    expect(tick).toHaveBeenCalledWith(expect.any(Date), { all: false });
  });

  it('полную сверку с Channex администратор не запускает; управляющий и владелец — запускают', async () => {
    const { guard, tick } = controller();
    await expect(guard.tick('1', as('STAFF'))).rejects.toThrow(ForbiddenException);
    await expect(guard.tick('1', as('STAFF'))).rejects.toThrow(accessDeniedMessage('channels'));
    expect(tick).not.toHaveBeenCalled();
    await guard.tick('1', as('MANAGER'));
    await guard.tick('true', as('OWNER'));
    expect(tick).toHaveBeenNthCalledWith(1, expect.any(Date), { all: true });
    expect(tick).toHaveBeenNthCalledWith(2, expect.any(Date), { all: true });
  });

  it('служебный ключ (без человека) — как раньше, полная сверка идёт', async () => {
    const { guard, tick } = controller();
    await guard.tick('1', {} as never);
    expect(tick).toHaveBeenCalledWith(expect.any(Date), { all: true });
  });
});
