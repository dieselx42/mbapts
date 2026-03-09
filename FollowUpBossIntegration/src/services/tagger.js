import { logInfo, logWarn } from "../lib/logger.js";

export class FubTagger {
  constructor({ fubClient, tagName }) {
    this.fubClient = fubClient;
    this.tagName = tagName;
  }

  async applyTagToEmail(email) {
    const person = await this.fubClient.findPersonByEmail(email);
    if (!person?.id) {
      logWarn("No person matched for email; tag not applied", { email });
      return { email, tagged: false, reason: "person_not_found" };
    }

    const currentTags = Array.isArray(person.tags) ? person.tags : [];
    const tags = [...new Set([...currentTags, this.tagName])];
    await this.fubClient.mergePersonTags(person.id, tags);
    logInfo("Applied tag to person", { email, personId: person.id, tag: this.tagName });
    return { email, tagged: true, personId: person.id };
  }
}
