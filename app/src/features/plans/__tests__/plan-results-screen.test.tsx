import { render, screen, userEvent } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError, NetworkError } from '@/api/client';
import { generatePlans } from '@/api/plans';
import PlanResultsScreen from '@/app/plans';
import { getSavedPlans, savePlan } from '@/storage/saved-plans';
import type { NightPreferences, Plan } from '@/types/api';

import { tapasPlan } from './fixtures/plans';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@/api/plans', () => ({ generatePlans: jest.fn() }));

const generatePlansMock = jest.mocked(generatePlans);

const preferences: NightPreferences = {
  budgetPerPerson: 30,
  groupSize: 4,
  activities: ['dinner'],
  startTime: '2026-10-30T19:00:00.000Z',
  endTime: '2026-10-30T23:00:00.000Z',
  maxDistanceKm: 3,
  transport: ['walking'],
};

const plan: Plan = {
  id: 'p1',
  title: 'Tapas and drinks',
  summary: 'Dinner in the old town, then a cocktail bar.',
  items: [],
  estimatedCostPerPerson: 27.4,
  estimatedTotalCost: 109.6,
  totalDistanceKm: 1.25,
};

function withParams(params: { preferences?: string }) {
  const defined: Record<string, string> = {};
  if (params.preferences !== undefined) defined.preferences = params.preferences;
  jest.mocked(useLocalSearchParams).mockReturnValue(defined);
}

afterEach(() => jest.clearAllMocks());

