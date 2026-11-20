import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { castVote, closeVote, getGroup, getVoteResults, listGroupPlans } from '@/api/groups';
import GroupVoteScreen from '@/app/group-vote';
import { tapasPlan } from '@/features/plans/__tests__/fixtures/plans';
import type { Group, GroupPlanRound, GroupVoteResults, Plan } from '@/types/api';

const mockParams: { groupId?: string } = { groupId: 'g1' };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  // Run the focus effect once on mount, like a screen that has just been shown
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('@/api/groups');
const mockAuth = { accessToken: 'token-1' as string | null };
jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ accessToken: mockAuth.accessToken }),
}));

const tapas = tapasPlan;
const bowling: Plan = { ...tapasPlan, id: 'p2', title: 'Bowling night' };
const round: GroupPlanRound = {
  id: 'r1',
  createdAt: '2026-11-20T18:00:00Z',
  createdBy: null,
  groupSize: 3,
  plans: [tapas, bowling],
};
const member = (userId: string, displayName: string, role: 'owner' | 'member') => ({
  userId,
  displayName,
  role,
  joinedAt: '2026-11-01T10:00:00Z',
});
const groupAs = (myRole: 'owner' | 'member'): Group => ({
  id: 'g1',
  name: 'Friday crew',
  createdAt: '2026-11-01T10:00:00Z',
  myRole,
  members: [
    member('u1', 'Ann', 'owner'),
    member('u2', 'Bob', 'member'),
    member('u3', 'Carla', 'member'),
  ],
});
const results = (over: Partial<GroupVoteResults> = {}): GroupVoteResults => ({
  roundId: 'r1',
  closedAt: null,
  memberCount: 3,
  votesCast: 0,
  myVotePlanId: null,
  plans: [
    { planId: 'p1', votes: 0 },
    { planId: 'p2', votes: 0 },
  ],
  winnerPlanIds: [],
  ...over,
});

function show(myRole: 'owner' | 'member' = 'member', current: GroupVoteResults = results()) {
  jest.mocked(getGroup).mockResolvedValue(groupAs(myRole));
  jest.mocked(listGroupPlans).mockResolvedValue({ rounds: [round] });
  jest.mocked(getVoteResults).mockResolvedValue(current);
}

const vote = (title: string) => ({ name: `Vote for ${title}` });

afterEach(() => {
  jest.resetAllMocks();
  mockAuth.accessToken = 'token-1';
  mockParams.groupId = 'g1';
});

