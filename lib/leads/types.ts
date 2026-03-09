export type RawLeadRow = {
  "External ID"?: string;
  "Date Added": string;
  Name: string;
  Stage: string;
  Timeframe: string;
  "Is Contacted": string;
  "Listing Price": string;
  "Property Price": string;
  Tags: string;
  "Assigned To": string;
  "Email 1": string;
  "Phone 1": string;
  "Property Address": string;
  "Property City": string;
  "Property MLS Number": string;
  "Lead Source"?: string;
  Message?: string;
  Description?: string;
  Notes?: string;
  "Estim. Moving Date"?: string;
  "Move-in Date"?: string;
};

export const REQUIRED_COLUMNS: (keyof RawLeadRow)[] = [
  "Date Added",
  "Name",
  "Stage",
  "Timeframe",
  "Is Contacted",
  "Listing Price",
  "Property Price",
  "Tags",
  "Assigned To",
  "Email 1",
  "Phone 1",
  "Property Address",
  "Property City",
  "Property MLS Number"
];

export type FunnelBucket =
  | "New/Lead"
  | "Attempted"
  | "Contacted"
  | "Qualified"
  | "Showing"
  | "Offer"
  | "Under Contract"
  | "Closed";

export type LeadFlags = "email_bounced" | "dnc";

export type TransactionType = "rental" | "purchase" | "unknown";

export type ScoreBreakdown = {
  stage_weight: number;
  timeframe_weight: number;
  contact_weight: number;
  recency_weight: number;
  value_weight: number;
  tags_adjust: number;
};

export type LeadRecord = {
  id: string;
  dateAdded: string;
  name: string;
  stage: string;
  timeframe: string;
  isContacted: string;
  listingPrice: number;
  propertyPrice: number;
  value: number;
  tags: string[];
  assignedTo: string;
  email: string;
  phone: string;
  propertyAddress: string;
  propertyCity: string;
  propertyMlsNumber: string;
  leadSource: string;
  message: string;
  description: string;
  notes: string;
  estimMovingDate: string;
  moveInDate: string;
  daysOld: number;
  funnelBucket: FunnelBucket;
  transactionType: TransactionType;
  timelineMonth: string | null;
  timelineLabel: string | null;
  scoreBreakdown: ScoreBreakdown;
  priorityScore: number;
  flags: LeadFlags[];
  excludeFromQueue: boolean;
  nextAction: string;
};
