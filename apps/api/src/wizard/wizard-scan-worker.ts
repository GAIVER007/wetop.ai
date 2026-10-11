import 'reflect-metadata';
import { wizardUsage } from './wizard-usage';
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { sellerConfigFromEnv } from '../ai-seller/seller.connection';
import { wizardConfig } from './wizard-input';

type ScanResult = {
  status: string;
  usage?: unknown;
  fields?: {
    businessName: string;
    niche: string;
    description: string;
    faq: Array<{ question: string; answer: string }>;
  };
  errorCode?: string;
};
const object = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};

@Injectable()
export class WizardScanWorker implements OnModuleInit, OnModuleDestroy {
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

  async tick(send: (body: unknown) => Promise<ScanResult> = this.send): Promise<void> {
    if (
      this.running ||
      process.env.WIZARD_ENABLED !== '1' ||
      process.env.WIZARD_SCAN_ENABLED !== '1'
    )
      return;
    this.running = true;
    try {
      const job = await this.prisma.db.$transaction(async (tx) => {
        // Reclaim a stopped worker; the bot keeps the same request ID and never repeats an uncertain paid call.
        await tx.wizardJob.updateMany({
          where: {
            kind: 'scan',
            state: 'running',
            updatedAt: { lt: new Date(Date.now() - 120000) },
            attempt: { gte: 3 },
          },
          data: {
            state: 'failed',
            maskedError: 'Не удалось прочитать сайт. Заполните данные вручную',
          },
        });
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT j.id FROM wizard_jobs j JOIN wizard_drafts d ON d.id = j.draft_id
          JOIN wizard_sessions s ON s.id = d.guest_session_id
          WHERE j.kind = 'scan' AND s.expires_at > now() AND d.agent_id IS NULL
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
      let result: ScanResult;
      try {
        const event = await this.prisma.db.wizardEvent.findUnique({
          where: { deduplicationKey: `scan:${job.id}` },
        });
        const ipHash = object(event?.payload).ipHash;
        if (!ipHash) throw new Error('missing scan context');
        result = await send({
          requestId: job.id,
          sessionId: job.draft.guestSessionId,
          ipHash,
          url: config.siteUrl,
        });
        if (result.status === 'ok') {
          const f = result.fields;
          if (
            !f ||
            !Array.isArray(f.faq) ||
            f.faq.length > 8 ||
            f.faq.some(
              (a) =>
                typeof a.question !== 'string' ||
                a.question.length > 300 ||
                typeof a.answer !== 'string' ||
                a.answer.length > 2000,
            )
          )
            throw new Error('bad result');
          wizardConfig({
            businessName: f.businessName,
            niche: f.niche,
            description: f.description,
          });
        }
      } catch {
        result = { status: 'error' };
      }
      await this.prisma.db.$transaction(async (tx) => {
        // Lease generation and revision are both checked. A delayed process cannot commit another worker's result.
        const owned = await tx.wizardJob.updateMany({
          where: { id: job.id, state: 'running', attempt: job.attempt },
          data: {
            state: 'failed',
            maskedError: 'Не удалось прочитать сайт. Заполните данные вручную',
          },
        });
        if (!owned.count) return;
        if (result.status === 'ok' && result.fields) {
          const { businessName, niche, description, faq } = result.fields;
          const fields = { businessName, niche, description };
          const foundFields = Object.entries(fields)
            .filter(([, v]) => v.trim())
            .map(([k]) => k)
            .join(',');
          const updated = await tx.wizardDraft.updateMany({
            where: {
              id: job.draftId,
              revision: job.revision,
              agentId: null,
              session: { expiresAt: { gt: new Date() } },
            },
            data: {
              ...fields,
              config: { ...config, ...fields, foundFields },
              sources: [{ kind: 'site', url: config.siteUrl, faq }],
              revision: { increment: 1 },
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
              eventType: 'scan_finished',
              deduplicationKey: `scan-finished:${job.id}`,
              payload: { status: result.status, usage: wizardUsage(result.usage) },
            },
          ],
          skipDuplicates: true,
        });
      });
    } finally {
      this.running = false;
    }
  }

  private async send(body: unknown): Promise<ScanResult> {
    const connection = sellerConfigFromEnv();
    if (!connection.baseUrl || !connection.serviceKey) throw new Error('scan unavailable');
    const response = await fetch(new URL('/internal/wizard/scan', connection.baseUrl), {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json', 'x-service-key': connection.serviceKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(95000),
    });
    if (!response.ok) throw new Error('scan unavailable');
    const text = await response.text();
    if (text.length > 50000) throw new Error('scan result too large');
    return JSON.parse(text) as ScanResult;
  }
}
