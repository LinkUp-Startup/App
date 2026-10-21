import { ApiError, NetworkError } from '@/api/client';
import { describeApiError } from '@/api/errors';

describe('describeApiError', () => {
  it('explains connection problems', () => {
    expect(describeApiError(new NetworkError('down'))).toMatch(/Can't reach LinkUp/);
  });

  it('lists validation messages from a 400 response', () => {
    const body = JSON.stringify({
      title: 'One or more validation errors occurred.',
      errors: {
        'Preferences.Activities': ['Pick at least one activity.'],
        'Preferences.GroupSize': ['The field GroupSize must be between 1 and 20.'],
      },
    });

    expect(describeApiError(new ApiError(400, body))).toBe(
      "Some preferences weren't accepted: Pick at least one activity. The field GroupSize must be between 1 and 20.",
    );
  });

  it('falls back to a generic 400 message when the body is not a validation problem', () => {
    expect(describeApiError(new ApiError(400, 'Bad request'))).toBe(
      "Some preferences weren't accepted. Check the form and try again.",
    );
    expect(describeApiError(new ApiError(400, '{}'))).toMatch(/Check the form/);
  });

  it('explains server errors', () => {
    expect(describeApiError(new ApiError(503, ''))).toMatch(/on our side/);
  });

  it('has a fallback for anything else', () => {
    expect(describeApiError(new ApiError(404, ''))).toMatch(/unexpected/);
    expect(describeApiError(new Error('boom'))).toMatch(/unexpected/);
  });
});
