import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { parseCsv } from "../../../lib/leads/csv";
import { buildLeadRecords } from "../../../lib/leads/scoring";
import { extractItems, fubGet } from "../../../lib/fub/client";
import type { RawLeadRow } from "../../../lib/leads/types";

const DEFAULT_CSV_PATH = "/mnt/data/leads-2026-03-08.csv";
const DOWNLOADS_FALLBACK_PATH = "/Users/felipegallego/Downloads/leads-2026-03-08.csv";
const ALT_DEFAULT_CSV_PATH = "/mnt/data/all-people-2026-03-08.csv";
const ALT_DOWNLOADS_PATH = "/Users/felipegallego/Downloads/all-people-2026-03-08.csv";
const PREV_DEFAULT_CSV_PATH = "/mnt/data/all-people-2026-03-07.csv";
const PREV_DOWNLOADS_PATH = "/Users/felipegallego/Downloads/all-people-2026-03-07.csv";
const LEGACY_DEFAULT_CSV_PATH = "/mnt/data/all-people-2026-03-05.csv";
const LEGACY_DOWNLOADS_PATH = "/Users/felipegallego/Downloads/all-people-2026-03-05.csv";

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstContactValue(list: unknown): string {
  if (!Array.isArray(list)) return "";
  const primary = list.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const objectEntry = entry as Record<string, unknown>;
    return objectEntry.isPrimary === 1 || objectEntry.isPrimary === true;
  });
  const first = primary || list[0];
  if (!first || typeof first !== "object") return "";
  return asString((first as Record<string, unknown>).value);
}

function firstAddress(list: unknown): Record<string, unknown> {
  if (!Array.isArray(list)) return {};
  const first = list[0];
  if (!first || typeof first !== "object") return {};
  return first as Record<string, unknown>;
}

function monthDiffFromNow(date: Date): number {
  const now = new Date();
  return (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth());
}

function timeframeFromDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const months = monthDiffFromNow(date);
  if (months <= 3) return "0-3 Months";
  if (months <= 6) return "3-6 Months";
  if (months <= 12) return "6-12 Months";
  return "12+ Months";
}

function normalizeDateString(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function timeframeFromPerson(person: Record<string, unknown>): string {
  const status = asString(person.timeframeStatus);
  if (status) return status;

  const range = person.timeframeDateRange;
  if (range && typeof range === "object") {
    const objectRange = range as Record<string, unknown>;
    const end = asString(objectRange.end) || asString(objectRange.to);
    const start = asString(objectRange.start) || asString(objectRange.from);
    const fromDate = timeframeFromDate(end || start);
    if (fromDate) return fromDate;
  }

  return "";
}

function mapFubPersonToRawRow(person: Record<string, unknown>): RawLeadRow {
  const tags = Array.isArray(person.tags) ? person.tags.map((entry) => asString(entry)).filter(Boolean) : [];
  const address = firstAddress(person.addresses);
  const dealCloseDate = normalizeDateString(asString(person.dealCloseDate));
  const dateAdded = normalizeDateString(asString(person.created));
  const updated = normalizeDateString(asString(person.updated));
  const timeframe = timeframeFromPerson(person);
  const location = asString((person.socialData as Record<string, unknown> | undefined)?.location);
  const cityFromLocation = location.includes(",") ? location.split(",")[0].trim() : location;

  return {
    "External ID": asString(person.id) || asString(person.personId),
    "Date Added": dateAdded || updated || new Date().toISOString().slice(0, 10),
    Name: asString(person.name) || `${asString(person.firstName)} ${asString(person.lastName)}`.trim(),
    Stage: asString(person.stage),
    Timeframe: timeframe,
    "Is Contacted": Number(person.contacted) > 0 ? "Yes" : "No",
    "Listing Price": String(asNumber(person.price)),
    "Property Price": String(asNumber(person.dealPrice)),
    Tags: tags.join(", "),
    "Assigned To": asString(person.assignedTo),
    "Email 1": firstContactValue(person.emails),
    "Phone 1": firstContactValue(person.phones),
    "Property Address": asString(address.street) || asString(address.address),
    "Property City": asString(address.city) || cityFromLocation,
    "Property MLS Number": "",
    "Lead Source": asString(person.source),
    Message: "",
    Description: asString(person.dealName),
    Notes: "",
    "Estim. Moving Date": "",
    "Move-in Date": dealCloseDate
  };
}

function personDedupeKey(person: Record<string, unknown>): string {
  const id = asString(person.id) || asString(person.personId);
  if (id) return `id:${id}`;

  const name = asString(person.name) || `${asString(person.firstName)} ${asString(person.lastName)}`.trim();
  const email = firstContactValue(person.emails);
  const phone = firstContactValue(person.phones);
  return `fallback:${name.toLowerCase()}|${email.toLowerCase()}|${phone}`;
}

async function loadFromFubApi() {
  const pageSize = Number.parseInt(process.env.LEADS_FUB_PAGE_SIZE || "100", 10) || 100;
  const maxPages = Number.parseInt(process.env.LEADS_FUB_MAX_PAGES || "20", 10) || 20;

  const rows: RawLeadRow[] = [];
  const seenPeople = new Set<string>();
  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const payload = await fubGet("/people", { offset, limit: pageSize });
    const items = extractItems(payload);
    if (items.length === 0) break;

    for (const person of items) {
      const key = personDedupeKey(person);
      if (seenPeople.has(key)) continue;
      seenPeople.add(key);
      rows.push(mapFubPersonToRawRow(person));
    }

    const metadata =
      payload && typeof payload === "object"
        ? ((payload as Record<string, unknown>)._metadata as Record<string, unknown> | undefined)
        : undefined;
    const total = metadata ? asNumber(metadata.total) : 0;

    if (total > 0 && offset + items.length >= total) break;
    if (items.length < pageSize) break;
  }

  const leads = buildLeadRecords(rows);
  return {
    ok: true,
    source: "Follow Up Boss API (/people)",
    refreshedAt: new Date().toISOString(),
    count: leads.length,
    leads
  };
}

