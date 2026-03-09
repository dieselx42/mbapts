import { JsonStore } from "../lib/jsonStore.js";

function asTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
}

function unique(values) {
  return [...new Set(values)];
}

export class EngagementScorer {
  constructor({
    storageFile,
    threshold = 3,
    windowDays = 14,
    tagName = "Preconstruction Active"
  }) {
    this.store = new JsonStore(storageFile, { recipients: {} });
    this.threshold = threshold;
    this.windowMs = windowDays * 24 * 60 * 60 * 1000;
    this.tagName = tagName;
  }

  async evaluatePreconstructionClicks(events) {
    const state = await this.store.read();
    const now = Date.now();
    const thresholdMs = now - this.windowMs;
    const promoted = [];

    for (const event of events) {
      const type = String(event.type || "").toLowerCase();
      if (type !== "click" && type !== "clicked") continue;
      const email = String(event.recipient || "").toLowerCase().trim();
      if (!email) continue;

      if (!state.recipients[email]) {
        state.recipients[email] = { clicks: [], tagsApplied: [] };
      }

      const recipient = state.recipients[email];
      recipient.clicks.push({
        at: asTimestamp(event.occurred || event.occurredAt)
      });
      recipient.clicks = recipient.clicks.filter((click) => click.at >= thresholdMs);

      const alreadyTagged = recipient.tagsApplied.includes(this.tagName);
      if (!alreadyTagged && recipient.clicks.length >= this.threshold) {
        recipient.tagsApplied.push(this.tagName);
        promoted.push(email);
      }
    }

    for (const recipient of Object.values(state.recipients)) {
      recipient.clicks = recipient.clicks.filter((click) => click.at >= thresholdMs);
    }

    await this.store.write(state);
    return unique(promoted);
  }
}
