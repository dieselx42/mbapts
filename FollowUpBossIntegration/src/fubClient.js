function toQueryString(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

function normalizeCampaignResponse(payload) {
  if (!payload) return null;
  if (payload.id) return payload;
  if (Array.isArray(payload.campaigns) && payload.campaigns.length > 0) {
    return payload.campaigns[0];
  }
  if (Array.isArray(payload.items) && payload.items.length > 0) {
    return payload.items[0];
  }
  return null;
}

export class FubClient {
  constructor({ apiKey, baseUrl }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async request(method, path, { query, body } = {}) {
    const queryString = toQueryString(query);
    const url = `${this.baseUrl}${path}${queryString}`;
    const authToken = Buffer.from(`${this.apiKey}:`).toString("base64");
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${authToken}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    let parsed = {};
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch (_) {
        parsed = { raw: text };
      }
    }

    if (!response.ok) {
      const error = new Error(`FUB request failed (${response.status}) ${method} ${path}`);
      error.status = response.status;
      error.payload = parsed;
      throw error;
    }
    return parsed;
  }

  async getEmCampaignByOriginId(origin, originId) {
    const payload = await this.request("GET", "/emCampaigns", {
      query: { origin, originId }
    });
    return normalizeCampaignResponse(payload);
  }

  async createEmCampaign(campaignPayload) {
    return this.request("POST", "/emCampaigns", { body: campaignPayload });
  }

  async createEmEvents(eventPayload) {
    return this.request("POST", "/emEvents", { body: eventPayload });
  }

  async findPersonByEmail(email) {
    try {
      const checkDuplicate = await this.request("GET", "/people/checkDuplicate", {
        query: { email }
      });
      if (checkDuplicate?.id) return checkDuplicate;
      if (Array.isArray(checkDuplicate?.people) && checkDuplicate.people.length > 0) {
        return checkDuplicate.people[0];
      }
    } catch (_) {
      // Fallback to generic people lookup.
    }

    const peopleSearch = await this.request("GET", "/people", { query: { email } });
    if (Array.isArray(peopleSearch?.people) && peopleSearch.people.length > 0) {
      return peopleSearch.people[0];
    }
    if (Array.isArray(peopleSearch?.items) && peopleSearch.items.length > 0) {
      return peopleSearch.items[0];
    }
    return null;
  }

  async mergePersonTags(personId, tags) {
    return this.request("PUT", `/people/${personId}`, {
      query: { mergeTags: true },
      body: { tags }
    });
  }
}
