import { notFound } from 'next/navigation';
import { ApiError } from './api';

/** Missing records show 404; connection failures continue to the retry boundary. Server pages only. */
export function notFoundOn404(error: unknown): never {
  if (error instanceof ApiError && error.status === 404) notFound();
  throw error;
}
