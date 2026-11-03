// Plans are for nights in Lleida, so times are always shown in Lleida's time zone, whatever the viewer's.
const TIME_ZONE = 'Europe/Madrid';

const time = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});
const day = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIME_ZONE,
});
const euros = (fractionDigits: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
const wholeEuros = euros(0);
const centEuros = euros(2);

export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatDay = (iso: string) => day.format(new Date(iso));
// €18, but €7.50 rather than €7.5.
export const formatEuros = (amount: number) =>
  (Number.isInteger(amount) ? wholeEuros : centEuros).format(amount);
export const formatKm = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(/\.0$/, '')} km`;

const activities: Record<string, string> = {
  dinner: 'Dinner',
  drinks: 'Drinks',
  club: 'Club',
  concert: 'Concert',
  cinema: 'Cinema',
  games: 'Games',
  outdoor: 'Outside',
};

export const activityLabel = (activity: string) => activities[activity] ?? activity;

export const directionsUrl = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
