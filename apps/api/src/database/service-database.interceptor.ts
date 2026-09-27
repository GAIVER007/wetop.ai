import 'reflect-metadata';
import { CallHandler, Injectable, type NestInterceptor } from '@nestjs/common';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { withServiceDatabase } from '../auth/request-context';

/**
 * Раздел «Платформа» (ADR-083) читает все организации — служебной ролью базы (RLS, DATA_MODEL §17, ADR-103). Права
 * проверяет сам контроллер (`requirePlatformAdmin`): интерцептор меняет только роль базы, а не то, кого пускают.
 */
@Injectable()
export class ServiceDatabaseInterceptor implements NestInterceptor {
  async intercept(_context: unknown, next: CallHandler): Promise<Observable<unknown>> {
    const value = await withServiceDatabase(() => lastValueFrom(next.handle(), { defaultValue: undefined }));
    return from([value]);
  }
}
