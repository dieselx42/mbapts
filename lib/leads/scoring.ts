import {
  CONTACT_WEIGHTS,
  DEFAULT_BUCKET,
  DEFAULT_STAGE_WEIGHT,
  STAGE_TO_BUCKET,
  STAGE_WEIGHTS,
  TIMEFRAME_WEIGHTS
} from "./config";
import type {
  FunnelBucket,
  LeadFlags,
  LeadRecord,
  RawLeadRow,
  ScoreBreakdown,
  TransactionType
} from "./types";

const VALUE_LOG_MIN = 4;
const VALUE_LOG_MAX = 8;
const KNOWN_TIMEFRAME_OFFSETS: Record<string, number> = {
  "0-3 months": 2,
  "3-6 months": 5,
  "6-12 months": 9,
  "12+ months": 14
};

const RENTAL_KEYWORDS = [
  "rent",
  "rental",
  "lease",
  "for rent",
  "condos for rent",
  "tenant"
];

const PURCHASE_KEYWORDS = [
  "buy",
  "buyer",
  "purchase",
  "sale",
  "for sale",
  "condos for sale",
  "close",
  "closing"
];

const MONTH_ALIASES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec"
];

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function parseTags(value: string): string[] {
  return value
    .split(/[;,|]/g)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseAmount(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: string): Date | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function daysOldFromDate(dateAdded: string): number {
  const date = parseDate(dateAdded);
  if (!date) return 15;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function recencyWeight(daysOld: number): number {
  return Math.max(0, 15 - Math.min(daysOld, 15));
}

function valueWeight(value: number): number {
  if (value <= 0) return 0;
  const logValue = Math.log10(value);
  const ratio = (logValue - VALUE_LOG_MIN) / (VALUE_LOG_MAX - VALUE_LOG_MIN);
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round(clamped * 12);
}

function tagsAdjust(tags: string[]): { adjust: number; flags: LeadFlags[]; excludeFromQueue: boolean } {
  const normalizedTags = tags.map(normalize);
  const flags: LeadFlags[] = [];
  let adjust = 0;
  let excludeFromQueue = false;

  if (normalizedTags.some((tag) => tag.includes("bounced"))) {
    flags.push("email_bounced");
  }

  if (normalizedTags.some((tag) => tag.includes("dnc") || tag.includes("do not contact"))) {
    flags.push("dnc");
    adjust -= 50;
    excludeFromQueue = true;
  }

  return { adjust, flags, excludeFromQueue };
}

function mapFunnelBucket(stage: string): FunnelBucket {
  const key = normalize(stage);
  if (STAGE_TO_BUCKET[key]) return STAGE_TO_BUCKET[key];

  if (key.includes("closed")) return "Closed";
  if (key.includes("contract")) return "Under Contract";
  if (key.includes("offer")) return "Offer";
  if (key.includes("show")) return "Showing";
  if (key.includes("qual") || key.includes("interest")) return "Qualified";
  if (key.includes("attempt") || key.includes("hung")) return "Attempted";
  if (key.includes("contact") || key.includes("follow")) return "Contacted";
  return DEFAULT_BUCKET;
}

function nextActionForLead(lead: {
  flags: LeadFlags[];
  stage: string;
  isContacted: string;
  timeframe: string;
}): string {
  const stage = normalize(lead.stage);
  const contacted = normalize(lead.isContacted);
  const timeframe = normalize(lead.timeframe);

  if (lead.flags.includes("email_bounced")) return "Call/Text only";
  if (stage === "interested" && contacted !== "yes") return "Call within 2 hours";
  if (stage === "active client") return "Same-day follow-up";
  if (timeframe === "0-3 months") return "Schedule consult this week";
  return "Review profile and follow up";
}

function scoreBreakdown(
  row: RawLeadRow,
  daysOld: number,
  value: number
): { breakdown: ScoreBreakdown; flags: LeadFlags[]; exclude: boolean } {
  const stageKey = normalize(row.Stage);
  const timeframeKey = normalize(row.Timeframe);
  const contactKey = normalize(row["Is Contacted"]);
  const tags = parseTags(row.Tags);
  const tagResult = tagsAdjust(tags);

  const breakdown: ScoreBreakdown = {
    stage_weight: STAGE_WEIGHTS[stageKey] ?? DEFAULT_STAGE_WEIGHT,
    timeframe_weight: TIMEFRAME_WEIGHTS[timeframeKey] ?? TIMEFRAME_WEIGHTS.unknown,
    contact_weight: CONTACT_WEIGHTS[contactKey] ?? CONTACT_WEIGHTS.unknown,
    recency_weight: recencyWeight(daysOld),
    value_weight: valueWeight(value),
    tags_adjust: tagResult.adjust
  };

  return { breakdown, flags: tagResult.flags, exclude: tagResult.excludeFromQueue };
}

function cleanText(value: string | undefined): string {
  return (value || "").trim();
}

function leadId(row: RawLeadRow, index: number): string {
  const externalId = cleanText(row["External ID"]);
  const email = cleanText(row["Email 1"]);
  const phone = cleanText(row["Phone 1"]);
  const name = cleanText(row.Name);
  return externalId || email || phone || `${name || "lead"}-${index + 1}`;
}

function classifyTransactionType(lead: {
  value: number;
  stage: string;
  timeframe: string;
  tags: string[];
  leadSource: string;
  notes: string;
  description: string;
  message: string;
}): TransactionType {
  const text = [
    lead.stage,
    lead.timeframe,
    lead.tags.join(" "),
    lead.leadSource,
    lead.notes,
    lead.description,
    lead.message
  ]
    .join(" ")
    .toLowerCase();

  const hasRental = RENTAL_KEYWORDS.some((keyword) => text.includes(keyword));
  const hasPurchase = PURCHASE_KEYWORDS.some((keyword) => text.includes(keyword));

  if (hasRental && !hasPurchase) return "rental";
  if (hasPurchase && !hasRental) return "purchase";
  if (hasRental && hasPurchase) return lead.value <= 50_000 ? "rental" : "purchase";
  if (lead.value > 50_000) return "purchase";
  if (lead.value > 0) return "rental";
  return "unknown";
}

function inferMonthFromText(text: string): Date | null {
  const normalized = text.toLowerCase();
  const match = normalized.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:[\s,/-]*(20\d{2}))?/
  );
  if (!match) return null;

  const shortMonth = match[1].slice(0, 3);
  const monthIndex = MONTH_ALIASES.indexOf(shortMonth);
  if (monthIndex < 0) return null;

  const now = new Date();
  const explicitYear = match[2] ? Number.parseInt(match[2], 10) : null;
  let year = explicitYear ?? now.getFullYear();

  if (!explicitYear && monthIndex < now.getMonth() - 1) {
    year += 1;
  }

  return new Date(year, monthIndex, 1);
}

