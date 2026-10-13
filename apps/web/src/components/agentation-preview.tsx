'use client';
import { Agentation } from 'agentation';
import { usePathname } from 'next/navigation';
/** Manual annotations in an explicitly synthetic development preview. */
export function AgentationPreview({ enabled }: { enabled: boolean }) {
  const path = usePathname();
  return enabled && path === '/branches' ? <Agentation /> : null;
}