describe('GroupVoteScreen', () => {
  it('asks to log in without an account', async () => {
    mockAuth.accessToken = null;
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);

    expect(screen.getByText(/Log in to vote/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Log in' }));
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(getGroup).not.toHaveBeenCalled();
  });

  it('sends you to your groups when no group is open', async () => {
    mockParams.groupId = undefined;
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);

    await user.press(screen.getByRole('button', { name: 'Go to your groups' }));

    expect(router.replace).toHaveBeenCalledWith('/groups');
  });

  it('says so, and lets you try again, when the plans cannot be loaded', async () => {
    jest.mocked(getGroup).mockResolvedValue(groupAs('member'));
    jest.mocked(listGroupPlans).mockRejectedValueOnce(new ApiError(404, ''));
    jest.mocked(listGroupPlans).mockResolvedValue({ rounds: [round] });
    jest.mocked(getVoteResults).mockResolvedValue(results());
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);

    expect(await screen.findByText(/no longer exists/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Tapas and drinks')).toBeOnTheScreen();
    expect(screen.queryByText(/no longer exists/)).toBeNull();
  });

  it('offers to plan a night when the group has no plans yet', async () => {
    jest.mocked(getGroup).mockResolvedValue(groupAs('member'));
    jest.mocked(listGroupPlans).mockResolvedValue({ rounds: [] });
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);

    expect(await screen.findByText(/No plans to vote on yet/)).toBeOnTheScreen();
    expect(getVoteResults).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Plan a night together' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/group-plan',
      params: { groupId: 'g1', groupSize: '3' },
    });
  });

  it('shows the plans of the newest round with their votes and how many members voted', async () => {
    show(
      'member',
      results({
        votesCast: 2,
        myVotePlanId: 'p1',
        plans: [
          { planId: 'p1', votes: 1 },
          { planId: 'p2', votes: 1 },
        ],
      }),
    );
    await render(<GroupVoteScreen />);

    expect(await screen.findByText('Tapas and drinks')).toBeOnTheScreen();
    expect(screen.getByText('Bowling night')).toBeOnTheScreen();
    expect(screen.getByText('2 of 3 voted')).toBeOnTheScreen();
    expect(screen.getAllByText('1 vote')).toHaveLength(2);
    expect(listGroupPlans).toHaveBeenCalledWith('token-1', 'g1', expect.any(AbortSignal));
    expect(getVoteResults).toHaveBeenCalledWith('token-1', 'g1', 'r1', expect.any(AbortSignal));
  });

  it('shows which plan you voted for and leaves you to change it', async () => {
    show(
      'member',
      results({
        votesCast: 1,
        myVotePlanId: 'p1',
        plans: [
          { planId: 'p1', votes: 1 },
          { planId: 'p2', votes: 0 },
        ],
      }),
    );
    await render(<GroupVoteScreen />);

    expect(await screen.findByText('Your vote')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'You voted for Tapas and drinks' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change my vote to Bowling night' })).toBeEnabled();
    expect(screen.getByText('0 votes')).toBeOnTheScreen();
  });

  it('casts a vote and shows the new count and your vote', async () => {
    show();
    jest.mocked(castVote).mockResolvedValue(
      results({
        votesCast: 1,
        myVotePlanId: 'p2',
        plans: [
          { planId: 'p1', votes: 0 },
          { planId: 'p2', votes: 1 },
        ],
      }),
    );
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);

    await user.press(await screen.findByRole('button', vote('Bowling night')));

    expect(castVote).toHaveBeenCalledWith('token-1', 'g1', 'r1', 'p2');
    expect(await screen.findByText('1 of 3 voted')).toBeOnTheScreen();
    expect(screen.getByText('Your vote')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'You voted for Bowling night' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Change my vote to Tapas and drinks' }),
    ).toBeEnabled();
  });

  it('keeps the vote buttons from being pressed again while a vote is on its way', async () => {
    show();
    let finish!: (value: GroupVoteResults) => void;
    jest.mocked(castVote).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);

    await user.press(await screen.findByRole('button', vote('Bowling night')));

    expect(screen.getByRole('button', vote('Tapas and drinks'))).toBeDisabled();
    expect(screen.getByRole('button', vote('Bowling night'))).toBeDisabled();
    finish(results({ votesCast: 1, myVotePlanId: 'p2' }));
    // Voted: the other plan's button now changes the vote, and works again
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Change my vote to Tapas and drinks' }),
      ).toBeEnabled(),
    );
  });

  it('shows why a vote did not work, and shows the closed vote when it was closed meanwhile', async () => {
    jest.mocked(getGroup).mockResolvedValue(groupAs('member'));
    jest.mocked(listGroupPlans).mockResolvedValue({ rounds: [round] });
    jest
      .mocked(getVoteResults)
      .mockResolvedValueOnce(results())
      .mockResolvedValueOnce(results({ closedAt: '2026-11-20T21:00:00Z' }));
    jest
      .mocked(castVote)
      .mockRejectedValue(new ApiError(409, JSON.stringify({ title: 'The vote is closed.' })));
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);

    await user.press(await screen.findByRole('button', vote('Bowling night')));

    expect(await screen.findByText('The vote is closed.')).toBeOnTheScreen();
    expect(await screen.findByText('Voting is closed')).toBeOnTheScreen();
    expect(screen.queryByRole('button', vote('Bowling night'))).toBeNull();
  });

  it('shows a failed vote and keeps the buttons usable', async () => {
    show();
    jest.mocked(castVote).mockRejectedValue(new ApiError(401, ''));
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);

    await user.press(await screen.findByRole('button', vote('Bowling night')));

    expect(await screen.findByText(/session has expired/)).toBeOnTheScreen();
    expect(screen.getByRole('button', vote('Bowling night'))).toBeEnabled();
  });

  it('shows a closed vote with the votes and no way to vote', async () => {
    show(
      'owner',
      results({
        closedAt: '2026-11-20T21:00:00Z',
        votesCast: 3,
        myVotePlanId: 'p1',
        plans: [
          { planId: 'p1', votes: 2 },
          { planId: 'p2', votes: 1 },
        ],
      }),
    );
    await render(<GroupVoteScreen />);

    expect(await screen.findByText('Voting is closed')).toBeOnTheScreen();
    expect(screen.getByText('Closed')).toBeOnTheScreen();
    expect(screen.getByText('2 votes')).toBeOnTheScreen();
    expect(screen.getByText('Your vote')).toBeOnTheScreen();
    expect(screen.queryByRole('button', vote('Bowling night'))).toBeNull();
    expect(screen.queryByRole('button', { name: /You voted for/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close the vote' })).toBeNull();
  });

  it('only lets the owner close the vote', async () => {
    show('member');
    await render(<GroupVoteScreen />);

    await screen.findByText('Tapas and drinks');

    expect(screen.queryByRole('button', { name: 'Close the vote' })).toBeNull();
  });

  it('lets the owner close the vote after confirming', async () => {
    show('owner');
    jest.mocked(closeVote).mockResolvedValue(results({ closedAt: '2026-11-20T21:00:00Z' }));
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);

    await user.press(await screen.findByRole('button', { name: 'Close the vote' }));
    expect(screen.getByText('Close the vote for everyone?')).toBeOnTheScreen();
    expect(closeVote).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Yes, close the vote' }));

    expect(closeVote).toHaveBeenCalledWith('token-1', 'g1', 'r1');
    expect(await screen.findByText('Voting is closed')).toBeOnTheScreen();
    expect(screen.queryByText('Close the vote for everyone?')).toBeNull();
  });

  it('lets the owner change their mind about closing', async () => {
    show('owner');
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);

    await user.press(await screen.findByRole('button', { name: 'Close the vote' }));
    await user.press(screen.getByRole('button', { name: 'Keep voting open' }));

    expect(closeVote).not.toHaveBeenCalled();
    expect(screen.queryByText('Close the vote for everyone?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Close the vote' })).toBeOnTheScreen();
  });

  it('shows why closing failed', async () => {
    show('owner');
    jest
      .mocked(closeVote)
      .mockRejectedValue(
        new ApiError(403, JSON.stringify({ title: "Only the group's owner can close the vote." })),
      );
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);

    await user.press(await screen.findByRole('button', { name: 'Close the vote' }));
    await user.press(screen.getByRole('button', { name: 'Yes, close the vote' }));

    expect(await screen.findByText("Only the group's owner can close the vote.")).toBeOnTheScreen();
  });

  describe('the outcome', () => {
    const closedAt = '2026-11-20T21:00:00Z';
    const votes = (p1: number, p2: number) => [
      { planId: 'p1', votes: p1 },
      { planId: 'p2', votes: p2 },
    ];

    it('shows no outcome while the vote is open and members are still to vote', async () => {
      show('member', results({ votesCast: 1, plans: votes(1, 0) }));
      await render(<GroupVoteScreen />);

      await screen.findByText('Tapas and drinks');

      expect(screen.queryByText(/Winner/)).toBeNull();
      expect(screen.queryByText("It's a tie")).toBeNull();
      expect(screen.queryByText('Leading')).toBeNull();
    });

    it('shows the leading plan once everyone has voted, while the owner can still close the vote', async () => {
      show(
        'owner',
        results({ votesCast: 3, plans: votes(2, 1), winnerPlanIds: ['p1'], myVotePlanId: 'p1' }),
      );
      await render(<GroupVoteScreen />);

      expect(await screen.findByText('Winner: Tapas and drinks')).toBeOnTheScreen();
      expect(screen.getByText(/Everyone has voted and it leads with 2 votes/)).toBeOnTheScreen();
      expect(screen.getByText(/Until then, votes can change/)).toBeOnTheScreen();
      expect(screen.getByText('Leading')).toBeOnTheScreen();
      // Still open: votes can be changed and the vote closed
      expect(screen.getByRole('button', { name: 'Change my vote to Bowling night' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Close the vote' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Plan another night' })).toBeNull();
    });

    it('shows the winner of a closed vote as final', async () => {
      show(
        'member',
        results({ closedAt, votesCast: 2, plans: votes(0, 2), winnerPlanIds: ['p2'] }),
      );
      await render(<GroupVoteScreen />);

      expect(await screen.findByText('Winner: Bowling night')).toBeOnTheScreen();
      expect(screen.getByText('The group chose it with 2 votes.')).toBeOnTheScreen();
      expect(screen.getByText('Winner')).toBeOnTheScreen();
      expect(screen.queryByText('Leading')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Plan another night' })).toBeNull();
    });

    it('explains a tie that is still open and how to break it', async () => {
      show('member', results({ votesCast: 2, plans: votes(1, 1), winnerPlanIds: ['p1', 'p2'] }));
      await render(<GroupVoteScreen />);

      expect(await screen.findByText("It's a tie")).toBeOnTheScreen();
      expect(
        screen.getByText(
          /Tapas and drinks and Bowling night each have 1 vote\. Change a vote to break the tie/,
        ),
      ).toBeOnTheScreen();
      expect(screen.getAllByText('Tied for first')).toHaveLength(2);
      expect(screen.queryByRole('button', { name: 'Plan another night' })).toBeNull();
    });

    it('explains a closed tie and offers another night', async () => {
      show(
        'member',
        results({ closedAt, votesCast: 2, plans: votes(1, 1), winnerPlanIds: ['p1', 'p2'] }),
      );
      const user = userEvent.setup();
      await render(<GroupVoteScreen />);

      expect(await screen.findByText("It's a tie")).toBeOnTheScreen();
      expect(
        screen.getByText(/There is no deciding vote, so it's up to the group/),
      ).toBeOnTheScreen();
      expect(screen.getAllByText('Tied for first')).toHaveLength(2);
      await user.press(screen.getByRole('button', { name: 'Plan another night' }));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/group-plan',
        params: { groupId: 'g1', groupSize: '3' },
      });
    });

    it('says when a vote was closed before anyone voted', async () => {
      show('owner', results({ closedAt }));
      await render(<GroupVoteScreen />);

      expect(await screen.findByText('No winner')).toBeOnTheScreen();
      expect(screen.getByText('The vote was closed before anyone voted.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Plan another night' })).toBeOnTheScreen();
    });

    it('shows the outcome as soon as the last vote or the closing comes in', async () => {
      show('owner', results({ votesCast: 2, plans: votes(1, 1) }));
      jest
        .mocked(castVote)
        .mockResolvedValue(
          results({ votesCast: 3, plans: votes(2, 1), winnerPlanIds: ['p1'], myVotePlanId: 'p1' }),
        );
      jest
        .mocked(closeVote)
        .mockResolvedValue(
          results({ closedAt, votesCast: 3, plans: votes(2, 1), winnerPlanIds: ['p1'] }),
        );
      const user = userEvent.setup();
      await render(<GroupVoteScreen />);
      await screen.findByText('Tapas and drinks');
      expect(screen.queryByText('Winner: Tapas and drinks')).toBeNull();

      await user.press(screen.getByRole('button', vote('Tapas and drinks')));
      expect(await screen.findByText('Winner: Tapas and drinks')).toBeOnTheScreen();
      expect(screen.getByText('Leading')).toBeOnTheScreen();

      await user.press(screen.getByRole('button', { name: 'Close the vote' }));
      await user.press(screen.getByRole('button', { name: 'Yes, close the vote' }));
      expect(await screen.findByText('The group chose it with 2 votes.')).toBeOnTheScreen();
      expect(screen.getByText('Winner')).toBeOnTheScreen();
    });
  });

  it('counts a plan the results do not list as having no votes', async () => {
    show(
      'member',
      results({ votesCast: 1, myVotePlanId: 'p1', plans: [{ planId: 'p1', votes: 1 }] }),
    );
    await render(<GroupVoteScreen />);

    await screen.findByText('Tapas and drinks');

    expect(screen.getByText('1 vote')).toBeOnTheScreen();
    expect(screen.getByText('0 votes')).toBeOnTheScreen();
  });

  it('cancels loading when you leave the screen, and ignores a failure that comes late', async () => {
    let fail!: (error: unknown) => void;
    jest.mocked(getGroup).mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    jest.mocked(listGroupRounds).mockResolvedValue({ rounds: [round] });
    const view = await render(<GroupVoteScreen />);
    const signal = jest.mocked(getGroup).mock.calls[0][2];
    expect(signal?.aborted).toBe(false);

    await view.unmount();

    expect(signal?.aborted).toBe(true);
    fail(new ApiError(500, ''));
    // Nothing is left to show it on, and the late failure must not throw
    await Promise.resolve();
    expect(getVoteResults).not.toHaveBeenCalled();
  });

  it('refreshes the results on request', async () => {
    jest.mocked(getGroup).mockResolvedValue(groupAs('member'));
    jest.mocked(listGroupPlans).mockResolvedValue({ rounds: [round] });
    jest
      .mocked(getVoteResults)
      .mockResolvedValueOnce(results())
      .mockResolvedValueOnce(
        results({
          votesCast: 2,
          plans: [
            { planId: 'p1', votes: 2 },
            { planId: 'p2', votes: 0 },
          ],
        }),
      );
    const user = userEvent.setup();
    await render(<GroupVoteScreen />);
    expect(await screen.findByText('0 of 3 voted')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Refresh the results' }));

    expect(await screen.findByText('2 of 3 voted')).toBeOnTheScreen();
    expect(screen.getByText('2 votes')).toBeOnTheScreen();
  });
});
