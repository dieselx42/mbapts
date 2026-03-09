import { resolve } from "node:path";

function toBoolean(value, defaultValue) {
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig() {
  const config = {
    port: toInteger(process.env.PORT, 8787),
    ingestToken: process.env.INGEST_TOKEN || "",
    fubApiKey: process.env.FUB_API_KEY || "",
    fubBaseUrl: process.env.FUB_BASE_URL || "https://api.followupboss.com/v1",
    fubOrigin: process.env.FUB_ORIGIN || "miamibeachapartments-newsletter",
    fubDefaultUserId: process.env.FUB_DEFAULT_USER_ID || "",
    campaignMapFile: resolve(process.cwd(), process.env.CAMPAIGN_MAP_FILE || "./data/campaign-map.json"),
    engagementFile: resolve(process.cwd(), process.env.ENGAGEMENT_FILE || "./data/engagement.json"),
    enablePreconstructionTag: toBoolean(process.env.ENABLE_PRECONSTRUCTION_TAG, true),
    preconstructionTagName: process.env.PRECONSTRUCTION_TAG_NAME || "Preconstruction Active",
    preconstructionClickThreshold: toInteger(process.env.PRECONSTRUCTION_CLICK_THRESHOLD, 3),
    preconstructionWindowDays: toInteger(process.env.PRECONSTRUCTION_WINDOW_DAYS, 14)
  };

  if (!config.fubApiKey) {
    throw new Error("Missing required env var: FUB_API_KEY");
  }

  return config;
}
