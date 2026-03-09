type QueryValue = string | number | boolean | null | undefined;
type Query = Record<string, QueryValue>;

function envRequired(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function toQueryString(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

function parseJsonSafe(raw: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export async function fubGet(path: string, query: Query = {}): Promise<unknown> {
  const apiKey = envRequired("FUB_API_KEY");
  const baseUrl = (process.env.FUB_BASE_URL || "https://api.followupboss.com/v1").replace(/\/+$/, "");
  const systemName = process.env.FUB_SYSTEM_NAME || "lead-funnel-dashboard";
  const auth = Buffer.from(`${apiKey}:`, "utf8").toString("base64");
  const url = `${baseUrl}${path}${toQueryString(query)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "X-System": systemName
    },
    cache: "no-store"
  });

  const raw = await response.text();
  const payload = parseJsonSafe(raw);

  if (!response.ok) {
    throw new Error(`FUB request failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload;
}

export function extractItems(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const objectPayload = payload as Record<string, unknown>;
  for (const key of ["people", "items", "data"]) {
    const candidate = objectPayload[key];
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
  }
  return [];
}