async function loadFromCsv() {
  const candidatePaths = [
    DEFAULT_CSV_PATH,
    DOWNLOADS_FALLBACK_PATH,
    ALT_DEFAULT_CSV_PATH,
    ALT_DOWNLOADS_PATH,
    PREV_DEFAULT_CSV_PATH,
    PREV_DOWNLOADS_PATH,
    LEGACY_DEFAULT_CSV_PATH,
    LEGACY_DOWNLOADS_PATH
  ];

  let lastReadError: Error | null = null;

  for (const path of candidatePaths) {
    try {
      const rawCsv = await readFile(path, "utf8");
      const rows = parseCsv(rawCsv);
      const leads = buildLeadRecords(rows);
      return {
        ok: true,
        source: path,
        refreshedAt: new Date().toISOString(),
        count: leads.length,
        leads
      };
    } catch (error) {
      lastReadError = error instanceof Error ? error : new Error("Unknown file read error");
    }
  }

  throw lastReadError ?? new Error("No readable CSV source found");
}

export async function GET(request: NextRequest) {
  const sourceParam = new URL(request.url).searchParams.get("source")?.toLowerCase();
  const configuredSource = (process.env.LEADS_SOURCE || "").trim().toLowerCase();
  const isVercel = Boolean(process.env.VERCEL);
  const hasFubKey = Boolean(process.env.FUB_API_KEY?.trim());
  const sourcePreference = sourceParam || configuredSource || (isVercel || hasFubKey ? "fub" : "csv");

  try {
    if (sourcePreference === "fub") {
      if (!hasFubKey) {
        return NextResponse.json(
          {
            ok: false,
            source: "fub",
            refreshedAt: new Date().toISOString(),
            count: 0,
            leads: [],
            error: "Missing FUB_API_KEY in environment"
          },
          { status: 500 }
        );
      }
      const payload = await loadFromFubApi();
      return NextResponse.json(payload);
    }

    if (sourcePreference === "csv") {
      if (isVercel) {
        return NextResponse.json(
          {
            ok: false,
            source: "csv",
            refreshedAt: new Date().toISOString(),
            count: 0,
            leads: [],
            error: "CSV source is disabled on Vercel. Use FUB_API_KEY and LEADS_SOURCE=fub."
          },
          { status: 500 }
        );
      }
      const payload = await loadFromCsv();
      return NextResponse.json(payload);
    }

    if (hasFubKey) {
      try {
        const payload = await loadFromFubApi();
        return NextResponse.json(payload);
      } catch {
        const payload = await loadFromCsv();
        return NextResponse.json(payload);
      }
    }

    const payload = await loadFromCsv();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        source: sourcePreference,
        refreshedAt: new Date().toISOString(),
        count: 0,
        leads: [],
        error: error instanceof Error ? error.message : "Failed to load leads"
      },
      { status: 500 }
    );
  }
}
