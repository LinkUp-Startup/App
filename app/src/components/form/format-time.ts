export function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** The date with its time of day replaced by an "HH:mm" string, or undefined if it isn't one. */
export function withTime(date: Date, time: string): Date | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;

  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}
