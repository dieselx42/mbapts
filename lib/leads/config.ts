import type { FunnelBucket } from "./types";

export const STAGE_WEIGHTS: Record<string, number> = {
  "active client": 50,
  interested: 35,
  "interested - went cold": 22,
  prospect: 20,
  lead: 18,
  attempted: 12,
  "hung up / call attempted": 8,
  "follow-up": 6,
  "follow up in aprox. 1 year": 3,
  "low interest/engagement (n2)": 2,
  unqualified: -10,
  "is an agent": 0
};

export const DEFAULT_STAGE_WEIGHT = 10;

export const TIMEFRAME_WEIGHTS: Record<string, number> = {
  "0-3 months": 25,
  "3-6 months": 18,
  "6-12 months": 10,
  "12+ months": 4,
  unknown: 8
};

export const CONTACT_WEIGHTS: Record<string, number> = {
  no: 10,
  yes: 0,
  unknown: 5
};

export const FUNNEL_BUCKETS: FunnelBucket[] = [
  "New/Lead",
  "Attempted",
  "Contacted",
  "Qualified",
  "Showing",
  "Offer",
  "Under Contract",
  "Closed"
];

export const STAGE_TO_BUCKET: Record<string, FunnelBucket> = {
  lead: "New/Lead",
  prospect: "New/Lead",
  "follow up in aprox. 1 year": "New/Lead",
  "low interest/engagement (n2)": "New/Lead",
  attempted: "Attempted",
  "hung up / call attempted": "Attempted",
  "follow-up": "Contacted",
  contacted: "Contacted",
  interested: "Qualified",
  "interested - went cold": "Qualified",
  "active client": "Showing",
  showing: "Showing",
  offer: "Offer",
  "under contract": "Under Contract",
  closed: "Closed",
  unqualified: "Contacted",
  "is an agent": "Contacted"
};

export const DEFAULT_BUCKET: FunnelBucket = "New/Lead";
