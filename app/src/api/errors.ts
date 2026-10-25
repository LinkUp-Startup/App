import { ApiError, NetworkError } from '@/api/client';

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

/** Flattens an ASP.NET ValidationProblemDetails body into its messages. */
export function parseValidationErrors(body: string): string[] {
  try {
    const problem = JSON.parse(body) as ValidationProblem;
    return Object.values(problem.errors ?? {}).flat();
  } catch {
    return [];
  }
}
