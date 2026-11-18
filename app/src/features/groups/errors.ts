import { ApiError } from '@/api/client';
import { describeApiError } from '@/api/errors';

/* Mirrors GroupLimits.NameMaxLength on the server */
export const GroupNameMaxLength = 60;

/* A message for the user explaining why a groups call failed */
export function describeGroupError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Log in again to use groups.';
    if (error.status === 404) return 'This group no longer exists, or you are no longer a member.';
    if (error.status === 403 || error.status === 409) {
      return problemTitle(error.message) ?? 'That didn’t work. Refresh and try again.';
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
