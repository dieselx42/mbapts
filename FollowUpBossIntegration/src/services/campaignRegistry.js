import { JsonStore } from "../lib/jsonStore.js";
import { logInfo, logWarn } from "../lib/logger.js";

function normalizeOriginId(campaign) {
  return String(campaign.originId || campaign.id || "").trim();
}

function buildCampaignCreatePayload(origin, campaign, defaultUserId) {
  const originId = normalizeOriginId(campaign);
  const payload = {
    origin,
    originId
  };

  if (campaign.name) payload.name = campaign.name;
  if (campaign.subject) payload.subject = campaign.subject;
  if (campaign.bodyHtml) payload.bodyHtml = campaign.bodyHtml;
  if (campaign.sent) payload.sent = campaign.sent;
  if (campaign.sentAt) payload.sent = campaign.sentAt;
  if (campaign.url) payload.url = campaign.url;
  if (defaultUserId) payload.userId = defaultUserId;

  return payload;
}

export class CampaignRegistry {
  constructor({ mapFile, fubClient, origin, defaultUserId }) {
    this.fubClient = fubClient;
    this.origin = origin;
    this.defaultUserId = defaultUserId;
    this.store = new JsonStore(mapFile, { campaigns: {} });
  }

  async ensureCampaignId(campaign) {
    const originId = normalizeOriginId(campaign);
    if (!originId) {
      throw new Error("Campaign is missing originId/id");
    }
    const key = `${this.origin}:${originId}`;

    const current = await this.store.read();
    if (current.campaigns[key]) {
      return current.campaigns[key];
    }

    const existing = await this.fubClient.getEmCampaignByOriginId(this.origin, originId);
    if (existing?.id) {
      current.campaigns[key] = existing.id;
      await this.store.write(current);
      logInfo("Campaign matched in Follow Up Boss", { key, campaignId: existing.id });
      return existing.id;
    }

    const createPayload = buildCampaignCreatePayload(this.origin, campaign, this.defaultUserId);
    const created = await this.fubClient.createEmCampaign(createPayload);
    const campaignId = created?.id || created?.campaign?.id;
    if (!campaignId) {
      logWarn("Campaign create response had no id", { response: created });
      throw new Error("Follow Up Boss returned no campaign id");
    }

    current.campaigns[key] = campaignId;
    await this.store.write(current);
    logInfo("Campaign created in Follow Up Boss", { key, campaignId });
    return campaignId;
  }
}
