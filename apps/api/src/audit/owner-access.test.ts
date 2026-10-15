import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { RoleGuard } from '../auth/role.guard';
import { AuditController } from './audit.module';

describe('журнал владельца: прямой запрос к API', () => {
  for (const role of ['OWNER', 'MANAGER', 'STAFF'] as const) {
    it(role, () => {
      const call = () =>
        new RoleGuard(new Reflector()).canActivate({
          getHandler: () => AuditController.prototype.list,
          getClass: () => AuditController,
          switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
        } as never);
      if (role === 'OWNER') expect(call()).toBe(true);
      else expect(call).toThrow(ForbiddenException);
    });
  }
});
