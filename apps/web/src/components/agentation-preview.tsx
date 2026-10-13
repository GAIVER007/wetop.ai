'use client';
import { Agentation } from 'agentation';
/** Manual annotations in local development only. */
export function AgentationPreview({ enabled }: { enabled: boolean }) {
  return enabled ? <Agentation /> : null;
}
