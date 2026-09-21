import type { ApiRequest } from "./PromptDetails";

export type Criterion = { name: string; description: string; weight: number };
export type RoutingOption = { name: string; description: string };
export type LeadProfile = {
  id: string;
  name: string;
  icp_description: string;
  criteria: Criterion[];
  industry_levels: string[];
  maturity_levels: string[];
  intent_levels: string[];
  routing: RoutingOption[];
};
export type LevelResult = { level: string; score: number; confidence: number };
export type LeadResult = {
  requests?: ApiRequest[];
  icp_fit: number;
  criteria: (Criterion & { fit: number })[];
  industry_fit: LevelResult;
  company_maturity: LevelResult;
  purchase_intent: LevelResult;
  priority: number;
  tier: "Hot" | "Warm" | "Cold";
  route: string;
  route_description: string;
  route_confidence: number;
  needs_review: boolean;
  review_reasons?: string[];
  profile_name: string;
};
/** One entry of a batch: the server returns either a result or a safe message. */
export type ScoredLead = { index: number; result?: LeadResult; error?: string };
export type LeadBatch = { leads: ScoredLead[]; scored: number; failed: number };
