import Link from "next/link";
import { LeadFunnelDashboard } from "../../components/lead-funnel-dashboard";
import { buildLeadRecords } from "../../lib/leads/scoring";
import { SAMPLE_ROWS } from "../../lib/leads/sample";

export default function SamplePage() {
  const leads = buildLeadRecords(SAMPLE_ROWS);

  return (
    <main className="mx-auto w-[min(1400px,96vw)] py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Sample</p>
          <h1 className="text-2xl font-semibold tracking-tight">Lead Funnel Dashboard (Sample Data)</h1>
        </div>
        <Link href="/" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
          Back to live CSV
        </Link>
      </div>
      <LeadFunnelDashboard leads={leads} sourceLabel="sample dataset" />
    </main>
  );
}
