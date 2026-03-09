import { logInfo } from "../lib/logger.js";

const TYPE_MAP = new Map([
  ["delivered", "delivered"],
  ["delivery", "delivered"],
  ["open", "opened"],
  ["opened", "opened"],
  ["click", "clicked"],
  ["clicked", "clicked"],
  ["unsubscribe", "unsubscribed"],
  ["unsubscribed", "unsubscribed"],
  ["bounce", "bounced"],
  ["bounced", "bounced"],
  ["spamreport", "complained"],
  ["complained", "complained"]
]);

function normalizeType(type) {
  const value = String(type || "").toLowerCase().trim();
  return TYPE_MAP.get(value) || value;
}

function normalizeOccurredAt(value) {
  if (!value) return new Date().toISOString();
  const asDate = new Date(value);
  return Number.isNaN(asDate.getTime()) ? new Date().toISOString() : asDate.toISOString();
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildPayloadEvents(campaignId, events, defaultUserId) {
  return events
    .filter((event) => event && event.recipient && event.type)
    .map((event) => {
      const payload = {
        campaignId,
        recipient: event.recipient,
        type: normalizeType(event.type),
        occurred: normalizeOccurredAt(event.occurred || event.occurredAt)
      };
      if (event.url) payload.url = event.url;
      if (event.messageId) payload.messageId = event.messageId;
      if (event.userId || defaultUserId) payload.userId = event.userId || defaultUserId;
      return payload;
    });
}

export class EventForwarder {
  constructor({ fubClient, defaultUserId, batchSize = 500 }) {
    this.fubClient = fubClient;
    this.defaultUserId = defaultUserId;
    this.batchSize = batchSize;
  }

  async forward(campaignId, events) {
    const payloadEvents = buildPayloadEvents(campaignId, events, this.defaultUserId);
    if (payloadEvents.length === 0) {
      return { forwarded: 0 };
    }

    const chunks = chunk(payloadEvents, this.batchSize);
    for (const [index, entries] of chunks.entries()) {
      await this.fubClient.createEmEvents({ events: entries });
      logInfo("Forwarded emEvents batch", {
        campaignId,
        batch: index + 1,
        batchSize: entries.length
      });
    }

    return { forwarded: payloadEvents.length };
  }
}
