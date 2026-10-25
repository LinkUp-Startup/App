/**
 * API contract with the ASP.NET Core backend.
 *
 * Generated, do not edit by hand: the backend writes `shared/openapi.json` on build, and
 * `npm run generate:api` turns it into `shared/api.ts`. Change the C# DTOs, rebuild the backend,
 * then regenerate. CI fails if the committed files are out of date.
 */
import type { components } from '@shared/api';

type Schemas = components['schemas'];

export type Activity = Schemas['Activity'];
export type Transport = Schemas['Transport'];
export type NightPreferences = Schemas['NightPreferencesDto'];
export type Venue = Schemas['VenueDto'];
export type PlanItem = Schemas['PlanItemDto'];
export type SavedPlanDto = Schemas['SavedPlanDto'];
export type SavedPlansResponse = Schemas['SavedPlansResponse'];
export type Plan = Schemas['PlanDto'];
export type GeneratePlansRequest = Schemas['GeneratePlansRequest'];
export type GeneratePlansResponse = Schemas['GeneratePlansResponse'];
export type CandidateAvailabilityProblem = Schemas['CandidateAvailabilityProblem'];
export type HealthResponse = Schemas['HealthResponse'];
export type RegisterRequest = Schemas['RegisterRequest'];
export type LoginRequest = Schemas['LoginRequest'];
export type User = Schemas['UserDto'];
export type AuthResponse = Schemas['AuthResponse'];
