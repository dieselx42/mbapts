import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { FubClient } from "./fubClient.js";
import { logError, logInfo } from "./lib/logger.js";
import { CampaignRegistry } from "./services/campaignRegistry.js";
import { EngagementScorer } from "./services/engagementScorer.js";
import { EventForwarder } from "./services/eventForwarder.js";
import { FubTagger } from "./services/tagger.js";

const MAX_BODY_BYTES = 1_000_000;

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(`${JSON.stringify(payload)}\n`);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function validatePayload(payload) {
  if (!payload.campaign || typeof payload.campaign !== "object") {
    throw new Error("Missing campaign object");
  }
  if (!Array.isArray(payload.events) || payload.events.length === 0) {
    throw new Error("Missing events array");
  }
  if (!payload.campaign.originId && !payload.campaign.id) {
    throw new Error("campaign.originId (or campaign.id) is required");
  }
}

function isPreconstructionCampaign(campaign) {
  const check = `${campaign.type || ""} ${campaign.category || ""} ${campaign.name || ""}`.toLowerCase();
  return check.includes("preconstruction") || check.includes("new construction");
}

function isAuthorized(request, ingestToken) {
  if (!ingestToken) return true;
  const token = request.headers["x-ingest-token"];
  return token === ingestToken;
}

async function bootstrap() {
  const config = loadConfig();
  const fubClient = new FubClient({
    apiKey: config.fubApiKey,
    baseUrl: config.fubBaseUrl
  });

  const campaignRegistry = new CampaignRegistry({
    mapFile: config.campaignMapFile,
    fubClient,
    origin: config.fubOrigin,
    defaultUserId: config.fubDefaultUserId
  });

  const eventForwarder = new EventForwarder({
    fubClient,
    defaultUserId: config.fubDefaultUserId
  });

  const scorer = new EngagementScorer({
    storageFile: config.engagementFile,
    threshold: config.preconstructionClickThreshold,
    windowDays: config.preconstructionWindowDays,
    tagName: config.preconstructionTagName
  });

  const tagger = new FubTagger({
    fubClient,
    tagName: config.preconstructionTagName
  });

  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        jsonResponse(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && request.url === "/webhooks/email-events") {
        if (!isAuthorized(request, config.ingestToken)) {
          jsonResponse(response, 401, { error: "Unauthorized" });
          return;
        }

        const payload = await readJsonBody(request);
        validatePayload(payload);

        const campaignId = await campaignRegistry.ensureCampaignId(payload.campaign);
        const forwardResult = await eventForwarder.forward(campaignId, payload.events);
        const result = {
          ok: true,
          campaignId,
          forwardedEvents: forwardResult.forwarded,
          tagsApplied: []
        };

        if (config.enablePreconstructionTag && isPreconstructionCampaign(payload.campaign)) {
          const recipientsToTag = await scorer.evaluatePreconstructionClicks(payload.events);
          for (const email of recipientsToTag) {
            const taggingResult = await tagger.applyTagToEmail(email);
            result.tagsApplied.push(taggingResult);
          }
        }

        jsonResponse(response, 200, result);
        return;
      }

      jsonResponse(response, 404, { error: "Not found" });
    } catch (error) {
      logError("Request failed", {
        method: request.method,
        url: request.url,
        error: error.message,
        status: error.status,
        details: error.payload
      });
      jsonResponse(response, 400, {
        ok: false,
        error: error.message,
        status: error.status || 400,
        details: error.payload || null
      });
    }
  });

  server.listen(config.port, () => {
    logInfo("Follow Up Boss integration service started", {
      port: config.port,
      origin: config.fubOrigin
    });
  });
}

bootstrap().catch((error) => {
  logError("Service bootstrap failed", { error: error.message });
  process.exit(1);
});
