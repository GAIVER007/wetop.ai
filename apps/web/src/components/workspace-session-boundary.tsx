'use client';

import { usePathname, useRouter } from 'next/navigation';
import { startTransition, useEffect, useRef, type ReactNode } from 'react';
import { LoadingState } from './ui';

/**
 * Revalidates the protected server layout after each pathname transition.
 * The mounted subtree stays in place so the refreshed RSC payload can preserve client state and scroll.
 */
export function WorkspaceSessionBoundary({
  children,
  identity,
  serverPath,
}: {
  children: ReactNode;
  identity: { userId: string; organizationId: string };
  serverPath: string;
}) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const initialIdentity = useRef(identity);
  const identityChanged =
    initialIdentity.current.userId !== identity.userId ||
    initialIdentity.current.organizationId !== identity.organizationId;
  const checking = pathname !== serverPath || identityChanged;

  useEffect(() => {
    if (identityChanged) {
      window.location.reload();
      return;
    }
    if (pathname === serverPath) return;
    startTransition(() => router.refresh());
  }, [identityChanged, pathname, router, serverPath]);

  return (
    <>
      {checking && <LoadingState label="Проверяем сессию…" />}
      <div className="workspace-session-boundary" hidden={checking} inert={checking}>
        {children}
      </div>
    </>
  );
}
