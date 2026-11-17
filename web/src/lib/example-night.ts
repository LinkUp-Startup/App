import type { RouteStop } from '@/components/route';

// Real venues from the Lleida dataset; times and prices are only an example.
export const exampleNight: RouteStop[] = [
  {
    name: 'Cantamanyanes',
    activity: 'dinner',
    address: 'Carrer de Jaume II, 55',
    latitude: 0,
    longitude: 0,
    startTime: '2026-11-06T19:30:00Z',
    endTime: '2026-11-06T21:15:00Z',
    costPerPerson: 18,
    distanceKm: 0,
  },
  {
    name: 'La Casa del Vermut',
    activity: 'drinks',
    address: 'Carrer del Corregidor Escofet, 14',
    latitude: 0,
    longitude: 0,
    startTime: '2026-11-06T21:30:00Z',
    endTime: '2026-11-06T23:15:00Z',
    costPerPerson: 8,
    distanceKm: 1.6,
  },
  {
    name: 'Traganits',
    activity: 'club',
    address: 'Carrer Darrera Sant Martí, 57',
    latitude: 0,
    longitude: 0,
    startTime: '2026-11-06T23:30:00Z',
    endTime: '2026-11-07T03:00:00Z',
    costPerPerson: 12,
    distanceKm: 1.9,
  },
];
