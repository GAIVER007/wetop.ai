import 'reflect-metadata';
import { Controller, Get, Inject } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Access } from '../../apps/api/src/auth/access.decorator';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';

const providerEnvironment =
  /^(?:OPENAI|ANTHROPIC|GEMINI|GOOGLE|AZURE|COHERE|MISTRAL|TOGETHER|HUGGINGFACE|HF|AWS|S3|CLOUDFLARE|VERCEL|RESEND|SENDGRID|SMTP|MAIL|TELEGRAM|WHATSAPP|CHANNEX|ASSISTANT|SELLER|GUARD|MARKET_COLLECT|SITES_RUNTIME|SERVICE_API|SITE_GENERATION|OTEL|SENTRY|TRACE|WIDGET_IDENTITY)_/;
const credentialEnvironment = /(?:_API_KEY|_ACCESS_KEY|_ACCESS_TOKEN|_SECRET|_PASSWORD|_TOKEN)$/;
delete process.env.PII_STORAGE;
for (const key of Object.keys(process.env))
  if (providerEnvironment.test(key) || credentialEnvironment.test(key)) delete process.env[key];

function requireLoopbackDatabase(name: 'DATABASE_URL' | 'DATABASE_APP_URL') {
  const value = process.env[name];
  if (!value) throw new Error(`UI-FIX-01 runtime requires ${name}`);
  const host = new URL(value).hostname.replace(/^\[|\]$/g, '');
  if (!['127.0.0.1', 'localhost', '::1'].includes(host))
    throw new Error(`UI-FIX-01 runtime requires loopback ${name}`);
}

requireLoopbackDatabase('DATABASE_URL');
requireLoopbackDatabase('DATABASE_APP_URL');
if (process.env.DATABASE_SCHEMA !== 'pms_test')
  throw new Error('UI-FIX-01 runtime requires DATABASE_SCHEMA=pms_test');

process.env.AUTH_REQUIRED = '1';
process.env.PII_STORAGE = 'real';
process.env.SESSION_SECRET = 'ui-fix-01-local-session-secret-2026';
process.env.CHANNEX_PULL = 'off';
process.env.CHANNEX_OUTBOX_WORKER = 'off';
process.env.CHANNEX_FULL_SYNC = 'off';
process.env.CHANNEX_WEBHOOK_HEALTH = 'off';
process.env.GUARD = 'off';
process.env.GUARD_AUTOFIX = 'off';
process.env.SELLER_SYNC = 'off';
process.env.SITE_GENERATION_WORKER = 'off';
const panelUrl = `http://127.0.0.1:${process.env.UI_FIX_01_KB_PORT ?? '8324'}/ui-fix-01-panel`;
process.env.SELLER_URL = panelUrl;
process.env.SELLER_SERVICE_KEY = 'ui-fix-01-local-service-key';
process.env.ASSISTANT_PANEL_URL = panelUrl;
process.env.ASSISTANT_SERVICE_KEY = 'ui-fix-01-local-service-key';

@Access('self')
@Controller('__ui-fix-01')
class RuntimeRoleController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('runtime-role')
  async runtimeRole() {
    const [row] = await this.prisma.db.$queryRaw<
      Array<{ role: string; organizationId: string | null }>
    >`SELECT current_user AS role, current_setting('app.org_id', true) AS "organizationId"`;
    return row;
  }
}

const port = Number(process.env.UI_FIX_01_API_PORT ?? 4324);
if (!Number.isInteger(port) || port < 1024 || port > 65_535)
  throw new Error('UI_FIX_01_API_PORT is invalid');

const [{ AppModule }, { useApiBodyParsers }, { apiSecurityHeaders }, { mail }] = await Promise.all([
  import('../../apps/api/src/app.module'),
  import('../../apps/api/src/body-parsers'),
  import('../../apps/api/src/security-headers'),
  import('@pms/integrations'),
]);
const sender = new mail.StubMailSender();
const moduleRef = await Test.createTestingModule({
  imports: [AppModule],
  controllers: [RuntimeRoleController],
  providers: [PrismaService],
})
  .overrideProvider('MAIL_SENDER')
  .useValue(sender)
  .overrideProvider('MAIL_CONFIG_PRESENT')
  .useValue(true)
  .overrideProvider('APP_URL')
  .useValue(`http://127.0.0.1:${process.env.UI_FIX_01_WEB_PORT ?? '3124'}`)
  .compile();

const app = moduleRef.createNestApplication({ logger: ['error', 'warn'], bodyParser: false });
useApiBodyParsers(app);
app.getHttpAdapter().getInstance().disable('x-powered-by');
app.use(apiSecurityHeaders);
await app.listen(port, '127.0.0.1');

const stop = async () => {
  await app.close();
  process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
