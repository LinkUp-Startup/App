import { ApiError } from '@/api/client';
import { describeApiError } from '@/api/errors';

/* Mirrors FriendLimits.SearchMinLength on the server */
export const FriendSearchMinLength = 2;

/* A message for the user explaining why a friends call failed */
export function describeFriendError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Log in again to add friends.';
    if (error.status === 404) return 'This user no longer exists.';
    if (error.status === 400 || error.status === 409) {
      return problemTitle(error.message) ?? 'That didn’t work. Search again and try once more.';
    }
  }
  return describeApiError(error);
}

/* The "title" of an ASP.NET ProblemDetails body */
function problemTitle(body: string): string | undefined {
  try {
    const problem = JSON.parse(body) as { title?: unknown } | null;
    return typeof problem?.title === 'string' ? problem.title : undefined;
  } catch {
    return undefined;
  }
}
