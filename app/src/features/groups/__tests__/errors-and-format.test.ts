import { ApiError, NetworkError } from '@/api/client';
import { describeGroupError } from '@/features/groups/errors';
import { groupSummaryLine, memberCount, people, roundLine } from '@/features/groups/format';

import { crewSummary, roundByBob } from './fixtures/groups';

describe('describeGroupError', () => {
  it('explains an expired session', () => {
    expect(describeGroupError(new ApiError(401, ''))).toMatch(/session has expired/);
  });

  it('explains a group you can no longer see', () => {
    expect(describeGroupError(new ApiError(404, ''))).toMatch(/no longer exists/);
  });

  it.each([403, 409])('shows the server title for %i', (status) => {
    const body = JSON.stringify({ title: 'You can only add your friends to a group.' });

    expect(describeGroupError(new ApiError(status, body))).toBe(
      'You can only add your friends to a group.',
    );
  });

  it('falls back when the body has no usable title', () => {
    expect(describeGroupError(new ApiError(409, 'not json'))).toMatch(/didn’t work/);
    expect(describeGroupError(new ApiError(403, '{}'))).toMatch(/didn’t work/);
    expect(describeGroupError(new ApiError(403, 'null'))).toMatch(/didn’t work/);
  });

  it('uses the general messages otherwise', () => {
    expect(describeGroupError(new NetworkError('offline'))).toMatch(/Can't reach LinkUp/);
    expect(describeGroupError(new ApiError(500, ''))).toMatch(/went wrong on our side/);
  });
});

describe('group formatting', () => {
  it('counts people and members', () => {
    expect(people(1)).toBe('1 person');
    expect(people(4)).toBe('4 people');
    expect(memberCount(1)).toBe('1 member');
    expect(memberCount(3)).toBe('3 members');
  });

  it('summarises a group, saying when you own it', () => {
    expect(groupSummaryLine(crewSummary)).toBe('2 members · You own it');
    expect(groupSummaryLine({ ...crewSummary, myRole: 'member', memberCount: 1 })).toBe('1 member');
  });

  it('says who generated a round, when and for how many', () => {
    expect(roundLine(roundByBob, 'u1')).toMatch(/^By Bob · Wed 18 Nov, \d\d:\d\d · for 2 people$/);
    expect(roundLine(roundByBob, 'u2')).toMatch(/^By you · /);
    expect(roundLine({ ...roundByBob, createdBy: null, groupSize: 1 }, 'u1')).toMatch(
      /^By a former member · .* · for 1 person$/,
    );
  });
});
