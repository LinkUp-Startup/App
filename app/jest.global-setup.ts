// Runs once before the test workers start, which inherit the variable. Setting TZ later (in a setup file) is too
// late: Node has already fixed the time zone by then. Times are shown in the device's zone, so tests pin one.
export default function globalSetup() {
  process.env.TZ = 'Europe/Madrid';
}
