"use client";

import { useMemo, useState } from "react";
import { FUNNEL_BUCKETS } from "../lib/leads/config";
import type { FunnelBucket, LeadRecord } from "../lib/leads/types";

type DashboardProps = {
  leads: LeadRecord[];
  sourceLabel: string;
  error?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  lastRefreshedAt?: string | null;
};

type FilterState = {
  assignedTo: string;
  timeframe: string;
  stage: string;
  hasPhone: "all" | "yes" | "no";
  hasEmail: "all" | "yes" | "no";
  propertyCity: string;
  minValue: number;
};

type TransactionFilter = "all" | "purchase" | "rental";
type HeatCategory = "hot" | "warm" | "cold" | "new";

type TimelineMetric = {
  key: string;
  label: string;
  purchaseCount: number;
  purchaseAmount: number;
  rentalCount: number;
  rentalAmount: number;
  unknownCount: number;
};

type HeatMetric = {
  key: HeatCategory;
  label: string;
  count: number;
  percent: number;
  totalAmount: number;
  bgClass: string;
};

const HEAT_BAND_CONFIG: Record<HeatCategory, { label: string; bgClass: string }> = {
  hot: { label: "HOT LEADS / INTERESTED", bgClass: "bg-red-500" },
  warm: { label: "WARM", bgClass: "bg-orange-500" },
  cold: { label: "COLD", bgClass: "bg-sky-500" },
  new: { label: "NEW LEAD", bgClass: "bg-slate-400" }
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value || 0
  );
}

function monthSequence(monthsAhead: number): { key: string; label: string }[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return Array.from({ length: monthsAhead }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return { key, label };
  });
}

