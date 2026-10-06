export type Activity =
  | "dinner"
  | "drinks"
  | "club"
  | "concert"
  | "cinema"
  | "games"
  | "outdoor";

export type Transport = "walking" | "bike" | "car" | "publicTransport" | "taxi";

export type NightPreferences = {
  budgetPerPerson: number;
  groupSize: number;
  activities: Activity[];
  startTime: string;
  endTime: string;
  maxDistanceKm: number;
  transport: Transport[];
  notes?: string;
};

export type Venue = {
  id: string;
  name: string;
  category: Activity;
  address: string;
  latitude: number;
  longitude: number;
  priceLevel: 1 | 2 | 3 | 4;
};

export type PlanItem = {
  venue: Venue;
  startTime: string;
  endTime: string;
  estimatedCostPerPerson: number;
  distanceKm: number;
};

export type Plan = {
  id: string;
  title: string;
  summary: string;
  items: PlanItem[];
  estimatedCostPerPerson: number;
  totalDistanceKm: number;
};

export type GeneratePlansRequest = {
  preferences: NightPreferences;
};

export type GeneratePlansResponse = {
  plans: Plan[];
};
