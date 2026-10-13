import type { Prisma } from '@pms/database';

export type ChatContext = {
  requestId: string;
  sessionId: string;
  ipHash: string;
  prompt: string;
  knowledge: Prisma.JsonValue;
  botType: string;
  history: Array<{ role: string; content: string }>;
  text: string;
};
export type ChatPayload = {
  requestId: string;
  revision: number;
  ipHash: string;
  textHash: string;
  state: string;
  attempt: number;
  leaseUntil: number;
  usage?: { complete: boolean; input?: number; output?: number; paidCalls?: number };
  context?: ChatContext;
  sources?: string[];
};
// Payloads are created by the server only. No client may submit events of this type.
export const chatPayload = (value: Prisma.JsonValue) => value as unknown as ChatPayload;
export const chatJson = (value: ChatPayload) => value as unknown as Prisma.InputJsonObject;
