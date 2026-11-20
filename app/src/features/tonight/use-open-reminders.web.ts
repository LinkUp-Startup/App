/**
 * The browser version of use-open-reminders.ts. Reminders are local notifications on the phone, and the browser has
 * none: the notifications module throws as soon as it is asked about them, which left the whole page blank. So on
 * the web nothing opens from a reminder, and nothing talks to the notifications module at all.
 */
export function useOpenReminders() {}
