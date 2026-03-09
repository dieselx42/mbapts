"use client";

import { useEffect, useRef, useState } from "react";
import { LeadFunnelDashboard } from "./lead-funnel-dashboard";
import type { LeadRecord } from "../lib/leads/types";

type ApiResponse = {
  ok: boolean;
  source: string;
  refreshedAt?: string;
  count: number;
  leads: LeadRecord[];
  error?: string;
};

function toRefreshLabel(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function LeadFunnelLoader() {
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  async function loadLeads(mode: "initial" | "manual") {
    if (mode === "manual") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const requestUrl = `/api/leads?refresh=${Date.now()}`;
      const result = await fetch(requestUrl, { cache: "no-store" });
      const payload = (await result.json()) as ApiResponse;
      if (!mountedRef.current) return;
      setResponse(payload);
      const refreshedFromApi = payload.refreshedAt ? new Date(payload.refreshedAt) : new Date();
      setLastRefreshedAt(toRefreshLabel(refreshedFromApi));
    } catch (error) {
      if (!mountedRef.current) return;
      setResponse({
        ok: false,
        source: "/api/leads",
        count: 0,
        leads: [],
        error: error instanceof Error ? error.message : "Failed to fetch leads"
      });
      setLastRefreshedAt(toRefreshLabel(new Date()));
    } finally {
      if (!mountedRef.current) return;
      if (mode === "manual") {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void loadLeads("initial");
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading lead data from local CSV...
      </div>
    );
  }

  return (
    <LeadFunnelDashboard
      leads={response?.leads ?? []}
      sourceLabel={response?.source ?? "unknown"}
      error={response?.error}
      refreshing={refreshing}
      onRefresh={() => void loadLeads("manual")}
      lastRefreshedAt={lastRefreshedAt}
    />
  );
}
