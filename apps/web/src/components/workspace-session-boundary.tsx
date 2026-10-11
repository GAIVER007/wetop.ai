'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { LoadingState } from './ui';

/**
 * Revalidates the protected server layout after each pathname transition.
 * The mounted subtree stays in place so the refreshed RSC payload can preserve client state and scroll.
 *
 * A pathname counts as verified once a refresh started for it has settled: the layout re-ran `currentMe()`
 * and either rendered (session valid, identity compared below) or left for login. Comparing the pathname with
 * the server path is not enough: an intercepted route (`@drawer/(.)reservations/...` over `/chessboard`) is
 * refreshed for the underlying page, so the two legitimately differ and a strict equality refreshed forever.
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
  const [verified, setVerified] = useState(serverPath);
  const requested = useRef<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const checking = (pathname !== verified && pathname !== serverPath) || identityChanged;

  useEffect(() => {
    if (identityChanged) {
      window.location.reload();
      return;
    }
    if (pathname === verified) return;
    if (pathname === serverPath) {
      setVerified(pathname);
      return;
    }
    if (requested.current !== pathname) {
      requested.current = pathname;
      startRefresh(() => router.refresh());
      return;
    }
    if (!refreshing) setVerified(pathname);
  }, [identityChanged, pathname, refreshing, router, serverPath, verified]);

  return (
    <>
      {checking && <LoadingState label="Проверяем сессию…" />}
      <div className="workspace-session-boundary" hidden={checking} inert={checking}>
        {children}
      </div>
    </>
  );
}
