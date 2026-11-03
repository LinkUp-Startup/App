import type { Plan } from '../api';

export const samplePlan: Plan = {
  id: '6a1f0c1e-0000-4000-8000-000000000001',
  title: 'Tapas and a late club',
  summary: 'Dinner in the old town, vermouth nearby, then dancing.',
  estimatedCostPerPerson: 38,
  estimatedTotalCost: 76,
  totalDistanceKm: 3.5,
  items: [
    {
      venue: {
        id: '46',
        name: 'Cantamanyanes',
        category: 'dinner',
        address: 'Carrer de Jaume II, 55, 25001 Lleida',
        latitude: 41.6201,
        longitude: 0.6248,
        priceLevel: 2,
      },
      startTime: '2026-11-06T19:30:00Z',
      endTime: '2026-11-06T21:15:00Z',
      estimatedCostPerPerson: 18,
      distanceKm: 0,
    },
    {
      venue: {
        id: '52',
        name: 'Traganits',
        category: 'club',
        address: 'Carrer Darrera Sant Martí, 57, 25004 Lleida',
        latitude: 41.6135,
        longitude: 0.6159,
        priceLevel: null,
      },
      startTime: '2026-11-06T23:30:00Z',
      endTime: '2026-11-07T03:00:00Z',
      estimatedCostPerPerson: 20,
      distanceKm: 3.5,
    },
  ],
};
