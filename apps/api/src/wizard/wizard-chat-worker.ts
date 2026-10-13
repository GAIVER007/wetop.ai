import 'reflect-metadata';
import { wizardUsage } from './wizard-usage';
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { sellerConfigFromEnv } from '../ai-seller/seller.connection';
import { chatJson, chatPayload, type ChatContext } from './wizard-chat-state';

export type ChatResult = { status: string; usage?: unknown; answer?: string; sources?: string[] };
@Injectable()
export class WizardChatWorker implements OnModuleInit, OnModuleDestroy {
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
  async tick(send: (body: ChatContext) => Promise<ChatResult> = this.send) {
    if (
      this.running ||
      process.env.WIZARD_ENABLED !== '1' ||
      process.env.WIZARD_CHAT_ENABLED !== '1'
    )
      return;
    this.running = true;
    try {
      const lease = await this.prisma.db.$transaction(async (tx) => {
        const now = Date.now();
        // One oldest unfinished request per draft. Draft lock serializes enqueue, edit and dispatch.
        const rows = await tx.$queryRaw<Array<{ id: string; draftId: string }>>`
          SELECT e.id, d.id AS "draftId" FROM wizard_events e
          JOIN wizard_drafts d ON d.guest_session_id = e.guest_session_id
          WHERE e.event_type = 'chat_requested' AND e.payload->>'state' IN ('queued','running')
            AND (e.payload->>'leaseUntil')::bigint <= ${now}
            AND NOT EXISTS (SELECT 1 FROM wizard_events earlier
              WHERE earlier.guest_session_id = e.guest_session_id AND earlier.event_type = 'chat_requested'
                AND earlier.payload->>'state' IN ('queued','running')
                AND (earlier.created_at, earlier.id) < (e.created_at, e.id))
          ORDER BY e.created_at, e.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED`;
        const row = rows[0];
        if (!row) return null;
        const event = await tx.wizardEvent.findUniqueOrThrow({ where: { id: row.id } });
        const payload = chatPayload(event.payload);
        const draft = await tx.wizardDraft.findUniqueOrThrow({
          where: { id: row.draftId },
          include: { session: true },
        });
        const user = await tx.wizardMessage.findUniqueOrThrow({
          where: {
            draftId_requestId_role: {
              draftId: draft.id,
              requestId: payload.requestId,
              role: 'user',
            },
          },
        });
        if (!payload.context) {
          const done = await tx.wizardEvent.findMany({
            where: {
              guestSessionId: event.guestSessionId,
              eventType: 'chat_requested',
              payload: { path: ['revision'], equals: payload.revision },
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          });
          const ids = done
            .filter((e) => chatPayload(e.payload).state === 'succeeded')
            .map((e) => chatPayload(e.payload).requestId);
          const history = await tx.wizardMessage.findMany({
            where: { draftId: draft.id, requestId: { in: ids }, state: 'succeeded' },
            orderBy: { createdAt: 'asc' },
            take: 8,
          });
          const config = draft.config as Record<string, string>;
          payload.context = {
            requestId: payload.requestId,
            sessionId: event.guestSessionId,
            ipHash: payload.ipHash,
            prompt: draft.generatedPrompt ?? '',
            knowledge: draft.generatedKnowledge,
            botType: config.botType ?? 'sales',
            history: ids.flatMap((id) =>
              ['user', 'assistant'].flatMap((role) =>
                history
                  .filter((m) => m.requestId === id && m.role === role)
                  .map((m) => ({ role: m.role, content: m.text })),
              ),
            ),
            text: user.text,
          };
        }
        const exhausted = payload.attempt >= 3;
        payload.attempt++;
        payload.state = 'running';
        payload.leaseUntil = now + 120000;
        await tx.wizardEvent.update({
          where: { id: event.id },
          data: { payload: chatJson(payload) },
        });
        await tx.wizardMessage.update({ where: { id: user.id }, data: { state: 'running' } });
        return { event, payload, draft, exhausted };
      });
      if (!lease) return;
      let result: ChatResult = { status: 'error' };
      const { event, payload, draft } = lease;
      if (
        !lease.exhausted &&
        draft.revision === payload.revision &&
        draft.generatedRevision === payload.revision &&
        !draft.agentId &&
        draft.session.expiresAt > new Date() &&
        payload.context
      ) {
        try {
          result = await send(payload.context);
          if (
            result.status === 'ok' &&
            (typeof result.answer !== 'string' ||
              !result.answer.trim() ||
              result.answer.length > 4000 ||
              !Array.isArray(result.sources) ||
              result.sources.length > 3 ||
              result.sources.some((s) => typeof s !== 'string' || s.length > 120))
          )
            result = { status: 'error' };
        } catch {
          result = { status: 'error' };
        }
      }
      await this.prisma.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM wizard_drafts WHERE id = ${draft.id}::uuid FOR UPDATE`;
        const current = chatPayload(
          (await tx.wizardEvent.findUniqueOrThrow({ where: { id: event.id } })).payload,
        );
        if (current.state !== 'running' || current.attempt !== payload.attempt) return;
        const fresh = await tx.wizardDraft.findUniqueOrThrow({
          where: { id: draft.id },
          include: { session: true },
        });
        const stale =
          fresh.revision !== payload.revision ||
          fresh.generatedRevision !== payload.revision ||
          !!fresh.agentId ||
          fresh.session.expiresAt <= new Date();
        const success = !stale && result.status === 'ok';
        current.usage = wizardUsage(result.usage);
        current.state = stale ? 'stale' : success ? 'succeeded' : 'failed';
        current.sources = success ? (result.sources ?? []) : [];
        // Once terminal, replay has no dispatch path; refund and state change are one transaction.
        await tx.wizardEvent.update({
          where: { id: event.id },
          data: { payload: chatJson(current) },
        });
        await tx.wizardMessage.updateMany({
          where: { draftId: draft.id, requestId: payload.requestId },
          data: { state: current.state },
        });
        if (success) {
          await tx.wizardMessage.create({
            data: {
              draftId: draft.id,
              requestId: payload.requestId,
              role: 'assistant',
              text: result.answer!,
              state: 'succeeded',
            },
          });
        } else {
          await tx.wizardDraft.update({
            where: { id: draft.id },
            data: { testMessagesUsed: { decrement: 1 } },
          });
        }
      });
    } finally {
      this.running = false;
    }
  }
  private async send(body: ChatContext): Promise<ChatResult> {
    const connection = sellerConfigFromEnv();
    if (!connection.baseUrl || !connection.serviceKey) throw new Error('chat unavailable');
    const response = await fetch(new URL('/internal/wizard/message', connection.baseUrl), {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json', 'x-service-key': connection.serviceKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(95000),
    });
    if (!response.ok) throw new Error('chat unavailable');
    const text = await response.text();
    if (text.length > 40000) throw new Error('result too large');
    return JSON.parse(text) as ChatResult;
  }
}