function csvEscape(value: string | number): string {
  const stringValue = String(value ?? "");
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function stageToHeatCategory(stage: string): HeatCategory {
  const key = stage.trim().toLowerCase();

  if (key.includes("went cold") || key.includes("low interest") || key.includes("unqualified") || key.includes("1 year")) {
    return "cold";
  }
  if (key.includes("lead") || key === "new") {
    return "new";
  }
  if (key.includes("interested") || key.includes("active client") || key.includes("showing") || key.includes("offer")) {
    return "hot";
  }
  if (key.includes("prospect") || key.includes("attempted") || key.includes("hung up") || key.includes("follow")) {
    return "warm";
  }
  return "warm";
}

function matchesTransactionFilter(lead: LeadRecord, filter: TransactionFilter): boolean {
  if (filter === "all") return true;
  return lead.transactionType === filter;
}

export function LeadFunnelDashboard({
  leads,
  sourceLabel,
  error,
  onRefresh,
  refreshing = false,
  lastRefreshedAt = null
}: DashboardProps) {
  const [selectedBucket, setSelectedBucket] = useState<FunnelBucket | "all">("all");
  const [selectedTimelineMonth, setSelectedTimelineMonth] = useState<string>("all");
  const [selectedHeatCategory, setSelectedHeatCategory] = useState<HeatCategory | "all">("all");
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");
  const [filters, setFilters] = useState<FilterState>({
    assignedTo: "all",
    timeframe: "all",
    stage: "all",
    hasPhone: "all",
    hasEmail: "all",
    propertyCity: "all",
    minValue: 0
  });

  const options = useMemo(() => {
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      assignedTo: unique(leads.map((lead) => lead.assignedTo)),
      timeframe: unique(leads.map((lead) => lead.timeframe)),
      stage: unique(leads.map((lead) => lead.stage)),
      city: unique(leads.map((lead) => lead.propertyCity))
    };
  }, [leads]);

  const baseFiltered = useMemo(() => {
    return leads.filter((lead) => {
      if (filters.assignedTo !== "all" && lead.assignedTo !== filters.assignedTo) return false;
      if (filters.timeframe !== "all" && lead.timeframe !== filters.timeframe) return false;
      if (filters.stage !== "all" && lead.stage !== filters.stage) return false;
      if (filters.propertyCity !== "all" && lead.propertyCity !== filters.propertyCity) return false;
      if (lead.value < filters.minValue) return false;
      if (filters.hasPhone === "yes" && !lead.phone) return false;
      if (filters.hasPhone === "no" && lead.phone) return false;
      if (filters.hasEmail === "yes" && !lead.email) return false;
      if (filters.hasEmail === "no" && lead.email) return false;
      return true;
    });
  }, [leads, filters]);

  const eligibleLeads = useMemo(() => baseFiltered.filter((lead) => !lead.excludeFromQueue), [baseFiltered]);

  const transactionScopedLeads = useMemo(
    () => eligibleLeads.filter((lead) => matchesTransactionFilter(lead, transactionFilter)),
    [eligibleLeads, transactionFilter]
  );

  const transactionCounts = useMemo(() => {
    const purchase = eligibleLeads.filter((lead) => lead.transactionType === "purchase").length;
    const rental = eligibleLeads.filter((lead) => lead.transactionType === "rental").length;
    return {
      all: eligibleLeads.length,
      purchase,
      rental
    };
  }, [eligibleLeads]);

  const queueLeads = useMemo(() => {
    return transactionScopedLeads
      .filter((lead) => (selectedBucket === "all" ? true : lead.funnelBucket === selectedBucket))
      .filter((lead) => (selectedTimelineMonth === "all" ? true : lead.timelineMonth === selectedTimelineMonth))
      .filter((lead) => (selectedHeatCategory === "all" ? true : stageToHeatCategory(lead.stage) === selectedHeatCategory))
      .sort((a, b) => b.priorityScore - a.priorityScore || a.daysOld - b.daysOld);
  }, [transactionScopedLeads, selectedBucket, selectedTimelineMonth, selectedHeatCategory]);

  const topTodayQueue = useMemo(() => queueLeads.slice(0, 20), [queueLeads]);

  const funnelMetrics = useMemo(() => {
    const map = new Map<FunnelBucket, { count: number; totalValue: number }>();
    for (const bucket of FUNNEL_BUCKETS) {
      map.set(bucket, { count: 0, totalValue: 0 });
    }
    for (const lead of transactionScopedLeads) {
      const bucket = map.get(lead.funnelBucket);
      if (!bucket) continue;
      bucket.count += 1;
      bucket.totalValue += lead.value;
    }
    return map;
  }, [transactionScopedLeads]);

  const maxBucketCount = useMemo(() => {
    return Math.max(1, ...Array.from(funnelMetrics.values()).map((item) => item.count));
  }, [funnelMetrics]);

  const timelineMetrics = useMemo(() => {
    const months = monthSequence(8);
    const map = new Map<string, TimelineMetric>();
    for (const month of months) {
      map.set(month.key, {
        key: month.key,
        label: month.label,
        purchaseCount: 0,
        purchaseAmount: 0,
        rentalCount: 0,
        rentalAmount: 0,
        unknownCount: 0
      });
    }

    for (const lead of transactionScopedLeads) {
      if (!lead.timelineMonth) continue;
      if (!map.has(lead.timelineMonth)) continue;
      const bucket = map.get(lead.timelineMonth);
      if (!bucket) continue;

      if (lead.transactionType === "purchase") {
        bucket.purchaseCount += 1;
        bucket.purchaseAmount += lead.value;
      } else if (lead.transactionType === "rental") {
        bucket.rentalCount += 1;
        bucket.rentalAmount += lead.value;
      } else {
        bucket.unknownCount += 1;
      }
    }

    return Array.from(map.values());
  }, [transactionScopedLeads]);

  const maxTimelineAmount = useMemo(() => {
    return Math.max(1, ...timelineMetrics.map((row) => row.purchaseAmount + row.rentalAmount));
  }, [timelineMetrics]);

  const inferredTimelineCount = useMemo(() => {
    return transactionScopedLeads.filter((lead) => Boolean(lead.timelineMonth)).length;
  }, [transactionScopedLeads]);

  const heatMetrics = useMemo(() => {
    const initial: Record<HeatCategory, { count: number; totalAmount: number }> = {
      hot: { count: 0, totalAmount: 0 },
      warm: { count: 0, totalAmount: 0 },
      cold: { count: 0, totalAmount: 0 },
      new: { count: 0, totalAmount: 0 }
    };

    for (const lead of transactionScopedLeads) {
      const category = stageToHeatCategory(lead.stage);
      initial[category].count += 1;
      initial[category].totalAmount += lead.value;
    }

    const total = Math.max(1, transactionScopedLeads.length);
    const ordered: HeatCategory[] = ["hot", "warm", "cold", "new"];
    return ordered.map((key) => {
      const config = HEAT_BAND_CONFIG[key];
      const metric = initial[key];
      return {
        key,
        label: config.label,
        count: metric.count,
        percent: metric.count / total,
        totalAmount: metric.totalAmount,
        bgClass: config.bgClass
      } satisfies HeatMetric;
    });
  }, [transactionScopedLeads]);

  const exportCsv = () => {
    const headers = [
      "Name",
      "Stage",
      "Lead Category",
      "Timeframe",
      "Transaction Type",
      "Timeline Month",
      "Assigned To",
      "Email 1",
      "Phone 1",
      "Property City",
      "Property Address",
      "Property MLS Number",
      "Value",
      "Priority Score",
      "Next Action",
      "Flags",
      "Funnel Bucket"
    ];

    const rows = queueLeads.map((lead) => [
      lead.name,
      lead.stage,
      stageToHeatCategory(lead.stage),
      lead.timeframe,
      lead.transactionType,
      lead.timelineLabel || "",
      lead.assignedTo,
      lead.email,
      lead.phone,
      lead.propertyCity,
      lead.propertyAddress,
      lead.propertyMlsNumber,
      lead.value,
      lead.priorityScore,
      lead.nextAction,
      lead.flags.join("|"),
      lead.funnelBucket
    ]);

    const content = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "prioritized-leads.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Lead Funnel Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Source: <span className="font-medium">{sourceLabel}</span>
            </p>
            {lastRefreshedAt ? (
              <p className="mt-1 text-xs text-slate-500">Last refreshed: {lastRefreshedAt}</p>
            ) : null}
          </div>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                refreshing
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {refreshing ? "Refreshing..." : "Refresh Data"}
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button
            type="button"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            onClick={exportCsv}
          >
            Export prioritized CSV
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={filters.assignedTo}
            onChange={(event) => setFilters((prev) => ({ ...prev, assignedTo: event.target.value }))}
          >
            <option value="all">Assigned To: All</option>
            {options.assignedTo.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={filters.timeframe}
            onChange={(event) => setFilters((prev) => ({ ...prev, timeframe: event.target.value }))}
          >
            <option value="all">Timeframe: All</option>
            {options.timeframe.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={filters.stage}
            onChange={(event) => setFilters((prev) => ({ ...prev, stage: event.target.value }))}
          >
            <option value="all">Stage: All</option>
            {options.stage.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={filters.hasPhone}
            onChange={(event) => setFilters((prev) => ({ ...prev, hasPhone: event.target.value as FilterState["hasPhone"] }))}
          >
            <option value="all">Has Phone: All</option>
            <option value="yes">Has Phone: Yes</option>
            <option value="no">Has Phone: No</option>
          </select>

          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={filters.hasEmail}
            onChange={(event) => setFilters((prev) => ({ ...prev, hasEmail: event.target.value as FilterState["hasEmail"] }))}
          >
            <option value="all">Has Email: All</option>
            <option value="yes">Has Email: Yes</option>
            <option value="no">Has Email: No</option>
          </select>

          <div className="flex gap-2">
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={filters.propertyCity}
              onChange={(event) => setFilters((prev) => ({ ...prev, propertyCity: event.target.value }))}
            >
              <option value="all">Property City: All</option>
              {options.city.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <label className="text-sm text-slate-700" htmlFor="min-value">
            Min value
          </label>
          <input
            id="min-value"
            type="number"
            min={0}
            className="w-44 rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={filters.minValue}
            onChange={(event) => setFilters((prev) => ({ ...prev, minValue: Number(event.target.value) || 0 }))}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Lead Temperature Categories</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTransactionFilter("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                transactionFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All ({transactionCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setTransactionFilter("purchase")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                transactionFilter === "purchase"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Purchase ({transactionCounts.purchase})
            </button>
            <button
              type="button"
              onClick={() => setTransactionFilter("rental")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                transactionFilter === "rental"
                  ? "bg-brand-600 text-white"
                  : "bg-brand-50 text-brand-700 hover:bg-brand-100"
              }`}
            >
              Rental ({transactionCounts.rental})
            </button>
            <button
              type="button"
              onClick={() => setSelectedHeatCategory("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                selectedHeatCategory === "all"
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Clear category filter
            </button>
          </div>
        </div>

        <p className="mb-3 text-xs text-slate-600">
          Total leads in current transaction filter: {transactionScopedLeads.length}. Band thickness is proportional to
          % of leads in each category.
        </p>

        <div className="space-y-3">
          {heatMetrics.map((metric) => {
            const active = selectedHeatCategory === metric.key;
            const height = Math.max(34, Math.round(28 + metric.percent * 140));
            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => setSelectedHeatCategory((prev) => (prev === metric.key ? "all" : metric.key))}
                className={`w-full rounded-md px-4 text-center text-white shadow-sm transition ${
                  metric.bgClass
                } ${active ? "ring-2 ring-slate-800 ring-offset-2" : "opacity-95 hover:opacity-100"}`}
                style={{ height: `${height}px` }}
              >
                <div className="flex h-full flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold tracking-wide">{metric.label}</span>
                  <span>
                    {metric.count} leads ({(metric.percent * 100).toFixed(1)}%) | {formatCurrency(metric.totalAmount)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Buyer Timeline (Inferred from Notes + Moving Dates)</h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-600">
              {inferredTimelineCount} leads have an inferred month. Click a month to filter Today Queue.
            </p>
            <button
              type="button"
              onClick={() => setSelectedTimelineMonth("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                selectedTimelineMonth === "all"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Show all months
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {timelineMetrics.map((row) => {
            const totalAmount = row.purchaseAmount + row.rentalAmount;
            const purchaseWidth = Math.max(0, Math.round((row.purchaseAmount / maxTimelineAmount) * 100));
            const rentalWidth = Math.max(0, Math.round((row.rentalAmount / maxTimelineAmount) * 100));
            const active = selectedTimelineMonth === row.key;

            return (
              <button
                type="button"
                key={row.key}
                onClick={() => setSelectedTimelineMonth((prev) => (prev === row.key ? "all" : row.key))}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  active ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-slate-700">Total: {formatCurrency(totalAmount)}</span>
                </div>
                <div className="grid gap-1 text-xs text-slate-600 md:grid-cols-2">
                  <div>
                    Purchase: {row.purchaseCount} leads | {formatCurrency(row.purchaseAmount)}
                  </div>
                  <div>
                    Rental: {row.rentalCount} leads | {formatCurrency(row.rentalAmount)}
                    {row.unknownCount > 0 ? ` | Unknown type: ${row.unknownCount}` : ""}
                  </div>
                </div>
                <div className="mt-2 h-2 rounded bg-slate-100">
                  <div className="flex h-2 overflow-hidden rounded">
                    <div className="bg-emerald-600" style={{ width: `${purchaseWidth}%` }} />
                    <div className="bg-brand-500" style={{ width: `${rentalWidth}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-emerald-600" /> Purchase
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-brand-500" /> Rental
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Funnel Visualization</h2>
          <button
            type="button"
            onClick={() => setSelectedBucket("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              selectedBucket === "all" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Clear bucket filter
          </button>
        </div>

        <div className="grid gap-2">
          {FUNNEL_BUCKETS.map((bucket) => {
            const metric = funnelMetrics.get(bucket) ?? { count: 0, totalValue: 0 };
            const width = Math.max(6, Math.round((metric.count / maxBucketCount) * 100));
            const active = selectedBucket === bucket;

            return (
              <button
                type="button"
                key={bucket}
                onClick={() => setSelectedBucket((prev) => (prev === bucket ? "all" : bucket))}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  active ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{bucket}</span>
                  <span className="text-slate-600">
                    {metric.count} leads | {formatCurrency(metric.totalValue)}
                  </span>
                </div>
                <div className="h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-brand-500" style={{ width: `${width}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Today Queue</h2>
          <p className="text-xs text-slate-600">
            Showing {topTodayQueue.length} of {queueLeads.length} eligible leads (DNC excluded by default).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1380px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Lead</th>
                <th className="px-3 py-2 text-left">Score</th>
                <th className="px-3 py-2 text-left">Stage / Timeframe</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Type / Timeline</th>
                <th className="px-3 py-2 text-left">Contact</th>
                <th className="px-3 py-2 text-left">Value</th>
                <th className="px-3 py-2 text-left">Next action</th>
                <th className="px-3 py-2 text-left">Flags</th>
                <th className="px-3 py-2 text-left">Quick actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {topTodayQueue.map((lead) => {
                const emailDisabled = !lead.email || lead.flags.includes("email_bounced");
                const callDisabled = !lead.phone;
                const leadCategory = stageToHeatCategory(lead.stage);
                return (
                  <tr key={lead.id} className="align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{lead.name || "Unnamed Lead"}</p>
                      <p className="text-xs text-slate-600">
                        {lead.assignedTo || "Unassigned"} | {lead.propertyCity || "City n/a"}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold">{lead.priorityScore}</p>
                      <p className="text-xs text-slate-600">Days old: {lead.daysOld}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p>{lead.stage || "Unknown"}</p>
                      <p className="text-xs text-slate-600">{lead.timeframe || "Unknown timeframe"}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-700">
                        {leadCategory}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="capitalize">{lead.transactionType}</p>
                      <p className="text-xs text-slate-600">{lead.timelineLabel || "No month inferred"}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p>{lead.phone || "No phone"}</p>
                      <p className="text-xs text-slate-600">{lead.email || "No email"}</p>
                    </td>
                    <td className="px-3 py-2">{formatCurrency(lead.value)}</td>
                    <td className="px-3 py-2">{lead.nextAction}</td>
                    <td className="px-3 py-2">
                      {lead.flags.length === 0 ? (
                        <span className="text-xs text-slate-500">none</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {lead.flags.map((flag) => (
                            <span
                              key={`${lead.id}-${flag}`}
                              className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <a
                          href={callDisabled ? "#" : `tel:${lead.phone}`}
                          className={`rounded px-2 py-1 text-xs ${
                            callDisabled ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-slate-900 text-white"
                          }`}
                          onClick={(event) => {
                            if (callDisabled) event.preventDefault();
                          }}
                        >
                          Call
                        </a>
                        <a
                          href={callDisabled ? "#" : `sms:${lead.phone}`}
                          className={`rounded px-2 py-1 text-xs ${
                            callDisabled ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-brand-600 text-white"
                          }`}
                          onClick={(event) => {
                            if (callDisabled) event.preventDefault();
                          }}
                        >
                          Text
                        </a>
                        <a
                          href={emailDisabled ? "#" : `mailto:${lead.email}`}
                          className={`rounded px-2 py-1 text-xs ${
                            emailDisabled ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-emerald-600 text-white"
                          }`}
                          onClick={(event) => {
                            if (emailDisabled) event.preventDefault();
                          }}
                        >
                          Email
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {topTodayQueue.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={10}>
                    No leads matched current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
