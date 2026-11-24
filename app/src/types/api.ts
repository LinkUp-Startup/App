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
export type UserPreferences = Required<Schemas['UserPreferencesDto']>;
export type GeoPoint = Schemas['GeoPointDto'];
export type Venue = Schemas['VenueDto'];
export type PlanItem = Schemas['PlanItemDto'];
export type SavedPlanDto = Schemas['SavedPlanDto'];
export type SavedPlansResponse = Schemas['SavedPlansResponse'];
export type Plan = Schemas['PlanDto'];
export type ShareLink = Schemas['ShareLinkDto'];
export type SharedPlan = Schemas['SharedPlanDto'];
export type GeneratePlansRequest = Schemas['GeneratePlansRequest'];
export type GeneratePlansResponse = Schemas['GeneratePlansResponse'];
export type SwapOptionsRequest = Schemas['SwapOptionsRequest'];
export type SwapOptionsResponse = Schemas['SwapOptionsResponse'];
export type CandidateAvailabilityProblem = Schemas['CandidateAvailabilityProblem'];
export type HealthResponse = Schemas['HealthResponse'];
export type RegisterRequest = Schemas['RegisterRequest'];
export type LoginRequest = Schemas['LoginRequest'];
export type User = Schemas['UserDto'];
export type AuthResponse = Schemas['AuthResponse'];
export type Friend = Schemas['FriendDto'];
export type FriendRequest = Schemas['FriendRequestDto'];
export type FriendsResponse = Schemas['FriendsResponse'];
export type FriendRelation = Schemas['FriendRelation'];
export type UserSearchResult = Schemas['UserSearchResultDto'];
export type UserSearchResponse = Schemas['UserSearchResponse'];
export type GroupRole = Schemas['GroupRole'];
export type Group = Schemas['GroupDto'];
export type GroupMember = Schemas['GroupMemberDto'];
export type GroupSummary = Schemas['GroupSummaryDto'];
export type GroupsResponse = Schemas['GroupsResponse'];
export type CreateGroupRequest = Schemas['CreateGroupRequest'];
export type GroupPlanRound = Schemas['GroupPlanRoundDto'];
export type GroupPlansResponse = Schemas['GroupPlansResponse'];
export type CastVoteRequest = Schemas['CastVoteRequest'];
export type SwapGroupStopRequest = Schemas['SwapGroupStopRequest'];
export type PlanVotes = Schemas['PlanVotesDto'];
export type GroupVoteResults = Schemas['GroupVoteResultsDto'];
export type ReceivedPlan = Schemas['ReceivedPlanDto'];
export type ReceivedPlansResponse = Schemas['ReceivedPlansResponse'];
