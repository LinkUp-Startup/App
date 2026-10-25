import type { Plan } from '@/types/api';

/** Dinner then drinks on Friday 30 October 2026 (times in UTC; Madrid is +01:00). */
export const tapasPlan: Plan = {
  id: 'p1',
  title: 'Tapas and drinks',
  summary: 'Dinner in the old town, then a cocktail bar.',
  items: [
    {
      venue: {
        id: '22',
        name: 'Teresa Carles',
        category: 'dinner',
        address: 'Carrer Major 1, Lleida',
        latitude: 41.6,
        longitude: 0.6,
        priceLevel: 2,
      },
      startTime: '2026-10-30T19:30:00Z',
      endTime: '2026-10-30T21:00:00Z',
      estimatedCostPerPerson: 20,
      distanceKm: 0,
    },
    {
      venue: {
        id: '6',
        name: 'Pub Legend',
        category: 'drinks',
        address: 'Carrer del Pub 2, Lleida',
        latitude: 41.61,
        longitude: 0.6,
        priceLevel: null,
      },
      startTime: '2026-10-30T21:15:00Z',
      endTime: '2026-10-30T22:45:00Z',
      estimatedCostPerPerson: 5.5,
      distanceKm: 0.91,
    },
  ],
  estimatedCostPerPerson: 25.5,
  totalDistanceKm: 0.91,
};
