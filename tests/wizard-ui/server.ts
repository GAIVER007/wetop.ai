import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WizardModule } from '../../apps/api/src/wizard/wizard.module';
import { wizardStandDatabaseUrl } from '../tools/seed-local';

// Dedicated, explicit loopback database. Never inherit the hotel's DATABASE_URL.
// Порт не зашит: `db:local` поднимают и на другом порту, когда умолчание занято соседней сессией
// (09.10.2026: 55432 держал Docker). Чужой адрес по-прежнему не наследуется, петлевой пропускает
// та же проверка, что у сида.
process.env.DATABASE_URL = wizardStandDatabaseUrl();
process.env.DATABASE_SCHEMA = 'public';
process.env.WIZARD_ENABLED = '1';
process.env.WIZARD_SESSION_TTL_SECONDS = '3600';
const app = await NestFactory.create(WizardModule, { logger: false });
app
  .getHttpAdapter()
  .get('/__test/health', (_req: unknown, res: { json: (value: unknown) => void }) =>
    res.json({ ok: true }),
  );
await app.listen(Number(process.env['WIZARD_API_PORT'] ?? 4321), '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
