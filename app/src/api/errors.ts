import { ApiError, NetworkError } from '@/api/client';
import type { CandidateAvailabilityProblem } from '@/types/api';

type ValidationProblem = {
  title?: string;
  errors?: Record<string, string[]>;
};

/** A message for the user explaining why an API call failed. */
export function describeApiError(error: unknown): string {
  if (error instanceof NetworkError) {
    return "Can't reach LinkUp right now. Check your internet connection and try again.";
  }

  if (error instanceof ApiError) {
    if (error.status === 422) {
      const message = candidateAvailabilityMessage(error.message);
      if (message) return message;
    }
    if (error.status === 400) {
      const details = parseValidationErrors(error.message);
      return details.length > 0
        ? `Some preferences weren't accepted: ${details.join(' ')}`
        : "Some preferences weren't accepted. Check the form and try again.";
    }
    if (error.status >= 500) {
      return 'Something went wrong on our side. Try again in a moment.';
    }
  }

  return 'Something unexpected went wrong. Try again.';
}

/** Expected filtering outcomes use a structured problem, not a server-error message. */
function candidateAvailabilityMessage(body: string): string | undefined {
  try {
    const problem = JSON.parse(body) as Partial<CandidateAvailabilityProblem> | null;
    if (
      (problem?.code === 'no_candidates' || problem?.code === 'insufficient_candidates') &&
      typeof problem.detail === 'string' &&
      typeof problem.suggestion === 'string'
    ) {
      return `${problem.detail} ${problem.suggestion}`;
    }
  } catch {
    // A malformed or unrelated response uses the existing generic error message.
  }
  return undefined;
}

/** Flattens an ASP.NET ValidationProblemDetails body into its messages. */
export function parseValidationErrors(body: string): string[] {
  try {
    const problem = JSON.parse(body) as ValidationProblem;
    return Object.values(problem.errors ?? {}).flat();
  } catch {
    return [];
  }
}
