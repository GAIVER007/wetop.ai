/** Opt-in audit: production repositories and shared Supabase, no provider publication. */
import 'reflect-metadata';
import { config } from 'dotenv';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../apps/api/src/app.module';
import { ARI_PUBLISHER, NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';

if (process.env.WETOP_LIVE_AUDIT !== '1') throw new Error('Explicit live audit opt-in required');
config({ path: '.env', quiet: true });
process.env.NODE_ENV = 'test';
// ADR-072: вне Казахстана стойка имя, контакты и документы не хранит. Аудит проверяет именно их правку, а гости у
// него только вымышленные (ADR-010, метка прогона) — поэтому этот стенд пишет введённое как есть. Настоящих гостей
// на 4320 никто не вводит: стенд живёт, пока идёт прогон, и слушает только 127.0.0.1.
process.env.PII_STORAGE = 'real';
for (const flag of [
  'CHANNEX_PULL',
  'CHANNEX_OUTBOX_WORKER',
  'CHANNEX_FULL_SYNC',
  'CHANNEX_WEBHOOK_HEALTH',
  'GUARD',
  'GUARD_AUTOFIX',
])
  process.env[flag] = 'off';
// Do not even supply external credentials to this test process after loading DATABASE_URL.
for (const key of Object.keys(process.env)) {
  if (/^(CHANNEX|EXELY|EQONAQ|FISCAL|TELEGRAM|GUARD_HEARTBEAT)_/.test(key)) delete process.env[key];
}
const module = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(ARI_PUBLISHER)
  .useClass(NoopAriPublisher)
  .compile();
const app = module.createNestApplication({ logger: false });
// No operator can accidentally use provider/guard commands on the audit instance.
app.use(
  (
    req: { path: string },
    res: { status: (n: number) => { end: () => void } },
    next: () => void,
  ) => {
    if (/^\/(channels|guard|webhooks|booking|collect)(\/|$)/.test(req.path)) {
      res.status(403).end();
    } else next();
  },
);
await app.listen(4320, '127.0.0.1');
console.log('Live audit API ready; external providers disabled');
const close = () => void app.close().then(() => process.exit(0));
process.on('SIGTERM', close);
process.on('SIGINT', close);
