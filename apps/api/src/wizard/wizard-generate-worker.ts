import 'reflect-metadata';
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { sellerConfigFromEnv } from '../ai-seller/seller.connection';

type GenerateResult = {
  status: string;
  prompt?: string;
  knowledge?: Array<{ title: string; content: string }>;
  errorCode?: string;
};
const object = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};

@Injectable()
export class WizardGenerateWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick().catch(() => undefined), 2000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(send: (body: unknown) => Promise<GenerateResult> = this.send): Promise<void> {
    if (
      this.running ||
      process.env.WIZARD_ENABLED !== '1' ||
      process.env.WIZARD_GENERATE_ENABLED !== '1'
    )
      return;
    this.running = true;
    try {
      const job = await this.prisma.db.$transaction(async (tx) => {
        // Reclaim a stopped worker; the bot keeps the same request ID and never repeats an uncertain paid call.
        await tx.wizardJob.updateMany({
          where: {
            kind: 'generate',
            state: 'running',
            updatedAt: { lt: new Date(Date.now() - 120000) },
            attempt: { gte: 3 },
          },
          data: {
            state: 'failed',
            maskedError: 'Не удалось собрать помощника. Проверьте данные и повторите сборку',
          },
        });
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT j.id FROM wizard_jobs j JOIN wizard_drafts d ON d.id = j.draft_id
          JOIN wizard_sessions s ON s.id = d.guest_session_id
          WHERE j.kind = 'generate' AND s.expires_at > now() AND d.agent_id IS NULL
          AND (j.state = 'queued' OR (j.state = 'running' AND j.updated_at < now() - interval '2 minutes' AND j.attempt < 3))
          ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1`;
        if (!rows[0]) return null;
        return tx.wizardJob.update({
          where: { id: rows[0].id },
          data: { state: 'running', attempt: { increment: 1 } },
          include: { draft: true },
        });
      });
      if (!job) return;
      const config = object(job.draft.config);
      if (job.revision !== job.draft.revision) {
        await this.prisma.db.wizardJob.update({ where: { id: job.id }, data: { state: 'stale' } });
        return;
      }
      let result: GenerateResult;
      try {
        const event = await this.prisma.db.wizardEvent.findUnique({
          where: { deduplicationKey: `generate:${job.id}` },
        });
        const ipHash = object(event?.payload).ipHash;
        if (!ipHash) throw new Error('missing generation context');
        result = await send({
          requestId: job.id,
          sessionId: job.draft.guestSessionId,
          ipHash,
          config: Object.fromEntries(
            [
              'businessName',
              'niche',
              'description',
              'botType',
              'assistantName',
              'goal',
              'advantages',
              'currency',
              'timezone',
            ]
              .filter((key) => config[key] !== undefined)
              .map((key) => [key, config[key]]),
          ),
        });
        if (
          result.status === 'ok' &&
          (typeof result.prompt !== 'string' ||
            result.prompt.trim().length < 10 ||
            result.prompt.length > 20000 ||
            !Array.isArray(result.knowledge) ||
            !result.knowledge.length ||
            result.knowledge.length > 8 ||
            result.knowledge.some(
              (s) =>
                !s ||
                typeof s.title !== 'string' ||
                !s.title.trim() ||
                s.title.length > 120 ||
                typeof s.content !== 'string' ||
                !s.content.trim() ||
                s.content.length > 4000,
            ))
        )
          throw new Error('bad result');
      } catch {
        result = { status: 'error' };
      }
      await this.prisma.db.$transaction(async (tx) => {
        // Lease generation and revision are both checked. A delayed process cannot commit another worker's result.
        const owned = await tx.wizardJob.updateMany({
          where: { id: job.id, state: 'running', attempt: job.attempt },
          data: {
            state: 'failed',
            maskedError: 'Не удалось собрать помощника. Проверьте данные и повторите сборку',
          },
        });
        if (!owned.count) return;
        if (result.status === 'ok' && result.prompt && result.knowledge) {
          const updated = await tx.wizardDraft.updateMany({
            where: {
              id: job.draftId,
              revision: job.revision,
              agentId: null,
              session: { expiresAt: { gt: new Date() } },
            },
            data: {
              generatedPrompt: result.prompt,
              generatedKnowledge: result.knowledge,
              generatedRevision: job.revision,
            },
          });
          await tx.wizardJob.update({
            where: { id: job.id },
            data: { state: updated.count ? 'succeeded' : 'stale', maskedError: null },
          });
        }
        await tx.wizardEvent.createMany({
          data: [
            {
              guestSessionId: job.draft.guestSessionId,
              eventType: 'generation_finished',
              deduplicationKey: `generate-finished:${job.id}`,
              payload: { status: result.status },
            },
          ],
          skipDuplicates: true,
        });
      });
    } finally {
      this.running = false;
    }
  }

  private async send(body: unknown): Promise<GenerateResult> {
    const connection = sellerConfigFromEnv();
    if (!connection.baseUrl || !connection.serviceKey) throw new Error('generation unavailable');
    const response = await fetch(new URL('/internal/wizard/generate', connection.baseUrl), {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json', 'x-service-key': connection.serviceKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(95000),
    });
    if (!response.ok) throw new Error('generation unavailable');
    const text = await response.text();
    if (text.length > 160000) throw new Error('generation result too large');
    return JSON.parse(text) as GenerateResult;
  }
}