function inferTimelineDate(row: RawLeadRow): Date | null {
  const explicitMovingDate = parseDate(cleanText(row["Estim. Moving Date"])) || parseDate(cleanText(row["Move-in Date"]));
  if (explicitMovingDate) {
    return firstOfMonth(explicitMovingDate);
  }

  const notesText = `${cleanText(row.Notes)} ${cleanText(row.Description)} ${cleanText(row.Message)}`;
  const monthFromText = inferMonthFromText(notesText);
  if (monthFromText) {
    return firstOfMonth(monthFromText);
  }

  const timeframeKey = normalize(row.Timeframe);
  if (KNOWN_TIMEFRAME_OFFSETS[timeframeKey] !== undefined) {
    return addMonths(firstOfMonth(new Date()), KNOWN_TIMEFRAME_OFFSETS[timeframeKey]);
  }

  if (normalize(row.Stage) === "follow up in aprox. 1 year") {
    return addMonths(firstOfMonth(new Date()), 12);
  }

  return null;
}

export function buildLeadRecord(row: RawLeadRow, index: number): LeadRecord {
  const listingPrice = parseAmount(row["Listing Price"]);
  const propertyPrice = parseAmount(row["Property Price"]);
  const value = Math.max(listingPrice, propertyPrice);
  const daysOld = daysOldFromDate(row["Date Added"]);
  const tags = parseTags(row.Tags);
  const notes = cleanText(row.Notes);
  const description = cleanText(row.Description);
  const message = cleanText(row.Message);
  const leadSource = cleanText(row["Lead Source"]);
  const { breakdown, flags, exclude } = scoreBreakdown(row, daysOld, value);
  const priorityScore =
    breakdown.stage_weight +
    breakdown.timeframe_weight +
    breakdown.contact_weight +
    breakdown.recency_weight +
    breakdown.value_weight +
    breakdown.tags_adjust;

  const timelineDate = inferTimelineDate(row);
  const transactionType = classifyTransactionType({
    value,
    stage: row.Stage,
    timeframe: row.Timeframe,
    tags,
    leadSource,
    notes,
    description,
    message
  });

  const lead: LeadRecord = {
    id: leadId(row, index),
    dateAdded: cleanText(row["Date Added"]),
    name: cleanText(row.Name),
    stage: cleanText(row.Stage),
    timeframe: cleanText(row.Timeframe),
    isContacted: cleanText(row["Is Contacted"]),
    listingPrice,
    propertyPrice,
    value,
    tags,
    assignedTo: cleanText(row["Assigned To"]),
    email: cleanText(row["Email 1"]),
    phone: cleanText(row["Phone 1"]),
    propertyAddress: cleanText(row["Property Address"]),
    propertyCity: cleanText(row["Property City"]),
    propertyMlsNumber: cleanText(row["Property MLS Number"]),
    leadSource,
    message,
    description,
    notes,
    estimMovingDate: cleanText(row["Estim. Moving Date"]),
    moveInDate: cleanText(row["Move-in Date"]),
    daysOld,
    funnelBucket: mapFunnelBucket(row.Stage),
    transactionType,
    timelineMonth: timelineDate ? monthKey(timelineDate) : null,
    timelineLabel: timelineDate ? monthLabel(timelineDate) : null,
    scoreBreakdown: breakdown,
    priorityScore,
    flags,
    excludeFromQueue: exclude,
    nextAction: "Review profile and follow up"
  };

  lead.nextAction = nextActionForLead({
    flags: lead.flags,
    stage: lead.stage,
    isContacted: lead.isContacted,
    timeframe: lead.timeframe
  });

  return lead;
}

export function buildLeadRecords(rows: RawLeadRow[]): LeadRecord[] {
  const seenIds = new Map<string, number>();

  return rows.map((row, index) => {
    const lead = buildLeadRecord(row, index);
    const baseId = lead.id || `lead-${index + 1}`;
    const occurrences = (seenIds.get(baseId) ?? 0) + 1;
    seenIds.set(baseId, occurrences);

    if (occurrences > 1) {
      lead.id = `${baseId}__${occurrences}`;
    }

    return lead;
  });
}