describe('PlanResultsScreen', () => {
  it('sends the submitted preferences and shows a loading state', async () => {
    withParams({ preferences: JSON.stringify(preferences) });
    generatePlansMock.mockReturnValue(new Promise(() => {}));
    await render(<PlanResultsScreen />);

    expect(screen.getByText('Putting your night together…')).toBeOnTheScreen();
    expect(generatePlansMock).toHaveBeenCalledWith(preferences, expect.any(AbortSignal));
  });

  it('shows the generated plans', async () => {
    withParams({ preferences: JSON.stringify(preferences) });
    generatePlansMock.mockResolvedValue({ plans: [plan, { ...plan, id: 'p2', items: [] }] });
    await render(<PlanResultsScreen />);

    expect(await screen.findAllByText('Tapas and drinks')).toHaveLength(2);
    expect(screen.getAllByText('0 stops · estimated €27.40 per person · 1.3 km')).toHaveLength(2);
    expect(screen.getAllByText('Estimated total for the group: €109.60')).toHaveLength(2);
  });

  it('shows each generated plan with its own venue prices and backend total', async () => {
    withParams({ preferences: JSON.stringify(preferences) });
    generatePlansMock.mockResolvedValue({
      plans: [
        tapasPlan,
        {
          ...tapasPlan,
          id: 'different',
          title: 'A free night',
          estimatedCostPerPerson: 0,
          estimatedTotalCost: 0,
          items: [{ ...tapasPlan.items[0], estimatedCostPerPerson: 0 }],
        },
      ],
    });
    await render(<PlanResultsScreen />);
    expect(await screen.findByText('Estimated total for the group: €102.00')).toBeOnTheScreen();
    expect(screen.getByText('Estimated total for the group: €0.00')).toBeOnTheScreen();
    expect(screen.getByText('Estimated €20.00 per person')).toBeOnTheScreen();
    expect(
      screen.getByText('Estimated €5.50 per person · 910 m from the previous stop'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Estimated €0.00 per person')).toBeOnTheScreen();
  });

  it('explains when no plans match', async () => {
    withParams({ preferences: JSON.stringify(preferences) });
    generatePlansMock.mockResolvedValue({ plans: [] });
    await render(<PlanResultsScreen />);

    expect(await screen.findByText(/No plans match these preferences/)).toBeOnTheScreen();
  });

  it('shows an error and retries', async () => {
    withParams({ preferences: JSON.stringify(preferences) });
    generatePlansMock
      .mockRejectedValueOnce(new NetworkError('down'))
      .mockResolvedValueOnce({ plans: [plan] });
    const user = userEvent.setup();
    await render(<PlanResultsScreen />);

    expect(await screen.findByText("Couldn't generate plans")).toBeOnTheScreen();
    expect(screen.getByText(/Can't reach LinkUp/)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Tapas and drinks')).toBeOnTheScreen();
    expect(generatePlansMock).toHaveBeenCalledTimes(2);
  });

  it('shows validation errors returned by the API', async () => {
    withParams({ preferences: JSON.stringify(preferences) });
    generatePlansMock.mockRejectedValue(
      new ApiError(400, JSON.stringify({ errors: { x: ['Pick at least one activity.'] } })),
    );
    await render(<PlanResultsScreen />);

    expect(await screen.findByText(/Pick at least one activity\./)).toBeOnTheScreen();
  });

  it.each([
    ['no_candidates', 0, 'No venues match the selected preferences. A plan cannot be generated.'],
    [
      'insufficient_candidates',
      1,
      'Only 1 matching venue was found; at least 3 are needed to build a plan.',
    ],
  ])('explains %s and lets the user change preferences', async (code, count, detail) => {
    withParams({ preferences: JSON.stringify(preferences) });
    generatePlansMock.mockRejectedValue(
      new ApiError(
        422,
        JSON.stringify({
          status: 422,
          code,
          candidateCount: count,
          minimumRequired: 3,
          detail,
          suggestion:
            'Try different activities or a wider time window, and check that a transport option is selected.',
        }),
      ),
    );
    const user = userEvent.setup();
    await render(<PlanResultsScreen />);

    expect(
      await screen.findByText(/Try different activities or a wider time window/),
    ).toBeOnTheScreen();
    expect(screen.getByText(new RegExp(detail))).toBeOnTheScreen();
    expect(screen.queryByText(/Something went wrong on our side/)).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Change preferences' }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(generatePlansMock).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, 'not json'])(
    'asks for preferences when the parameter is %p',
    async (value) => {
      withParams({ preferences: value });
      await render(<PlanResultsScreen />);

      expect(screen.getByText('Fill in your preferences first to get plans.')).toBeOnTheScreen();
      expect(generatePlansMock).not.toHaveBeenCalled();
    },
  );

  it('navigates back or to saved plans', async () => {
    withParams({});
    const user = userEvent.setup();
    await render(<PlanResultsScreen />);

    await user.press(screen.getByRole('button', { name: 'Change preferences' }));
    await user.press(screen.getByRole('button', { name: 'View saved plans' }));

    expect(router.back).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith('/saved');
  });

  it('cancels the request when leaving the screen', async () => {
    withParams({ preferences: JSON.stringify(preferences) });
    generatePlansMock.mockReturnValue(new Promise(() => {}));
    const { unmount } = await render(<PlanResultsScreen />);
    const signal = generatePlansMock.mock.calls[0][1] as AbortSignal;

    await unmount();

    expect(signal.aborted).toBe(true);
  });

  it('saves a plan on the device and marks it saved', async () => {
    withParams({ preferences: JSON.stringify(preferences) });
    generatePlansMock.mockResolvedValue({
      plans: [tapasPlan, { ...tapasPlan, id: 'p2', title: 'Other' }],
    });
    const user = userEvent.setup();
    await render(<PlanResultsScreen />);

    await user.press(await screen.findByRole('button', { name: 'Save Tapas and drinks' }));

    expect(await screen.findByRole('button', { name: 'Tapas and drinks saved' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Other' })).toBeEnabled();
    expect((await getSavedPlans()).map((p) => p.id)).toEqual(['p1']);
  });

  it('shows plans that were saved before as saved', async () => {
    await savePlan(tapasPlan);
    withParams({ preferences: JSON.stringify(preferences) });
    generatePlansMock.mockResolvedValue({ plans: [tapasPlan] });
    await render(<PlanResultsScreen />);

    expect(await screen.findByRole('button', { name: 'Tapas and drinks saved' })).toBeDisabled();
  });

  it('says so when saving fails', async () => {
    withParams({ preferences: JSON.stringify(preferences) });
    generatePlansMock.mockResolvedValue({ plans: [tapasPlan] });
    const storage = jest.requireMock<{ setItem: jest.Mock }>(
      '@react-native-async-storage/async-storage',
    );
    storage.setItem.mockRejectedValueOnce(new Error('disk full'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<PlanResultsScreen />);

    await user.press(await screen.findByRole('button', { name: 'Save Tapas and drinks' }));

    expect(await screen.findByText("Couldn't save this plan. Try again.")).toBeOnTheScreen();
  });
});
