import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import { addPlanToCalendar } from '@/features/plans/add-to-calendar';

import { tapasPlan } from './fixtures/plans';

jest.mock('expo-calendar/legacy', () => ({
  EntityTypes: { EVENT: 'event' },
  requestCalendarPermissionsAsync: jest.fn(),
  getDefaultCalendarAsync: jest.fn(),
  getCalendarsAsync: jest.fn(),
  createEventAsync: jest.fn(),
}));

const calendar = (id: string, extra: object = {}) =>
  ({ id, allowsModifications: true, isPrimary: false, ...extra }) as Calendar.Calendar;

const originalOs = Platform.OS;
const setOs = (os: typeof Platform.OS) => Object.defineProperty(Platform, 'OS', { value: os });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Calendar.requestCalendarPermissionsAsync).mockResolvedValue({
    status: 'granted',
  } as Calendar.PermissionResponse);
  jest.mocked(Calendar.createEventAsync).mockResolvedValue('event-id');
});

afterEach(() => setOs(originalOs));

describe('addPlanToCalendar', () => {
  it('adds every stop to the default calendar on iOS', async () => {
    setOs('ios');
    jest.mocked(Calendar.getDefaultCalendarAsync).mockResolvedValue(calendar('ios-default'));

    await expect(addPlanToCalendar(tapasPlan)).resolves.toEqual({ status: 'added', count: 2 });

    expect(Calendar.createEventAsync).toHaveBeenCalledTimes(2);
    const [calendarId, event] = jest.mocked(Calendar.createEventAsync).mock.calls[0];
    expect(calendarId).toBe('ios-default');
    expect(event).toMatchObject({
      title: 'Teresa Carles',
      startDate: new Date('2026-10-30T19:30:00Z'),
      location: 'Carrer Major 1, Lleida',
      timeZone: 'Europe/Madrid',
    });
    expect(event?.notes).toContain('Dinner. About €20.00 per person.');
    expect(event?.notes).toContain('Directions: https://www.google.com/maps/search/?api=1&query=');
    expect(event?.notes).toContain('Part of "Tapas and drinks", planned with LinkUp.');
  });

  it('uses the primary writable calendar on Android', async () => {
    setOs('android');
    jest
      .mocked(Calendar.getCalendarsAsync)
      .mockResolvedValue([
        calendar('holidays', { allowsModifications: false, isPrimary: true }),
        calendar('other'),
        calendar('primary', { isPrimary: true }),
      ]);

    await addPlanToCalendar(tapasPlan);

    expect(Calendar.getCalendarsAsync).toHaveBeenCalledWith('event');
    expect(jest.mocked(Calendar.createEventAsync).mock.calls[0][0]).toBe('primary');
  });

  it('falls back to any writable calendar on Android', async () => {
    setOs('android');
    jest.mocked(Calendar.getCalendarsAsync).mockResolvedValue([calendar('other')]);

    await addPlanToCalendar(tapasPlan);

    expect(jest.mocked(Calendar.createEventAsync).mock.calls[0][0]).toBe('other');
  });

  it('says so when no calendar can take events', async () => {
    setOs('android');
    jest
      .mocked(Calendar.getCalendarsAsync)
      .mockResolvedValue([calendar('read-only', { allowsModifications: false })]);

    await expect(addPlanToCalendar(tapasPlan)).resolves.toEqual({ status: 'no-calendar' });
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
  });

  it('adds nothing without permission', async () => {
    jest.mocked(Calendar.requestCalendarPermissionsAsync).mockResolvedValue({
      status: 'denied',
    } as Calendar.PermissionResponse);

    await expect(addPlanToCalendar(tapasPlan)).resolves.toEqual({ status: 'denied' });
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
  });

  it('marks an unknown price as unknown', async () => {
    setOs('ios');
    jest.mocked(Calendar.getDefaultCalendarAsync).mockResolvedValue(calendar('ios-default'));
    const plan = {
      ...tapasPlan,
      items: [{ ...tapasPlan.items[0], estimatedCostPerPerson: null }],
    };

    await addPlanToCalendar(plan);

    expect(jest.mocked(Calendar.createEventAsync).mock.calls[0][1]?.notes).toContain(
      'Dinner. Price unknown.',
    );
  });
});
